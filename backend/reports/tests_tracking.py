import re

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import Client, SimpleTestCase, TestCase, TransactionTestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .models import EmergencyReport
from .roles import RESPONDER
from .tracking import (
    ALPHABET, CODE_LENGTH, format_tracking_code, generate_tracking_code, normalize_tracking_code,
)

CODE_PATTERN = re.compile(r'^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$')
PUBLIC_KEYS = {
    'tracking_code', 'report_type', 'report_type_label', 'status', 'status_label', 'submitted_at', 'updated_at',
    'resolved_at',
}


class TrackingCodeFunctionTests(SimpleTestCase):
    def test_generated_codes_use_the_readable_alphabet(self):
        for _ in range(200):
            code = generate_tracking_code()
            self.assertEqual(len(code), CODE_LENGTH)
            self.assertTrue(set(code) <= set(ALPHABET))
        self.assertFalse(set('ILOU') & set(ALPHABET))

    def test_generated_codes_do_not_repeat(self):
        self.assertEqual(len({generate_tracking_code() for _ in range(2000)}), 2000)

    def test_format(self):
        self.assertEqual(format_tracking_code('4F7K9QXM2TBD'), '4F7K-9QXM-2TBD')

    def test_people_can_type_the_code_loosely(self):
        for typed in ('4F7K-9QXM-2TBD', '4f7k-9qxm-2tbd', '4F7K9QXM2TBD', ' 4f7k 9qxm 2tbd ', '4F7K 9QXM-2TBD'):
            self.assertEqual(normalize_tracking_code(typed), '4F7K9QXM2TBD', typed)

    def test_look_alike_letters_are_corrected(self):
        self.assertEqual(normalize_tracking_code('OOIL-0011-ABCD'), '00110011ABCD')
        self.assertEqual(normalize_tracking_code('oOiI-lL00-1111'), '001111001111')

    def test_anything_else_is_rejected(self):
        for bad in (None, '', '1', '4F7K-9QXM', '4F7K-9QXM-2TBD-9', '4F7K-9QXM-2TB!', '../../etc', 'U' * 12):
            self.assertIsNone(normalize_tracking_code(bad), bad)


class StatusApiTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.staff = User.objects.create_user('staff', password='pw-for-tests-123', is_staff=True)
        cls.staff_token = Token.objects.create(user=cls.staff)

    def setUp(self):
        cache.clear()  # throttle counters live in the cache

    def submit(self, message='[URGENT RESPONSE] roof rescue', client=None):
        response = (client or Client()).post('/api/reports/send/', {
            'latitude': '10.69', 'longitude': '122.95', 'message': message, 'device_id': 'citizen-device',
        })
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()

    def status_url(self, code):
        return f'/api/reports/status/{code}/'


class TrackingCodeIssuedTests(StatusApiTestCase):
    def test_submission_returns_a_formatted_code(self):
        created = self.submit()
        self.assertRegex(created['tracking_code'], CODE_PATTERN)
        stored = EmergencyReport.objects.get(id=created['id']).tracking_code
        self.assertEqual(format_tracking_code(stored), created['tracking_code'])

    def test_every_report_gets_a_different_code(self):
        codes = {self.submit()['tracking_code'] for _ in range(5)}
        self.assertEqual(len(codes), 5)

    def test_staff_cannot_change_a_code(self):
        created = self.submit()
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Token {self.staff_token.key}')
        response = client.patch(f"/api/reports/update/{created['id']}/", {'tracking_code': 'AAAA-AAAA-AAAA'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['tracking_code'], created['tracking_code'])


class PublicStatusPageTests(StatusApiTestCase):
    def test_anyone_with_the_code_can_see_the_status_without_logging_in(self):
        created = self.submit()
        response = Client().get(self.status_url(created['tracking_code']))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'pending')
        self.assertEqual(data['status_label'], 'Pending')
        self.assertEqual(data['report_type'], 'urgent_response')
        self.assertEqual(data['report_type_label'], 'Urgent response')
        self.assertEqual(data['tracking_code'], created['tracking_code'])

    def test_only_what_the_citizen_needs_is_exposed(self):
        created = self.submit()
        data = Client().get(self.status_url(created['tracking_code'])).json()
        self.assertEqual(set(data), PUBLIC_KEYS)  # no id, coordinates, message, device id, or photos

    def test_flooded_area_reports_are_labelled(self):
        created = self.submit('[FLOODED AREA] road is under water')
        data = Client().get(self.status_url(created['tracking_code'])).json()
        self.assertEqual((data['report_type'], data['report_type_label']), ('flooded_area', 'Flooded area'))

    def test_the_code_can_be_typed_loosely(self):
        created = self.submit()
        compact = created['tracking_code'].replace('-', '').lower()
        for typed in (compact, created['tracking_code'].lower(), ' ' + compact.upper() + ' '):
            self.assertEqual(Client().get(self.status_url(typed.strip())).status_code, 200, typed)

    def test_unknown_or_malformed_codes_look_the_same(self):
        created = self.submit()
        for code in ('ZZZZ-ZZZZ-ZZZZ', 'short', str(created['id']), '1', 'NOT-A-REAL-CODE', '%2e%2e'):
            response = Client().get(self.status_url(code))
            self.assertEqual(response.status_code, 404, code)
            self.assertIn('error', response.json())

    def test_the_report_id_does_not_work_as_a_code(self):
        created = self.submit()
        self.assertEqual(Client().get(self.status_url(created['id'])).status_code, 404)

    def test_responses_are_never_cached(self):
        created = self.submit()
        response = Client().get(self.status_url(created['tracking_code']))
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_only_get_is_allowed(self):
        created = self.submit()
        self.assertEqual(Client().post(self.status_url(created['tracking_code'])).status_code, 405)

    def test_a_status_change_by_staff_shows_up_on_the_page(self):
        created = self.submit()
        before = Client().get(self.status_url(created['tracking_code'])).json()

        staff = APIClient()
        staff.credentials(HTTP_AUTHORIZATION=f'Token {self.staff_token.key}')
        for new_status in ('acknowledged', 'responding', 'resolved'):
            response = staff.patch(f"/api/reports/{created['id']}/status/", {'status': new_status}, format='json')
            self.assertEqual(response.status_code, 200)
            now = Client().get(self.status_url(created['tracking_code'])).json()
            self.assertEqual(now['status'], new_status)
        self.assertGreater(now['updated_at'], before['updated_at'])
        self.assertEqual(now['submitted_at'], before['submitted_at'])

    def test_a_citizen_cannot_see_someone_elses_report(self):
        mine, theirs = self.submit('[FLOODED AREA] mine'), self.submit('[URGENT RESPONSE] theirs')
        data = Client().get(self.status_url(mine['tracking_code'])).json()
        self.assertEqual(data['report_type'], 'flooded_area')
        self.assertNotEqual(mine['tracking_code'], theirs['tracking_code'])


