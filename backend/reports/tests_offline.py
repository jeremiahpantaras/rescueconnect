"""Store-and-forward: a report saved on the citizen's phone may be sent more than once, and late."""
from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from .dashboard import describe_delay, late_note, live_snapshot
from .models import EmergencyReport
from .roles import RESPONDER

REF = '3f0c2c8e-6a53-4d57-9d0e-3f2b1f6c9a10'


class RepeatSendTests(TestCase):
    def setUp(self):
        cache.clear()  # throttle counters live in the cache

    def send(self, **overrides):
        data = {
            'latitude': '10.69', 'longitude': '122.95', 'message': '[URGENT RESPONSE] roof rescue',
            'device_id': 'device-A', 'client_ref': REF,
        }
        data.update(overrides)
        data = {key: value for key, value in data.items() if value is not None}
        return Client().post('/api/reports/send/', data)

    def test_first_send_creates_the_report(self):
        response = self.send()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(EmergencyReport.objects.get().client_ref, REF)

    def test_sending_again_returns_the_same_report_not_a_duplicate(self):
        first = self.send().json()
        again = self.send()
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.json()['id'], first['id'])
        self.assertEqual(again.json()['tracking_code'], first['tracking_code'])
        self.assertEqual(EmergencyReport.objects.count(), 1)

    def test_a_repeat_send_ignores_the_new_content(self):
        self.send()
        self.send(message='[FLOODED AREA] something else entirely', latitude='1')
        report = EmergencyReport.objects.get()
        self.assertEqual(report.message, '[URGENT RESPONSE] roof rescue')
        self.assertEqual(report.latitude, 10.69)

    def test_the_same_reference_from_another_device_is_refused(self):
        self.send()
        response = self.send(device_id='device-B')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(EmergencyReport.objects.count(), 1)

    def test_the_reference_is_never_returned(self):
        self.assertNotIn('client_ref', self.send().json())
        self.assertNotIn('client_ref', self.send().json())

    def test_malformed_references_are_rejected(self):
        for bad in ('short', 'has spaces in it here', 'x' * 65, '<script>alert(1)</script>'):
            self.assertEqual(self.send(client_ref=bad).status_code, 400, bad)
        self.assertEqual(EmergencyReport.objects.count(), 0)

    def test_without_a_reference_every_send_is_a_new_report(self):
        self.assertEqual(self.send(client_ref=None).status_code, 201)
        self.assertEqual(self.send(client_ref=None).status_code, 201)
        self.assertEqual(self.send(client_ref='').status_code, 201)
        self.assertEqual(EmergencyReport.objects.count(), 3)

    def test_two_sends_racing_still_produce_one_report(self):
        # The other send has already committed its row, but this request's first lookup misses it
        # (the timing of a real race). The insert then hits the database's unique rule, and the view
        # must answer with the original report instead of failing.
        original = EmergencyReport.objects.create(
            latitude=10.69, longitude=122.95, message='[URGENT RESPONSE] roof rescue',
            device_id='device-A', client_ref=REF,
        )
        real_filter = EmergencyReport.objects.filter
        lookups = []

        def first_lookup_misses(*args, **kwargs):
            lookups.append(kwargs)
            return EmergencyReport.objects.none() if len(lookups) == 1 else real_filter(*args, **kwargs)

        with mock.patch.object(EmergencyReport.objects, 'filter', side_effect=first_lookup_misses):
            response = self.send()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['id'], original.id)
        self.assertEqual(EmergencyReport.objects.count(), 1)


class ReportedAtTests(TestCase):
    def setUp(self):
        cache.clear()

    def send(self, reported_at):
        data = {'latitude': '10.69', 'longitude': '122.95', 'message': '[FLOODED AREA] water', 'device_id': 'd'}
        if reported_at is not None:
            data['reported_at'] = reported_at
        response = Client().post('/api/reports/send/', data)
        self.assertEqual(response.status_code, 201, response.content)
        return EmergencyReport.objects.get(pk=response.json()['id'])

    def test_a_sensible_device_time_is_kept(self):
        made = timezone.now() - timedelta(hours=2)
        self.assertEqual(self.send(made.isoformat()).reported_at, made)

    def test_clock_nonsense_is_ignored_but_never_rejects_the_report(self):
        future = (timezone.now() + timedelta(days=3)).isoformat()
        ancient = (timezone.now() - timedelta(days=60)).isoformat()
        for bad in (future, ancient, 'not a time', '0000-00-00T99:99:99Z', '2026-13-45'):
            self.assertIsNone(self.send(bad).reported_at, bad)

    def test_it_is_optional(self):
        self.assertIsNone(self.send(None).reported_at)

    def test_it_is_not_returned_by_the_api(self):
        response = Client().post('/api/reports/send/', {
            'latitude': '1', 'longitude': '1', 'message': '[FLOODED AREA] water', 'device_id': 'd',
            'reported_at': timezone.now().isoformat(),
        })
        self.assertNotIn('reported_at', response.json())


class LateReportNoteTests(TestCase):
    def make(self, delay):
        created = timezone.now()
        report = EmergencyReport.objects.create(latitude=1, longitude=1, message='[URGENT RESPONSE] x', device_id='d')
        report.created_at = created
        report.reported_at = None if delay is None else created - delay
        return report

    def test_describing_delays(self):
        self.assertEqual(describe_delay(timedelta(minutes=45)), '45 min')
        self.assertEqual(describe_delay(timedelta(hours=2, minutes=15)), '2 hr 15 min')
        self.assertEqual(describe_delay(timedelta(hours=3)), '3 hr')
        self.assertEqual(describe_delay(timedelta(days=1, hours=3)), '1 day 3 hr')
        self.assertEqual(describe_delay(timedelta(days=2)), '2 days')

    def test_only_reports_that_were_actually_late_get_a_note(self):
        self.assertEqual(late_note(self.make(None)), '')
        self.assertEqual(late_note(self.make(timedelta(seconds=40))), '')
        self.assertEqual(late_note(self.make(timedelta(minutes=4, seconds=59))), '')
        note = late_note(self.make(timedelta(hours=2, minutes=15)))
        self.assertIn('2 hr 15 min', note)
        self.assertIn('phone', note)

    def test_staff_live_updates_carry_the_note(self):
        baseline = live_snapshot()['latest_id']
        made = timezone.now() - timedelta(hours=1, minutes=30)
        report = EmergencyReport.objects.create(
            latitude=1, longitude=1, message='[URGENT RESPONSE] help', device_id='d', reported_at=made,
        )
        EmergencyReport.objects.filter(pk=report.pk).update(reported_at=made)
        fresh = EmergencyReport.objects.create(latitude=1, longitude=1, message='[FLOODED AREA] y', device_id='d')
        items = live_snapshot(baseline)['reports']
        self.assertIn('1 hr 30 min', items[0]['note'])
        self.assertEqual(items[1]['note'], '')

    def test_admin_shows_when_the_citizen_made_the_report(self):
        user = get_user_model().objects.create_user('resp-late', password='pw-for-tests-123', is_staff=True)
        user.groups.add(Group.objects.get(name=RESPONDER))
        made = timezone.now() - timedelta(hours=3)
        report = EmergencyReport.objects.create(
            latitude=1, longitude=1, message='[FLOODED AREA] z', device_id='d', reported_at=made,
        )
        self.client.force_login(user)
        response = self.client.get(reverse('admin:reports_emergencyreport_change', args=[report.pk]))
        self.assertContains(response, 'Reported at')
