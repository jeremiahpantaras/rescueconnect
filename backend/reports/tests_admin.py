from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from django.urls import reverse

from .dashboard import report_type
from .models import EmergencyReport
from .roles import LGU_ADMIN, RESPONDER

User = get_user_model()
PASSWORD = 'Rescue#Pass2026x'


def make_staff(username, role=None):
    user = User.objects.create_user(username, f'{username}@example.com', PASSWORD, is_staff=True)
    if role:
        user.groups.add(Group.objects.get(name=role))
    return user


def group_permissions(name):
    group = Group.objects.get(name=name)
    return {f'{p.content_type.app_label}.{p.codename}' for p in group.permissions.all()}


class AdminTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = User.objects.create_superuser('root', 'root@example.com', PASSWORD)
        cls.lgu = make_staff('lgu1', LGU_ADMIN)
        cls.other_lgu = make_staff('lgu2', LGU_ADMIN)
        cls.responder = make_staff('resp1', RESPONDER)
        cls.plain_staff = make_staff('plain')
        cls.urgent = EmergencyReport.objects.create(
            latitude=10.67, longitude=122.95, message='[URGENT RESPONSE] people on the roof', device_id='d-1'
        )
        cls.flood = EmergencyReport.objects.create(
            latitude=10.70, longitude=122.96, message='[FLOODED AREA] knee-deep water', device_id='d-2',
            status='resolved',
        )

    def login(self, user):
        self.client.force_login(user)

    def new_user_data(self, username, role, **extra):
        data = {
            'username': username, 'first_name': 'Maria', 'last_name': 'Santos', 'email': f'{username}@example.com',
            'role': role, 'password1': PASSWORD, 'password2': PASSWORD,
        }
        data.update(extra)
        return data


class RoleGroupTests(AdminTestCase):
    def test_role_groups_have_exactly_the_documented_permissions(self):
        responder = {'reports.view_emergencyreport', 'reports.change_emergencyreport'}
        self.assertEqual(group_permissions(RESPONDER), responder)
        self.assertEqual(
            group_permissions(LGU_ADMIN),
            responder | {'auth.view_user', 'auth.add_user', 'auth.change_user'},
        )

    def test_report_type_is_read_from_the_message_prefix(self):
        self.assertEqual(report_type('[URGENT RESPONSE] help'), 'Urgent response')
        self.assertEqual(report_type('[FLOODED AREA] water'), 'Flooded area')
        self.assertEqual(report_type('older report'), 'Unspecified')


class PagesTests(AdminTestCase):
    def test_login_page_shows_rescueconnect_branding(self):
        response = self.client.get(reverse('admin:login'))
        self.assertEqual(response.status_code, 200)
        for text in ('RescueConnect', 'Flood Emergency Response Coordination System',
                     'Authorized personnel only', 'Staff sign in', 'rescueconnect/admin.css'):
            self.assertContains(response, text)

    def test_staff_can_log_in_through_the_form(self):
        response = self.client.post(
            reverse('admin:login'), {'username': 'resp1', 'password': PASSWORD, 'next': reverse('admin:index')}
        )
        self.assertRedirects(response, reverse('admin:index'), fetch_redirect_response=False)

    def test_wrong_password_shows_an_error(self):
        response = self.client.post(reverse('admin:login'), {'username': 'resp1', 'password': 'nope'})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'errornote')

    def test_anonymous_index_redirects_to_login(self):
        response = self.client.get(reverse('admin:index'))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse('admin:login'), response['Location'])

    def test_dashboard_shows_report_counts_for_permitted_staff(self):
        self.login(self.lgu)
        response = self.client.get(reverse('admin:index'))
        self.assertContains(response, 'rc-dashboard')
        dashboard = response.context['rc_dashboard']
        self.assertEqual(dashboard['total'], 2)
        self.assertEqual(dashboard['active'], 1)
        self.assertEqual(dashboard['urgent_active'], 1)
        self.assertEqual(dashboard['last_24h'], 2)
        self.assertEqual({c['key']: c['count'] for c in dashboard['status_cards']},
                         {'pending': 1, 'acknowledged': 0, 'responding': 0, 'resolved': 1})
        self.assertContains(response, 'Add staff account')
        self.assertContains(response, 'Recent actions')  # stock sidebar is preserved
        self.assertNotContains(response, 'View site')  # "/" would serve the retired Vite app

    def test_responder_dashboard_has_no_account_link(self):
        self.login(self.responder)
        response = self.client.get(reverse('admin:index'))
        self.assertContains(response, 'rc-dashboard')
        self.assertNotContains(response, 'Add staff account')

    def test_staff_without_report_permission_sees_no_dashboard(self):
        self.login(self.plain_staff)
        response = self.client.get(reverse('admin:index'))
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'rc-dashboard')