class ThrottleScopeTests(StatusApiTestCase):
    def test_status_polling_does_not_use_up_the_report_quota(self):
        created = self.submit()
        for _ in range(30):
            self.assertEqual(Client().get(self.status_url(created['tracking_code'])).status_code, 200)
        statuses = [
            Client().post('/api/reports/send/', {
                'latitude': '10.7', 'longitude': '122.9', 'message': f'[FLOODED AREA] report {i}', 'device_id': 'd',
            }).status_code for i in range(10)
        ]
        # 1 report was already submitted above; 9 more fit in the 10/hour allowance, then the limit applies.
        self.assertEqual(statuses[:9], [201] * 9)
        self.assertEqual(statuses[9], 429)

    def test_failed_staff_logins_do_not_use_up_the_report_quota(self):
        for _ in range(8):
            Client().post('/api/reports/auth/login/', {'username': 'nobody', 'password': 'x'})
        for _ in range(10):
            self.submit()  # all ten still fit

    def test_status_checks_have_their_own_generous_limit(self):
        created = self.submit()
        codes = [Client().get(self.status_url(created['tracking_code'])).status_code for _ in range(301)]
        self.assertEqual(codes[:300], [200] * 300)
        self.assertEqual(codes[300], 429)


class AdminTrackingCodeTests(StatusApiTestCase):
    def setUp(self):
        super().setUp()
        User = get_user_model()
        self.responder = User.objects.create_user('resp', password='pw-for-tests-123', is_staff=True)
        self.responder.groups.add(Group.objects.get(name=RESPONDER))
        self.client.force_login(self.responder)

    def test_staff_can_see_the_code_on_the_report(self):
        created = self.submit()
        url = reverse('admin:reports_emergencyreport_change', args=[created['id']])
        response = self.client.get(url)
        self.assertContains(response, created['tracking_code'])

    def test_staff_can_find_a_report_by_the_code_a_citizen_reads_out(self):
        first, second = self.submit('[FLOODED AREA] first'), self.submit('[FLOODED AREA] second')
        changelist = reverse('admin:reports_emergencyreport_changelist')
        for typed in (first['tracking_code'], first['tracking_code'].lower(), first['tracking_code'].replace('-', ' ')):
            response = self.client.get(changelist, {'q': typed})
            self.assertEqual([r.id for r in response.context['cl'].result_list], [first['id']], typed)
        # normal text search still works
        response = self.client.get(changelist, {'q': 'second'})
        self.assertEqual([r.id for r in response.context['cl'].result_list], [second['id']])


