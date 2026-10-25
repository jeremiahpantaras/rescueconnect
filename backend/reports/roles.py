"""RescueConnect staff roles, implemented as Django Groups.

Both roles log in through the Django admin (`is_staff=True`). Superusers are treated as
LGU administrators. Role-aware REST API permissions are not implemented yet; the API still
treats every staff user alike (see docs/claude/ARCHITECTURE.md).
"""
from django.contrib.auth.models import Group, Permission
from django.db import DEFAULT_DB_ALIAS

RESPONDER = 'Responder'
LGU_ADMIN = 'LGU Administrator'

# (app_label, codename) permissions held by each role.
RESPONDER_PERMISSIONS = [
    ('reports', 'view_emergencyreport'),
    ('reports', 'change_emergencyreport'),
]
LGU_ADMIN_PERMISSIONS = RESPONDER_PERMISSIONS + [
    ('auth', 'view_user'),
    ('auth', 'add_user'),
    ('auth', 'change_user'),
]

ROLE_PERMISSIONS = {
    RESPONDER: RESPONDER_PERMISSIONS,
    LGU_ADMIN: LGU_ADMIN_PERMISSIONS,
}


def ensure_role_groups(using=DEFAULT_DB_ALIAS):
    """Create the role groups and set their permissions. Safe to run repeatedly."""
    for name, permissions in ROLE_PERMISSIONS.items():
        group, _ = Group.objects.using(using).get_or_create(name=name)
        found = [
            Permission.objects.using(using).get(content_type__app_label=app_label, codename=codename)
            for app_label, codename in permissions
        ]
        group.permissions.set(found)


def create_role_groups(sender, using=DEFAULT_DB_ALIAS, **kwargs):
    """post_migrate receiver (connected in ReportsConfig.ready)."""
    ensure_role_groups(using)


def get_role_group(name):
    try:
        return Group.objects.get(name=name)
    except Group.DoesNotExist:
        ensure_role_groups()
        return Group.objects.get(name=name)


def is_lgu_admin(user):
    """LGU administrators, and superusers, who act as LGU administrators."""
    return bool(
        user.is_active and (user.is_superuser or user.groups.filter(name=LGU_ADMIN).exists())
    )


def is_responder(user):
    return bool(user.is_active and user.groups.filter(name=RESPONDER).exists())
