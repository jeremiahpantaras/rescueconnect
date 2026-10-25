from rest_framework import generics
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from .dashboard import report_type, report_type_key
from .models import EmergencyReport
from .serializers import EmergencyReportSerializer
from .tracking import format_tracking_code, normalize_tracking_code
import math
from django.db import IntegrityError, transaction
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from rest_framework import status
from PIL import Image

MAX_PHOTO_SIZE = 5 * 1024 * 1024  # 5MB per photo
ALLOWED_IMAGE_FORMATS = ('JPEG', 'PNG')
ACTIVE_STATUSES = ['pending', 'acknowledged', 'responding']

# Each throttle needs its own scope: AnonRateThrottle subclasses that share the default 'anon'
# scope share one counter per IP, so status polling or login attempts would eat the report quota.

# Custom throttle for emergency reports
class EmergencyReportThrottle(AnonRateThrottle):
    scope = 'report_submit'
    rate = '10/hour'  # 10 reports per hour per IP

# Limit password guessing on the staff login endpoint
class LoginThrottle(AnonRateThrottle):
    scope = 'staff_login'
    rate = '10/min'

# The status page polls every 3 seconds (20/min per open page) and many phones can share one IP
# (home wifi, mobile carriers), so this must be generous; the tracking code's 60 bits are the real protection
class ReportStatusThrottle(AnonRateThrottle):
    scope = 'report_status'
    rate = '300/min'


def validate_photo(photo, label):
    """Return an error message for an invalid uploaded photo, or None when it is valid."""
    if photo.size > MAX_PHOTO_SIZE:
        return f'{label} exceeds 5MB limit'
    try:
        image_format = Image.open(photo).format
    except Exception:
        return 'Invalid image files'
    finally:
        photo.seek(0)  # leave the stream readable for the storage backend
    if image_format not in ALLOWED_IMAGE_FORMATS:
        return 'Only JPG, JPEG, and PNG formats are allowed'
    return None


# Create new distress report (public: citizens do not log in). Up to two photos are accepted.
class EmergencyReportCreateView(generics.CreateAPIView):
    queryset = EmergencyReport.objects.all()
    serializer_class = EmergencyReportSerializer
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [EmergencyReportThrottle]
    parser_classes = [MultiPartParser, FormParser]

    def create(self, request, *args, **kwargs):
        # A phone that saved the report offline may send it more than once (a reply can be lost on a weak
        # connection). The same client_ref always returns the original report, never a duplicate.
        client_ref = request.data.get('client_ref') or None
        if client_ref:
            existing = EmergencyReport.objects.filter(client_ref=client_ref).first()
            if existing:
                return self.repeat_send(request, existing)

        for field, label in (('photo1', 'Photo 1'), ('photo2', 'Photo 2')):
            photo = request.FILES.get(field)
            if photo is None:
                continue
            error = validate_photo(photo, label)
            if error:
                return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                return super().create(request, *args, **kwargs)
        except IntegrityError:
            # Two sends of the same report raced; the database let only one in.
            existing = EmergencyReport.objects.filter(client_ref=client_ref).first() if client_ref else None
            if existing:
                return self.repeat_send(request, existing)
            raise

    def repeat_send(self, request, existing):
        if existing.device_id != request.data.get('device_id'):
            return Response(
                {'error': 'This submission reference belongs to a different device.'},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)

    def perform_create(self, serializer):
        # Citizens cannot choose a status; every new report starts as pending.
        serializer.save(status='pending')


# Public status check for the citizen who submitted a report. The tracking code is the only credential,
# so only what the citizen needs is returned: no coordinates, message, device id, photos, or report id.
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([ReportStatusThrottle])
def report_status(request, code):
    normalized = normalize_tracking_code(code)
    report = EmergencyReport.objects.filter(tracking_code=normalized).first() if normalized else None
    if report is None:
        return Response(
            {'error': 'We could not find a report with that code. Check it and try again.'},
            status=status.HTTP_404_NOT_FOUND,
        )
    response = Response({
        'tracking_code': format_tracking_code(report.tracking_code),
        'report_type': report_type_key(report.message),
        'report_type_label': report_type(report.message),
        'status': report.status,
        'status_label': report.get_status_display(),
        'submitted_at': report.created_at,
        'updated_at': report.updated_at,
        'resolved_at': report.resolved_at,
    })
    response['Cache-Control'] = 'no-store'  # a stale status would defeat the page
    return response


