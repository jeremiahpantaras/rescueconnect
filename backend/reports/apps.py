from django.apps import AppConfig
from django.db.models.signals import post_migrate


class ReportsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'reports'

    def ready(self):
        from .roles import create_role_groups

        # Runs after auth's own post_migrate handler, so the model permissions already exist.
        post_migrate.connect(create_role_groups, sender=self)