class ExistingReportsMigrationTests(TransactionTestCase):
    """Reports submitted before tracking codes existed must each get their own code."""

    migrate_from = [('reports', '0004_alter_emergencyreport_photo1_and_more')]

    def migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def tearDown(self):
        # leave the test database fully migrated for the tests that run after this one
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_every_existing_report_gets_a_unique_code(self):
        old_apps = self.migrate(self.migrate_from)
        OldReport = old_apps.get_model('reports', 'EmergencyReport')
        ids = [
            OldReport.objects.create(latitude=10, longitude=122, message=f'old report {i}', device_id='legacy').pk
            for i in range(25)
        ]

        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())

        codes = list(EmergencyReport.objects.filter(pk__in=ids).values_list('tracking_code', flat=True))
        self.assertEqual(len(codes), 25)
        self.assertEqual(len(set(codes)), 25)
        for code in codes:
            self.assertEqual(normalize_tracking_code(code), code)


class ResolvedAtTests(StatusApiTestCase):
    """The citizen's "Report Resolved" notice needs the real time the report was resolved."""

    def staff_client(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Token {self.staff_token.key}')
        return client

    def set_status(self, report_id, new_status):
        response = self.staff_client().patch(f'/api/reports/{report_id}/status/', {'status': new_status}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def test_open_reports_have_no_resolution_time(self):
        created = self.submit()
        data = Client().get(self.status_url(created['tracking_code'])).json()
        self.assertIsNone(data['resolved_at'])

    def test_marking_resolved_records_the_time_and_the_public_page_shows_it(self):
        created = self.submit()
        self.set_status(created['id'], 'resolved')
        report = EmergencyReport.objects.get(id=created['id'])
        self.assertIsNotNone(report.resolved_at)
        data = Client().get(self.status_url(created['tracking_code'])).json()
        self.assertEqual(data['status'], 'resolved')
        self.assertIsNotNone(data['resolved_at'])
        self.assertGreaterEqual(data['resolved_at'], data['submitted_at'])

    def test_staff_api_exposes_it_read_only(self):
        created = self.submit()
        staff = self.staff_client()
        response = staff.patch(f"/api/reports/update/{created['id']}/", {'resolved_at': '2020-01-01T00:00:00Z'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()['resolved_at'])  # cannot be set by hand

    def test_the_time_does_not_move_when_a_resolved_report_is_edited(self):
        created = self.submit()
        self.set_status(created['id'], 'resolved')
        first = EmergencyReport.objects.get(id=created['id']).resolved_at
        staff = self.staff_client()
        staff.patch(f"/api/reports/update/{created['id']}/", {'message': '[URGENT RESPONSE] corrected details'}, format='json')
        self.set_status(created['id'], 'resolved')  # saving "resolved" again changes nothing
        self.assertEqual(EmergencyReport.objects.get(id=created['id']).resolved_at, first)

    def test_reopening_clears_it_and_resolving_again_sets_a_new_time(self):
        created = self.submit()
        self.set_status(created['id'], 'resolved')
        self.set_status(created['id'], 'responding')
        self.assertIsNone(EmergencyReport.objects.get(id=created['id']).resolved_at)
        self.assertIsNone(Client().get(self.status_url(created['tracking_code'])).json()['resolved_at'])
        self.set_status(created['id'], 'resolved')
        self.assertIsNotNone(EmergencyReport.objects.get(id=created['id']).resolved_at)

    def test_changing_the_status_in_the_django_admin_records_it_too(self):
        created = self.submit()
        User = get_user_model()
        responder = User.objects.create_user('resp-resolve', password='pw-for-tests-123', is_staff=True)
        responder.groups.add(Group.objects.get(name=RESPONDER))
        self.client.force_login(responder)
        response = self.client.post(reverse('admin:reports_emergencyreport_change', args=[created['id']]), {'status': 'resolved'})
        self.assertEqual(response.status_code, 302)
        self.assertIsNotNone(EmergencyReport.objects.get(id=created['id']).resolved_at)

    def test_saving_from_a_shell_or_script_keeps_it_consistent(self):
        report = EmergencyReport.objects.create(latitude=1, longitude=1, message='x', device_id='d', status='resolved')
        self.assertIsNotNone(report.resolved_at)
        report.status = 'pending'
        report.save(update_fields=['status'])  # update_fields given: resolved_at must still be written
        report.refresh_from_db()
        self.assertIsNone(report.resolved_at)


class ResolvedAtMigrationTests(TransactionTestCase):
    """Reports that were already resolved before resolved_at existed get a sensible time."""

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_existing_resolved_reports_are_backfilled(self):
        before = [('reports', '0007_tracking_code_unique')]
        executor = MigrationExecutor(connection)
        executor.migrate(before)
        OldReport = executor.loader.project_state(before).apps.get_model('reports', 'EmergencyReport')
        done = OldReport.objects.create(latitude=1, longitude=1, message='old', device_id='l', status='resolved', tracking_code='AAAAAAAAAAAA')
        open_ = OldReport.objects.create(latitude=1, longitude=1, message='old', device_id='l', status='pending', tracking_code='BBBBBBBBBBBB')

        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())

        done, open_ = EmergencyReport.objects.get(pk=done.pk), EmergencyReport.objects.get(pk=open_.pk)
        self.assertEqual(done.resolved_at, done.updated_at)
        self.assertIsNone(open_.resolved_at)