class AccountCreationTests(AdminTestCase):
    add_url = None

    def setUp(self):
        self.add_url = reverse('admin:auth_user_add')

    def test_superuser_can_create_an_lgu_administrator(self):
        self.login(self.superuser)
        response = self.client.post(self.add_url, self.new_user_data('newlgu', 'lgu_admin'))
        self.assertEqual(response.status_code, 302)
        user = User.objects.get(username='newlgu')
        self.assertTrue(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertEqual(list(user.groups.values_list('name', flat=True)), [LGU_ADMIN])
        self.assertTrue(user.has_perm('auth.add_user'))
        self.assertTrue(self.client.login(username='newlgu', password=PASSWORD))

    def test_lgu_administrator_can_create_a_responder(self):
        self.login(self.lgu)
        response = self.client.post(self.add_url, self.new_user_data('newresp', 'responder'))
        self.assertEqual(response.status_code, 302)
        user = User.objects.get(username='newresp')
        self.assertTrue(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertEqual(list(user.groups.values_list('name', flat=True)), [RESPONDER])
        self.assertFalse(user.has_perm('auth.add_user'))

    def test_tampered_fields_cannot_escalate_privileges(self):
        self.login(self.lgu)
        lgu_group = Group.objects.get(name=LGU_ADMIN)
        data = self.new_user_data(
            'sneaky', 'responder', is_superuser='on', is_staff='on', groups=[lgu_group.pk], user_permissions=[1, 2],
        )
        self.client.post(self.add_url, data)
        user = User.objects.get(username='sneaky')
        self.assertFalse(user.is_superuser)
        self.assertEqual(list(user.groups.values_list('name', flat=True)), [RESPONDER])
        self.assertEqual(user.user_permissions.count(), 0)

    def test_lgu_administrator_cannot_create_another_lgu_administrator(self):
        self.login(self.lgu)
        response = self.client.post(self.add_url, self.new_user_data('wannabe', 'lgu_admin'))
        self.assertEqual(response.status_code, 200)  # form re-rendered with an error
        self.assertFalse(User.objects.filter(username='wannabe').exists())

    def test_superuser_account_creation_never_grants_superuser(self):
        self.login(self.superuser)
        self.client.post(self.add_url, self.new_user_data('notroot', 'responder', is_superuser='on'))
        self.assertFalse(User.objects.get(username='notroot').is_superuser)

    def test_weak_password_is_rejected(self):
        self.login(self.lgu)
        data = self.new_user_data('weak', 'responder', password1='12345678', password2='12345678')
        response = self.client.post(self.add_url, data)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(username='weak').exists())

    def test_responder_cannot_open_the_users_admin(self):
        self.login(self.responder)
        self.assertEqual(self.client.get(reverse('admin:auth_user_changelist')).status_code, 403)
        self.assertEqual(self.client.get(self.add_url).status_code, 403)


class AccountScopeTests(AdminTestCase):
    def test_lgu_administrator_only_lists_responders(self):
        self.login(self.lgu)
        response = self.client.get(reverse('admin:auth_user_changelist'))
        self.assertEqual(response.status_code, 200)
        usernames = {user.username for user in response.context['cl'].result_list}
        self.assertEqual(usernames, {'resp1'})

    def test_superuser_lists_everyone_with_roles(self):
        self.login(self.superuser)
        response = self.client.get(reverse('admin:auth_user_changelist'))
        usernames = {user.username for user in response.context['cl'].result_list}
        self.assertEqual(usernames, {'root', 'lgu1', 'lgu2', 'resp1', 'plain'})
        self.assertContains(response, 'Superuser')
        self.assertContains(response, LGU_ADMIN)

    def test_lgu_administrator_cannot_open_superusers_or_other_lgu_administrators(self):
        self.login(self.lgu)
        for target in (self.superuser, self.other_lgu, self.lgu):
            for name in ('admin:auth_user_change', 'admin:auth_user_password_change'):
                response = self.client.get(reverse(name, args=[target.pk]))
                self.assertNotEqual(response.status_code, 200, f'{name} {target.username}')
        response = self.client.post(
            reverse('admin:auth_user_change', args=[self.superuser.pk]), {'username': 'root', 'is_active': ''}
        )
        self.assertNotEqual(response.status_code, 200)
        self.superuser.refresh_from_db()
        self.assertTrue(self.superuser.is_active)

    def test_lgu_administrator_can_deactivate_a_responder_but_not_escalate_them(self):
        self.login(self.lgu)
        lgu_group = Group.objects.get(name=LGU_ADMIN)
        response = self.client.post(
            reverse('admin:auth_user_change', args=[self.responder.pk]),
            {'username': 'resp1', 'first_name': 'R', 'last_name': 'One', 'email': 'resp1@example.com',
             'is_superuser': 'on', 'groups': [lgu_group.pk]},  # no is_active => deactivated
        )
        self.assertEqual(response.status_code, 302)
        self.responder.refresh_from_db()
        self.assertFalse(self.responder.is_active)
        self.assertFalse(self.responder.is_superuser)
        self.assertEqual(list(self.responder.groups.values_list('name', flat=True)), [RESPONDER])

    def test_lgu_administrator_can_reset_a_responder_password(self):
        self.login(self.lgu)
        url = reverse('admin:auth_user_password_change', args=[self.responder.pk])
        self.assertEqual(self.client.get(url).status_code, 200)

    def test_accounts_cannot_be_deleted_by_lgu_administrators(self):
        self.login(self.lgu)
        url = reverse('admin:auth_user_delete', args=[self.responder.pk])
        self.assertEqual(self.client.post(url, {'post': 'yes'}).status_code, 403)
        self.assertTrue(User.objects.filter(pk=self.responder.pk).exists())


class ReportAdminTests(AdminTestCase):
    def change_url(self, report):
        return reverse('admin:reports_emergencyreport_change', args=[report.pk])

    def test_changelist_shows_type_status_and_map_link(self):
        self.login(self.responder)
        response = self.client.get(reverse('admin:reports_emergencyreport_changelist'))
        self.assertEqual(response.status_code, 200)
        for text in ('Urgent response', 'Flooded area', 'rc-badge--pending', 'View on map', 'openstreetmap.org'):
            self.assertContains(response, text)

    def test_type_filter_uses_the_message_prefix(self):
        self.login(self.responder)
        response = self.client.get(reverse('admin:reports_emergencyreport_changelist'), {'type': 'urgent'})
        self.assertEqual([r.pk for r in response.context['cl'].result_list], [self.urgent.pk])

    def test_detail_page_renders_without_photos(self):
        self.login(self.responder)
        response = self.client.get(self.change_url(self.urgent))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'No photos attached')

    def test_responder_can_only_change_the_status(self):
        self.login(self.responder)
        response = self.client.post(
            self.change_url(self.urgent), {'status': 'responding', 'message': 'tampered', 'latitude': '1.0'}
        )
        self.assertEqual(response.status_code, 302)
        self.urgent.refresh_from_db()
        self.assertEqual(self.urgent.status, 'responding')
        self.assertEqual(self.urgent.message, '[URGENT RESPONSE] people on the roof')
        self.assertEqual(self.urgent.latitude, 10.67)

    def test_responder_cannot_add_or_delete_reports(self):
        self.login(self.responder)
        self.assertEqual(self.client.get(reverse('admin:reports_emergencyreport_add')).status_code, 403)
        delete_url = reverse('admin:reports_emergencyreport_delete', args=[self.urgent.pk])
        self.assertEqual(self.client.post(delete_url, {'post': 'yes'}).status_code, 403)
        self.assertTrue(EmergencyReport.objects.filter(pk=self.urgent.pk).exists())

    def test_lgu_administrator_can_edit_report_details(self):
        self.login(self.lgu)
        response = self.client.post(
            self.change_url(self.urgent),
            {'status': 'acknowledged', 'message': '[URGENT RESPONSE] corrected details',
             'latitude': '10.68', 'longitude': '122.95', 'accuracy': '', 'device_id': 'd-1'},
        )
        self.assertEqual(response.status_code, 302)
        self.urgent.refresh_from_db()
        self.assertEqual(self.urgent.status, 'acknowledged')
        self.assertEqual(self.urgent.message, '[URGENT RESPONSE] corrected details')

    def test_staff_without_report_permission_is_denied(self):
        self.login(self.plain_staff)
        self.assertEqual(self.client.get(reverse('admin:reports_emergencyreport_changelist')).status_code, 403)


