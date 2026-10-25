from django import forms
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm
from django.utils.html import format_html, format_html_join

from .dashboard import FLOOD_PREFIX, URGENT_PREFIX, report_type, short_message
from .models import EmergencyReport
from .roles import LGU_ADMIN, RESPONDER, get_role_group, is_lgu_admin
from .tracking import format_tracking_code, normalize_tracking_code

User = get_user_model()

ROLE_RESPONDER = 'responder'
ROLE_LGU_ADMIN = 'lgu_admin'
ROLE_GROUPS = {ROLE_RESPONDER: RESPONDER, ROLE_LGU_ADMIN: LGU_ADMIN}


# --- Staff accounts (Responder / LGU Administrator) ---------------------------------------

class RoleUserCreationForm(UserCreationForm):
    """Create a staff account with exactly one role."""

    role = forms.ChoiceField(
        label='Role',
        choices=[],  # filled per request in RescueConnectUserAdmin.get_form
        help_text='Responders review reports and update their status. '
                  'LGU Administrators also manage Responder accounts.',
    )

    class Meta(UserCreationForm.Meta):
        fields = ('username', 'first_name', 'last_name', 'email')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for name in ('first_name', 'last_name', 'email'):
            self.fields[name].required = True


class RescueConnectUserAdmin(UserAdmin):
    """User admin with roles.

    Superusers manage everyone. LGU Administrators can only see, create and edit Responder
    accounts, and cannot grant permissions, make superusers, or delete accounts.
    """

    add_form = RoleUserCreationForm
    add_form_template = None  # the stock template is built around the optional-password toggle
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'first_name', 'last_name', 'email', 'role', 'password1', 'password2'),
        }),
    )
    list_display = ('username', 'full_name', 'email', 'role_label', 'is_active', 'last_login')
    list_filter = ('is_active', 'groups')
    search_fields = ('username', 'first_name', 'last_name', 'email')

    restricted_fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name', 'email')}),
        ('Status', {'fields': ('is_active',), 'description': 'Deactivate an account instead of deleting it.'}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )

    # -- list ---------------------------------------------------------------------------
    @admin.display(description='Name', ordering='last_name')
    def full_name(self, obj):
        return obj.get_full_name() or '—'

    @admin.display(description='Role')
    def role_label(self, obj):
        if obj.is_superuser:
            return 'Superuser'
        return ', '.join(group.name for group in obj.groups.all()) or '—'

    def get_queryset(self, request):
        queryset = super().get_queryset(request).prefetch_related('groups')
        if request.user.is_superuser:
            return queryset
        return queryset.filter(is_superuser=False, groups__name=RESPONDER)

    # -- forms --------------------------------------------------------------------------
    def get_fieldsets(self, request, obj=None):
        if obj is not None and not request.user.is_superuser:
            return self.restricted_fieldsets
        return super().get_fieldsets(request, obj)

    def get_readonly_fields(self, request, obj=None):
        readonly = super().get_readonly_fields(request, obj)
        if obj is not None:
            return tuple(readonly) + ('last_login', 'date_joined')
        return readonly

    def get_form(self, request, obj=None, **kwargs):
        form_class = super().get_form(request, obj, **kwargs)
        if obj is not None:
            return form_class

        if request.user.is_superuser:
            choices = [(ROLE_RESPONDER, RESPONDER), (ROLE_LGU_ADMIN, LGU_ADMIN)]
        else:
            choices = [(ROLE_RESPONDER, RESPONDER)]

        class RoleLimitedForm(form_class):
            def __init__(self, *args, **form_kwargs):
                super().__init__(*args, **form_kwargs)
                self.fields['role'].choices = choices

        return RoleLimitedForm

    def save_model(self, request, obj, form, change):
        # Enforced on the server, whatever the submitted form data says.
        if not request.user.is_superuser or not change:
            obj.is_superuser = False
            obj.is_staff = True
        super().save_model(request, obj, form, change)

        if not change:
            obj.groups.set([get_role_group(ROLE_GROUPS[form.cleaned_data['role']])])
        elif not request.user.is_superuser:
            obj.groups.set([get_role_group(RESPONDER)])

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser and super().has_delete_permission(request, obj)


