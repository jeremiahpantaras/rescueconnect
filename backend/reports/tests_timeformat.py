"""The whole system shows times on the 12-hour clock with AM/PM, never 24-hour."""
import datetime
import re
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from django.urls import reverse
from django.utils import formats

from .models import EmergencyReport
from .roles import LGU_ADMIN

User = get_user_model()
MANILA = ZoneInfo('Asia/Manila')

# A time like 10:15 or 22:15 that is NOT followed by AM/PM (visible text only).
BARE_CLOCK = re.compile(r'\b\d{1,2}:\d{2}(?::\d{2})?\b(?!\s?[AaPp]\.?[Mm])')


def visible_text(html):
    html = re.sub(r'(?is)<(script|style).*?</\1>', ' ', html)
    return re.sub(r'<[^>]+>', ' ', html)


class TwelveHourClockTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.lgu = User.objects.create_user('lgu-time', password='pw-for-tests-123', is_staff=True)
        cls.lgu.groups.add(Group.objects.get(name=LGU_ADMIN))
        cls.report = EmergencyReport.objects.create(
            latitude=10.67, longitude=122.95, message='[URGENT RESPONSE] water rising', device_id='d',
        )
        # 10:15 PM in Manila: a 24-hour display would read 22:15
        cls.evening = datetime.datetime(2026, 10, 25, 22, 15, 33, tzinfo=MANILA)
        EmergencyReport.objects.filter(pk=cls.report.pk).update(created_at=cls.evening, updated_at=cls.evening)

    def setUp(self):
        self.client.force_login(self.lgu)

    def assert_twelve_hour(self, response, expect='10:15'):
        text = visible_text(response.content.decode())
        self.assertIn(f'{expect} PM', text)
        self.assertNotIn('22:15', text)
        self.assertEqual(BARE_CLOCK.findall(text), [], 'a time without AM/PM was shown')

    def test_system_formats_are_twelve_hour(self):
        self.assertEqual(formats.date_format(self.evening, 'DATETIME_FORMAT'), 'Oct. 25, 2026, 10:15 PM')
        self.assertEqual(formats.date_format(self.evening, 'TIME_FORMAT'), '10:15 PM')
        self.assertEqual(formats.date_format(self.evening, 'SHORT_DATETIME_FORMAT'), '10/25/2026 10:15 PM')
        self.assertIn('%p', formats.get_format('TIME_INPUT_FORMATS')[0])
        self.assertIn('%p', formats.get_format('DATETIME_INPUT_FORMATS')[0])

    def test_dashboard_recent_reports(self):
        self.assert_twelve_hour(self.client.get(reverse('admin:index')))

    def test_report_list_and_detail(self):
        self.assert_twelve_hour(self.client.get(reverse('admin:reports_emergencyreport_changelist')))
        self.assert_twelve_hour(
            self.client.get(reverse('admin:reports_emergencyreport_change', args=[self.report.pk]))
        )

    def test_live_notification_label(self):
        data = self.client.get(reverse('admin:rc_live_reports'), {'after': self.report.pk - 1}).json()
        self.assertEqual(data['reports'][0]['created_label'], 'Oct 25, 2026 10:15 PM')

    def test_account_pages_show_login_times_in_twelve_hour_and_have_no_clock_inputs(self):
        User.objects.filter(pk=self.lgu.pk).update(last_login=self.evening)
        response = self.client.get(reverse('admin:auth_user_change', args=[self.lgu.pk]))
        # an LGU administrator only manages Responders, so use a superuser to open an LGU account
        superuser = User.objects.create_superuser('root-time', 'r@example.com', 'pw-for-tests-123')
        self.client.force_login(superuser)
        response = self.client.get(reverse('admin:auth_user_change', args=[self.lgu.pk]))
        self.assertEqual(response.status_code, 200)
        self.assert_twelve_hour(response)
        self.assertNotContains(response, 'id_last_login_0')   # no editable 24-hour time boxes
        self.assertNotContains(response, 'id_date_joined_0')