# The endpoints below require an authenticated staff user (REST_FRAMEWORK default permission).

# Retrieve all reports (for dashboard)
class EmergencyReportListView(generics.ListAPIView):
    queryset = EmergencyReport.objects.all().order_by('-created_at')
    serializer_class = EmergencyReportSerializer

# Update a report (for responders / administrators)
class EmergencyReportUpdateView(generics.UpdateAPIView):
    queryset = EmergencyReport.objects.all()
    serializer_class = EmergencyReportSerializer

# Get active reports
@api_view(['GET'])
def get_active_reports(request):
    """Get all pending/active help requests"""
    active_reports = EmergencyReport.objects.filter(status__in=ACTIVE_STATUSES)
    serializer = EmergencyReportSerializer(active_reports, many=True, context={'request': request})
    return Response(serializer.data)

# Get reports by area
@api_view(['GET'])
def get_reports_by_area(request):
    """Get reports within a certain radius"""
    try:
        lat = float(request.GET.get('lat', 0))
        lng = float(request.GET.get('lng', 0))
        radius_km = float(request.GET.get('radius', 50))  # default 50km
    except (TypeError, ValueError):
        return Response({'error': 'lat, lng and radius must be numbers'}, status=status.HTTP_400_BAD_REQUEST)

    if not all(math.isfinite(value) for value in (lat, lng, radius_km)):
        return Response({'error': 'lat, lng and radius must be finite numbers'}, status=status.HTTP_400_BAD_REQUEST)
    if not -90 <= lat <= 90 or not -180 <= lng <= 180:
        return Response({'error': 'Invalid latitude or longitude'}, status=status.HTTP_400_BAD_REQUEST)
    if radius_km <= 0:
        return Response({'error': 'radius must be greater than 0'}, status=status.HTTP_400_BAD_REQUEST)

    # Simple bounding box calculation
    # For more accuracy, use Haversine formula
    lat_range = radius_km / 111  # 1 degree ≈ 111km
    lng_range = radius_km / (111 * abs(math.cos(math.radians(lat))))

    reports = EmergencyReport.objects.filter(
        latitude__range=(lat - lat_range, lat + lat_range),
        longitude__range=(lng - lng_range, lng + lng_range),
        status__in=ACTIVE_STATUSES
    )

    serializer = EmergencyReportSerializer(reports, many=True, context={'request': request})
    return Response(serializer.data)

# Update report status
@api_view(['PATCH'])
def update_report_status(request, report_id):
    """Update report status"""
    new_status = request.data.get('status')
    valid_statuses = [value for value, _ in EmergencyReport.STATUS_CHOICES]
    if new_status not in valid_statuses:
        return Response(
            {'error': f"status must be one of: {', '.join(valid_statuses)}"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        report = EmergencyReport.objects.get(id=report_id)
    except EmergencyReport.DoesNotExist:
        return Response({'error': 'Report not found'}, status=status.HTTP_404_NOT_FOUND)

    report.status = new_status
    report.save(update_fields=['status', 'updated_at'])
    serializer = EmergencyReportSerializer(report, context={'request': request})
    return Response(serializer.data)

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def admin_login(request):
    """Admin login endpoint"""
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response(
            {'error': 'Username and password required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = authenticate(username=username, password=password)

    if user is not None and user.is_staff:
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'username': user.username
        })

    return Response(
        {'error': 'Invalid credentials or not an admin'},
        status=status.HTTP_401_UNAUTHORIZED
    )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_logout(request):
    """Admin logout endpoint"""
    request.user.auth_token.delete()
    return Response({'message': 'Logged out successfully'})