admin.site.unregister(User)
admin.site.register(User, RescueConnectUserAdmin)


# --- Emergency reports -----------------------------------------------------------------------

class ReportTypeFilter(admin.SimpleListFilter):
    title = 'report type'
    parameter_name = 'type'

    def lookups(self, request, model_admin):
        return (('urgent', 'Urgent response'), ('flood', 'Flooded area'))

    def queryset(self, request, queryset):
        if self.value() == 'urgent':
            return queryset.filter(message__startswith=URGENT_PREFIX)
        if self.value() == 'flood':
            return queryset.filter(message__startswith=FLOOD_PREFIX)
        return queryset


def _photo_url(report, field):
    try:
        return getattr(report, f'{field}_url')
    except Exception:  # missing Cloudinary configuration must not break the admin page
        return None


@admin.register(EmergencyReport)
class EmergencyReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'status_badge', 'type_label', 'short_message', 'photo_count', 'created_at', 'map_link')
    list_filter = ('status', ReportTypeFilter, 'created_at')
    search_fields = ('message', 'device_id')  # plus the tracking code, see get_search_results
    date_hierarchy = 'created_at'
    list_per_page = 25
    readonly_fields = ('type_label', 'photo_previews', 'map_link', 'tracking_code_display', 'created_at', 'updated_at', 'resolved_at', 'reported_at')
    fieldsets = (
        ('Report', {'fields': ('status', 'type_label', 'message')}),
        ('Location', {'fields': ('latitude', 'longitude', 'accuracy', 'map_link')}),
        ('Photos', {'fields': ('photo_previews',)}),
        ('Record', {'fields': ('tracking_code_display', 'device_id', 'reported_at', 'created_at', 'updated_at', 'resolved_at')}),
    )

    # Responders may only change the status; LGU administrators and superusers may edit the rest.
    responder_locked_fields = ('message', 'latitude', 'longitude', 'accuracy', 'device_id')

    def get_readonly_fields(self, request, obj=None):
        readonly = tuple(super().get_readonly_fields(request, obj))
        if is_lgu_admin(request.user):
            return readonly
        return readonly + self.responder_locked_fields

    def get_search_results(self, request, queryset, search_term):
        queryset, may_have_duplicates = super().get_search_results(request, queryset, search_term)
        # Staff can paste the code a citizen reads out, with or without dashes and in any case.
        code = normalize_tracking_code(search_term)
        if code:
            queryset = queryset | self.model.objects.filter(tracking_code=code)
        return queryset, may_have_duplicates

    @admin.display(description='Tracking code')
    def tracking_code_display(self, obj):
        return format_tracking_code(obj.tracking_code) if obj.tracking_code else '—'

    @admin.display(description='Status', ordering='status')
    def status_badge(self, obj):
        return format_html('<span class="rc-badge rc-badge--{}">{}</span>', obj.status, obj.get_status_display())

    @admin.display(description='Type')
    def type_label(self, obj):
        return report_type(obj.message)

    @admin.display(description='Message')
    def short_message(self, obj):
        return short_message(obj.message)

    @admin.display(description='Photos')
    def photo_count(self, obj):
        return bool(obj.photo1) + bool(obj.photo2)

    @admin.display(description='Map')
    def map_link(self, obj):
        if obj.latitude is None or obj.longitude is None:
            return '—'
        return format_html(
            '<a href="https://www.openstreetmap.org/?mlat={0}&amp;mlon={1}#map=17/{0}/{1}" '
            'target="_blank" rel="noopener noreferrer">View on map</a>',
            obj.latitude, obj.longitude,
        )

    @admin.display(description='Photos')
    def photo_previews(self, obj):
        urls = [(url, number) for number, field in enumerate(('photo1', 'photo2'), start=1)
                if (url := _photo_url(obj, field))]
        if not urls:
            return 'No photos attached'
        return format_html_join(
            '',
            '<a href="{0}" target="_blank" rel="noopener noreferrer">'
            '<img class="rc-thumb" src="{0}" alt="Report photo {1}"></a>',
            urls,
        )
