from django.conf import settings
from django.contrib.admin import AdminSite
from django.http import HttpResponseNotAllowed, JsonResponse
from django.urls import path

from reports.dashboard import build_dashboard, live_snapshot


class RescueConnectAdminSite(AdminSite):
    site_header = 'RescueConnect'
    site_title = 'RescueConnect Admin Portal'
    index_title = 'Operations Dashboard'
    site_url = None  # hide "View site": "/" would serve the retired Vite app, not RescueConnect

    def each_context(self, request):
        context = super().each_context(request)
        # Optional: set RESCUECONNECT_LGU_NAME to show the LGU's name in the header.
        context['rc_lgu_name'] = getattr(settings, 'RESCUECONNECT_LGU_NAME', '')
        context['rc_live_interval_ms'] = max(3, getattr(settings, 'RESCUECONNECT_LIVE_POLL_SECONDS', 8)) * 1000
        return context

    def get_urls(self):
        live = path('live-reports/', self.admin_view(self.live_reports), name='rc_live_reports')
        return [live] + super().get_urls()

    def live_reports(self, request):
        """JSON polled by staff pages (see static/rescueconnect/live.js). Staff with report access only."""
        if request.method != 'GET':
            return HttpResponseNotAllowed(['GET'])
        if not request.user.has_perm('reports.view_emergencyreport'):
            return JsonResponse({'error': 'You do not have access to reports.'}, status=403)
        try:
            after = int(request.GET['after'])
        except (KeyError, ValueError):
            after = None
        if after is not None and after < 0:
            after = None
        return JsonResponse(live_snapshot(after))

    def index(self, request, extra_context=None):
        extra_context = dict(extra_context or {})
        if request.user.has_perm('reports.view_emergencyreport'):
            extra_context['rc_dashboard'] = build_dashboard()
        return super().index(request, extra_context)
