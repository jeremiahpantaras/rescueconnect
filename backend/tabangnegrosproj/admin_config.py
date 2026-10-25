from django.contrib.admin.apps import AdminConfig


class RescueConnectAdminConfig(AdminConfig):
    """Makes RescueConnectAdminSite the project's default admin site (`admin.site`)."""

    default_site = 'tabangnegrosproj.admin_site.RescueConnectAdminSite'
