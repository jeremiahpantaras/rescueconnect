from io import BytesIO
from unittest import mock

import cloudinary
from cloudinary import CloudinaryResource
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import EmergencyReport


def make_image(image_format='PNG', name='photo.png', content_type='image/png'):
    buffer = BytesIO()
    Image.new('RGB', (4, 4), 'blue').save(buffer, format=image_format)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=content_type)


def fake_upload_resource(file, **options):
    return CloudinaryResource(public_id='test-photo', version='1', format='png', type='upload', resource_type='image')


class ReportAPITestCase(APITestCase):
    def setUp(self):
        cache.clear()  # throttle counters live in the cache
        user_model = get_user_model()
        self.staff = user_model.objects.create_user('staff', password='pw-for-tests-123', is_staff=True)
        self.citizen_user = user_model.objects.create_user('plain', password='pw-for-tests-123')
        self.staff_token = Token.objects.create(user=self.staff)
        self.plain_token = Token.objects.create(user=self.citizen_user)
        self.report = EmergencyReport.objects.create(
            latitude=10.67, longitude=122.95, message='[FLOODED AREA] road flooded', device_id='device-1'
        )

    def as_staff(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.staff_token.key}')

    def as_non_staff(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.plain_token.key}')


class ProtectedEndpointTests(ReportAPITestCase):
    def protected_requests(self):
        return [
            ('get', '/api/reports/all/'),
            ('get', '/api/reports/active/'),
            ('get', '/api/reports/nearby/?lat=10.67&lng=122.95'),
            ('patch', f'/api/reports/{self.report.id}/status/'),
            ('patch', f'/api/reports/update/{self.report.id}/'),
            ('put', f'/api/reports/update/{self.report.id}/'),
        ]

    def test_anonymous_users_are_rejected(self):
        for method, url in self.protected_requests():
            response = getattr(self.client, method)(url, {'status': 'resolved'})
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED, f'{method} {url}')
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, 'pending')

    def test_non_staff_users_are_rejected(self):
        self.as_non_staff()
        for method, url in self.protected_requests():
            response = getattr(self.client, method)(url, {'status': 'resolved'})
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, f'{method} {url}')

    def test_staff_can_list_reports(self):
        self.as_staff()
        for url in ('/api/reports/all/', '/api/reports/active/', '/api/reports/nearby/?lat=10.67&lng=122.95'):
            response = self.client.get(url)
            self.assertEqual(response.status_code, status.HTTP_200_OK, url)
            self.assertEqual(len(response.data), 1, url)

    def test_staff_can_update_status(self):
        self.as_staff()
        response = self.client.patch(f'/api/reports/{self.report.id}/status/', {'status': 'acknowledged'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, 'acknowledged')

    def test_invalid_status_is_rejected(self):
        self.as_staff()
        for payload in ({'status': 'banana'}, {}):
            response = self.client.patch(f'/api/reports/{self.report.id}/status/', payload)
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, payload)
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, 'pending')

    def test_status_update_of_missing_report_is_404(self):
        self.as_staff()
        response = self.client.patch('/api/reports/999999/status/', {'status': 'resolved'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_nearby_rejects_bad_parameters(self):
        self.as_staff()
        for query in ('lat=abc&lng=1', 'lat=91&lng=1', 'lat=1&lng=181', 'lat=1&lng=1&radius=0',
                      'lat=1&lng=1&radius=-5', 'lat=nan&lng=1', 'lat=1&lng=1&radius=inf'):
            response = self.client.get(f'/api/reports/nearby/?{query}')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, query)


class CreateReportTests(ReportAPITestCase):
    url = '/api/reports/send/'

    def payload(self, **overrides):
        data = {'latitude': '10.67', 'longitude': '122.95', 'message': '[URGENT RESPONSE] help', 'device_id': 'd-1'}
        data.update(overrides)
        return data

    def test_anonymous_citizen_can_submit_without_photos(self):
        response = self.client.post(self.url, self.payload(), format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['status'], 'pending')

    def test_invalid_token_does_not_block_public_submission(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token not-a-real-token')
        response = self.client.post(self.url, self.payload(), format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_status_cannot_be_chosen_by_the_citizen(self):
        response = self.client.post(self.url, self.payload(status='resolved'), format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(EmergencyReport.objects.get(id=response.data['id']).status, 'pending')

    def test_invalid_coordinates_are_rejected(self):
        for overrides in ({'latitude': '95'}, {'longitude': '-200'}, {'latitude': 'abc'}):
            response = self.client.post(self.url, self.payload(**overrides), format='multipart')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, overrides)

    def test_short_message_is_rejected(self):
        response = self.client.post(self.url, self.payload(message='ab'), format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_image_upload_is_rejected(self):
        bogus = SimpleUploadedFile('photo.png', b'not an image', content_type='image/png')
        response = self.client.post(self.url, self.payload(photo1=bogus), format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(EmergencyReport.objects.count(), 1)

    def test_unsupported_image_format_is_rejected(self):
        gif = make_image('GIF', 'photo.gif', 'image/gif')
        response = self.client.post(self.url, self.payload(photo2=gif), format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('JPG', response.data['error'])

    def test_oversized_image_is_rejected(self):
        with mock.patch('reports.views.MAX_PHOTO_SIZE', 10):
            response = self.client.post(self.url, self.payload(photo1=make_image()), format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('5MB', response.data['error'])

    def test_one_and_two_photos_are_accepted(self):
        # Cloudinary is mocked so no network upload happens.
        with mock.patch('cloudinary.uploader.upload_resource', side_effect=fake_upload_resource) as upload, \
                mock.patch.object(cloudinary.config(), 'cloud_name', 'test-cloud', create=True):
            one = self.client.post(self.url, self.payload(photo1=make_image()), format='multipart')
            two = self.client.post(
                self.url,
                self.payload(photo1=make_image(), photo2=make_image('JPEG', 'photo.jpg', 'image/jpeg')),
                format='multipart',
            )
        self.assertEqual(one.status_code, status.HTTP_201_CREATED, one.data)
        self.assertEqual(two.status_code, status.HTTP_201_CREATED, two.data)
        self.assertEqual(upload.call_count, 3)

    def test_submission_is_throttled(self):
        statuses = [
            self.client.post(self.url, self.payload(), format='multipart').status_code for _ in range(11)
        ]
        self.assertEqual(statuses[:10], [status.HTTP_201_CREATED] * 10)
        self.assertEqual(statuses[10], status.HTTP_429_TOO_MANY_REQUESTS)


class AuthTests(ReportAPITestCase):
    def test_staff_login_returns_token(self):
        response = self.client.post('/api/reports/auth/login/', {'username': 'staff', 'password': 'pw-for-tests-123'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['token'], self.staff_token.key)

    def test_non_staff_and_bad_credentials_cannot_log_in(self):
        for username, password in (('plain', 'pw-for-tests-123'), ('staff', 'wrong'), ('nobody', 'x')):
            response = self.client.post('/api/reports/auth/login/', {'username': username, 'password': password})
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED, username)

    def test_login_requires_both_fields(self):
        response = self.client.post('/api/reports/auth/login/', {'username': 'staff'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_is_throttled(self):
        codes = [
            self.client.post('/api/reports/auth/login/', {'username': 'staff', 'password': 'wrong'}).status_code
            for _ in range(11)
        ]
        self.assertEqual(codes[-1], status.HTTP_429_TOO_MANY_REQUESTS)

    def test_logout_deletes_token_and_requires_authentication(self):
        self.assertEqual(self.client.post('/api/reports/auth/logout/').status_code, status.HTTP_401_UNAUTHORIZED)
        self.as_staff()
        self.assertEqual(self.client.post('/api/reports/auth/logout/').status_code, status.HTTP_200_OK)
        self.assertFalse(Token.objects.filter(user=self.staff).exists())
