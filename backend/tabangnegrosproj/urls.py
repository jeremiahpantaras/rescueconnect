from django.contrib import admin
from django.urls import path, include, re_path
from django.http import JsonResponse
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView
from django.views.static import serve

def health_check(request):
    return JsonResponse({"status": "ok", "service": "RescueConnect API"})

# Admin branding (header, title, dashboard) lives in tabangnegrosproj/admin_site.py.

urlpatterns = [
    # The backend has no public pages of its own; the citizen app is the Next.js frontend.
    path('', RedirectView.as_view(pattern_name='admin:index')),
    path('admin/', admin.site.urls),
    path('api/reports/', include('reports.urls')),
    path('health/', health_check),
    
    # Serve media files (uploaded photos) - works in production too
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]

# Development-specific settings
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