class LiveUpdatesTests(AdminTestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()  # public report submissions are throttled per IP
        self.url = reverse('admin:rc_live_reports')

    def latest_id(self):
        return EmergencyReport.objects.order_by('-id').values_list('id', flat=True).first()

    def test_anonymous_users_are_sent_to_login(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse('admin:login'), response['Location'])

    def test_staff_without_report_access_are_rejected(self):
        self.login(self.plain_staff)
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_only_get_is_allowed(self):
        self.login(self.responder)
        self.assertEqual(self.client.post(self.url).status_code, 405)

    def test_without_after_it_returns_a_baseline_only(self):
        self.login(self.responder)
        data = self.client.get(self.url).json()
        self.assertEqual(data['latest_id'], self.latest_id())
        self.assertEqual(data['reports'], [])
        self.assertEqual(data['new_count'], 0)
        self.assertEqual(data['summary']['counts'],
                         {'pending': 1, 'acknowledged': 0, 'responding': 0, 'resolved': 1})
        self.assertEqual(data['summary']['active'], 1)

    def test_bad_after_values_fall_back_to_the_baseline(self):
        self.login(self.responder)
        for value in ('abc', '-5', ''):
            data = self.client.get(self.url, {'after': value}).json()
            self.assertEqual(data['reports'], [], value)

    def test_nothing_new_returns_no_reports(self):
        self.login(self.responder)
        data = self.client.get(self.url, {'after': self.latest_id()}).json()
        self.assertEqual((data['reports'], data['new_count']), ([], 0))

    def test_new_report_shape(self):
        self.login(self.lgu)
        data = self.client.get(self.url, {'after': self.urgent.pk - 1}).json()
        self.assertEqual(data['new_count'], 2)
        first = data['reports'][0]
        self.assertEqual(first['id'], self.urgent.pk)
        self.assertTrue(first['urgent'])
        self.assertEqual(first['type'], 'Urgent response')
        self.assertEqual(first['message'], 'people on the roof')  # prefix removed
        self.assertEqual(first['status'], 'pending')
        self.assertEqual(first['url'], reverse('admin:reports_emergencyreport_change', args=[self.urgent.pk]))
        self.assertNotIn('device_id', first)

    def test_citizen_submission_shows_up_for_staff_within_one_poll(self):
        from django.test import Client
        self.login(self.responder)
        baseline = self.client.get(self.url).json()

        citizen = Client()  # public, no login
        response = citizen.post('/api/reports/send/', {
            'latitude': '10.7', 'longitude': '122.9', 'message': '[URGENT RESPONSE] roof rescue needed',
            'device_id': 'citizen-1',
        })
        self.assertEqual(response.status_code, 201)

        data = self.client.get(self.url, {'after': baseline['latest_id']}).json()
        self.assertEqual(data['new_count'], 1)
        self.assertEqual(data['reports'][0]['id'], response.json()['id'])
        self.assertTrue(data['reports'][0]['urgent'])
        self.assertEqual(data['summary']['active'], baseline['summary']['active'] + 1)
        self.assertEqual(data['summary']['urgent_active'], baseline['summary']['urgent_active'] + 1)

    def test_large_bursts_are_capped_but_counted(self):
        from .dashboard import LIVE_BATCH
        baseline = self.latest_id()
        EmergencyReport.objects.bulk_create([
            EmergencyReport(latitude=10, longitude=122, message=f'[FLOODED AREA] n{i}', device_id='burst')
            for i in range(LIVE_BATCH + 5)
        ])
        self.login(self.responder)
        data = self.client.get(self.url, {'after': baseline}).json()
        self.assertEqual(data['new_count'], LIVE_BATCH + 5)
        self.assertEqual(len(data['reports']), LIVE_BATCH)
        ids = [r['id'] for r in data['reports']]
        self.assertEqual(ids, sorted(ids))               # oldest first
        self.assertEqual(ids[-1], data['latest_id'])     # the newest report is always included

    def test_citizen_text_is_returned_as_data_not_markup(self):
        payload = '<img src=x onerror=alert(1)>'
        EmergencyReport.objects.create(latitude=1, longitude=1, message=f'[FLOODED AREA] {payload}', device_id='x')
        self.login(self.responder)
        data = self.client.get(self.url, {'after': self.latest_id() - 1}).json()
        self.assertEqual(data['reports'][0]['message'], payload)

    def test_the_script_never_writes_html(self):
        import pathlib
        source = (pathlib.Path(__file__).parent / 'static/rescueconnect/live.js').read_text()
        for forbidden in ('innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval('):
            self.assertNotIn(forbidden, source)

    def test_staff_pages_load_the_live_script_and_bell(self):
        self.login(self.responder)
        response = self.client.get(reverse('admin:index'))
        self.assertContains(response, 'rescueconnect/live.js')
        self.assertContains(response, f'data-endpoint="{self.url}"')
        self.assertContains(response, 'id="rc-bell"')
        self.assertContains(response, 'data-rc-kpi="urgent_active"')
        self.assertContains(response, 'id="rc-recent-body"')

    def test_pages_without_report_access_or_login_have_no_live_script(self):
        self.login(self.plain_staff)
        self.assertNotContains(self.client.get(reverse('admin:index')), 'live.js')
        self.client.logout()
        self.assertNotContains(self.client.get(reverse('admin:login')), 'live.js')
