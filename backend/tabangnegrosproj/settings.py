from pathlib import Path
import os
from dotenv import load_dotenv
import dj_database_url

# Cloudinary Configuration (for image uploads)
import cloudinary
import cloudinary.uploader
import cloudinary.api



load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# GDAL Configuration for Mac
if os.name == 'posix':
    GDAL_LIBRARY_PATH = '/opt/homebrew/opt/gdal/lib/libgdal.dylib'
    GEOS_LIBRARY_PATH = '/opt/homebrew/opt/geos/lib/libgeos_c.dylib'

SECRET_KEY = os.getenv("SECRET_KEY")

DEBUG = os.getenv("DEBUG", "False") == "True"

def env_list(name, default=""):
    """Read a comma-separated environment variable as a list."""
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]

ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")
if os.getenv("RENDER"):
    ALLOWED_HOSTS += ["tabangnegros.onrender.com", ".onrender.com"]

INSTALLED_APPS = [
    'tabangnegrosproj.admin_config.RescueConnectAdminConfig',  # replaces django.contrib.admin
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'tabangnegrosproj',
    'reports',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Origins that may call the API from a browser. Add more (e.g. a LAN address for phone
# testing or the deployed Next.js site) with the comma-separated CORS_ALLOWED_ORIGINS env var.
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "capacitor://localhost",
    "http://localhost",
    "https://localhost",  # Capacitor Android (androidScheme: https)
] + env_list("CORS_ALLOWED_ORIGINS")

ROOT_URLCONF = 'tabangnegrosproj.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        # templates/ holds the RescueConnect admin overrides and must come first.
        'DIRS': [os.path.join(BASE_DIR, 'templates'), os.path.join(BASE_DIR, 'staticfiles')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'tabangnegrosproj.wsgi.application'

# Database Configuration
if os.getenv("RENDER"):
    DATABASES = {
        'default': dj_database_url.config(
            default=os.getenv('DATABASE_URL'),
            conn_max_age=600
        )
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DB_NAME'),
            'USER': os.getenv('DB_USER'),
            'PASSWORD': os.getenv('DB_PASSWORD'),
            'HOST': os.getenv('DB_HOST'),
            'PORT': os.getenv('DB_PORT'),
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Manila'
# 12-hour clock with AM/PM everywhere (see tabangnegrosproj/formats/en/formats.py)
FORMAT_MODULE_PATH = ['tabangnegrosproj.formats']
USE_I18N = True
USE_TZ = True

# Static files configuration
STATIC_URL = '/static/'  # Changed back to /static/
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Media files configuration (different from STATIC_URL)
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Maximum upload size: 5MB per image
DATA_UPLOAD_MAX_MEMORY_SIZE = 10485760  # 10MB total (2 images)
FILE_UPLOAD_MAX_MEMORY_SIZE = 5242880   # 5MB per image

cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET'),
    secure=True
)

# WhiteNoise configuration
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'
WHITENOISE_USE_FINDERS = True
WHITENOISE_AUTOREFRESH = DEBUG

# Add staticfiles as root for serving (allows serving from root path)
WHITENOISE_ROOT = os.path.join(BASE_DIR, 'staticfiles')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Optional name of the Local Government Unit, shown in the admin header (empty = hidden).
RESCUECONNECT_LGU_NAME = os.getenv('RESCUECONNECT_LGU_NAME', '')

# How often open staff pages in the admin check for new reports (seconds, minimum 3).
RESCUECONNECT_LIVE_POLL_SECONDS = int(os.getenv('RESCUECONNECT_LIVE_POLL_SECONDS', '8'))

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    # Deny by default: only authenticated staff. Public endpoints (report submission,
    # staff login) opt out explicitly in reports/views.py.
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAdminUser',
    ],
}