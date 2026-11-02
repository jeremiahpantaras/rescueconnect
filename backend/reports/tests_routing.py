"""The backend must not serve the retired TabangNegros app, and browsers holding its old worker must recover."""
from django.conf import settings
from django.test import TestCase
from pathlib import Path


class RoutingTests(TestCase):
    def test_home_goes_to_the_staff_portal(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response['Location'], '/admin/')

    def test_admin_without_a_slash_reaches_the_admin(self):
        # The old catch-all answered this address with the Tabang Negros page.
        response = self.client.get('/admin')
        self.assertEqual(response.status_code, 301)
        self.assertEqual(response['Location'], '/admin/')

    def test_the_login_page_is_rescueconnect(self):
        response = self.client.get('/admin/login/')
        self.assertContains(response, 'RescueConnect')
        self.assertNotContains(response, 'Tabang')

    def test_unknown_addresses_are_not_found(self):
        for path in ('/no/such/page', '/report', '/api/reports/nope/', '/api/nope'):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 404, path)
            self.assertNotContains(response, 'Tabang', status_code=404)


class RetiredWorkerTests(TestCase):
    """Browsers check /sw.js for updates by themselves; this file is what repairs them."""

    def test_the_worker_address_serves_the_removal_script(self):
        response = self.client.get('/sw.js')
        self.assertEqual(response.status_code, 200)
        self.assertIn('javascript', response['Content-Type'])
        body = b''.join(response.streaming_content).decode('utf-8')
        self.assertIn('registration.unregister()', body)

    def test_the_removal_script_keeps_nothing_of_the_old_worker(self):
        source = (Path(settings.BASE_DIR) / 'staticfiles' / 'sw.js').read_text(encoding='utf-8')
        code = source.split('*/', 1)[1]  # the header comment describes the old behaviour
        for old in ('NavigationRoute', 'precacheAndRoute', 'importScripts', "addEventListener('fetch'"):
            self.assertNotIn(old, code)
