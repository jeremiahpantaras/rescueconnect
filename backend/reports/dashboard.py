"""Read-only helpers for the admin dashboard, report list, and live updates."""
from datetime import timedelta

from django.db.models import Count
from django.urls import reverse
from django.utils import formats, timezone

from .models import EmergencyReport

FLOOD_PREFIX = '[FLOODED AREA]'
URGENT_PREFIX = '[URGENT RESPONSE]'
ACTIVE_STATUSES = ('pending', 'acknowledged', 'responding')
LIVE_BATCH = 20  # most new reports returned per poll; new_count still reports the true number


def report_type(message):
    """Report type label. The type is only stored as a message prefix (no model field yet)."""
    if message.startswith(URGENT_PREFIX):
        return 'Urgent response'
    if message.startswith(FLOOD_PREFIX):
        return 'Flooded area'
    return 'Unspecified'


def report_type_key(message):
    """Machine-readable report type (for the public status API)."""
    if message.startswith(URGENT_PREFIX):
        return 'urgent_response'
    if message.startswith(FLOOD_PREFIX):
        return 'flooded_area'
    return 'unspecified'


def short_message(message, limit=80):
    """Message without its report-type prefix, shortened for lists and notifications."""
    text = message
    for prefix in (URGENT_PREFIX, FLOOD_PREFIX):
        if text.startswith(prefix):
            text = text[len(prefix):]
    text = text.strip()
    return (text[:limit] + '…') if len(text) > limit else (text or '—')


def summary():
    """Report counts shown on the dashboard KPIs and status cards."""
    reports = EmergencyReport.objects.order_by()
    counts = dict(reports.values_list('status').annotate(n=Count('id')))
    return {
        'total': sum(counts.values()),
        'active': sum(counts.get(status, 0) for status in ACTIVE_STATUSES),
        'last_24h': reports.filter(created_at__gte=timezone.now() - timedelta(hours=24)).count(),
        'urgent_active': reports.filter(
            status__in=ACTIVE_STATUSES, message__startswith=URGENT_PREFIX
        ).count(),
        'counts': {value: counts.get(value, 0) for value, _ in EmergencyReport.STATUS_CHOICES},
    }


def build_dashboard():
    stats = summary()
    changelist = reverse('admin:reports_emergencyreport_changelist')

    status_cards = [
        {
            'key': value,
            'label': label,
            'count': stats['counts'][value],
            'url': f'{changelist}?status__exact={value}',
        }
        for value, label in EmergencyReport.STATUS_CHOICES
    ]
    recent = [
        {
            'id': report.id,
            'type': report_type(report.message),
            'status': report.status,
            'status_label': report.get_status_display(),
            'created_at': report.created_at,
            'url': reverse('admin:reports_emergencyreport_change', args=[report.id]),
        }
        for report in EmergencyReport.objects.order_by('-created_at')[:8]
    ]
    return {
        'total': stats['total'],
        'active': stats['active'],
        'last_24h': stats['last_24h'],
        'urgent_active': stats['urgent_active'],
        'status_cards': status_cards,
        'recent': recent,
        'changelist_url': changelist,
    }


def describe_delay(delta):
    """'2 hr 15 min', '45 min', '1 day 3 hr' for a timedelta."""
    minutes = int(delta.total_seconds() // 60)
    days, rest = divmod(minutes, 1440)
    hours, mins = divmod(rest, 60)
    if days:
        return f"{days} day{'s' if days != 1 else ''}" + (f' {hours} hr' if hours else '')
    if hours:
        return f'{hours} hr' + (f' {mins} min' if mins else '')
    return f'{mins} min'


# Reports made at least this long before they were received were saved on the citizen's phone first.
LATE_REPORT_AFTER = timedelta(minutes=5)


def late_note(report):
    if report.reported_at and report.created_at - report.reported_at >= LATE_REPORT_AFTER:
        return (
            "Saved on the citizen's phone and sent late: made "
            f'{describe_delay(report.created_at - report.reported_at)} before it was received.'
        )
    return ''


def _live_item(report):
    return {
        'id': report.id,
        'type': report_type(report.message),
        'urgent': report.message.startswith(URGENT_PREFIX),
        'status': report.status,
        'status_label': report.get_status_display(),
        'message': short_message(report.message, limit=120),
        'note': late_note(report),
        'created_label': formats.date_format(timezone.localtime(report.created_at), 'M j, Y g:i A'),
        'url': reverse('admin:reports_emergencyreport_change', args=[report.id]),
    }


def live_snapshot(after_id=None):
    """What staff pages poll for.

    Without `after_id` it only reports the newest id (a baseline, nothing is "new").
    With it, it returns reports created after that id (newest LIVE_BATCH, oldest first).
    """
    latest_id = EmergencyReport.objects.order_by('-id').values_list('id', flat=True).first() or 0
    reports, new_count = [], 0
    if after_id is not None and latest_id > after_id:
        newer = EmergencyReport.objects.filter(id__gt=after_id)
        new_count = newer.count()
        reports = [_live_item(report) for report in reversed(list(newer.order_by('-id')[:LIVE_BATCH]))]
    return {'latest_id': latest_id, 'new_count': new_count, 'reports': reports, 'summary': summary()}
