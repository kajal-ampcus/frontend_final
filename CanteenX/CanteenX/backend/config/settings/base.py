import os
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent.parent

DEBUG = True

SECRET_KEY = os.getenv("SECRET_KEY")

ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    'django_filters',

    "rest_framework",
    "corsheaders",

    # apps
    "apps.cms",
    "apps.accounts",
    "apps.common",
    "apps.notifications",
    
]

ROOT_URLCONF = "config.urls"


MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",

    "django.contrib.auth.middleware.AuthenticationMiddleware",   
    "django.contrib.messages.middleware.MessageMiddleware",      


    "apps.common.middleware.TenantContextMiddleware",
]

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOWED_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")



TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

STATIC_URL = "/static/"

STATIC_ROOT = BASE_DIR / "staticfiles"   
STATICFILES_DIRS = []                   

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"




DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME"),
        "USER": os.getenv("DB_USER"),
        "PASSWORD": os.getenv("DB_PASSWORD"),
        "HOST": os.getenv("DB_HOST"),
        "PORT": os.getenv("DB_PORT"),
    }
}



# DRF
REST_FRAMEWORK = {
    # simplejwt handles Employee / Admin tokens.
    # Device tokens (Kitchen / Counter) also use simplejwt AccessToken,
    # so JWTAuthentication handles both — the role claim distinguishes them.
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
 
    # Default: deny all. Every endpoint must explicitly grant access
    # 'DEFAULT_PERMISSION_CLASSES': [
    #     'rest_framework.permissions.IsAuthenticated',
    # ],
 
    # 'DEFAULT_THROTTLE_CLASSES': [
    #     'rest_framework.throttling.AnonRateThrottle',
    #     'rest_framework.throttling.UserRateThrottle',
    # ],
    # 'DEFAULT_THROTTLE_RATES': {
    #     'anon': '20/min',
    #     'user': '100/min',
    # },
}


AUTH_USER_MODEL = 'accounts.User'

def _env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}

def _env_int(name, default):
    value = os.getenv(name)
    if value is None or str(value).strip() == '':
        return default
    return int(value)

# SMTP Email configuration
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.getenv("EMAIL_HOST") or os.getenv("SMTP_HOST", "")
EMAIL_PORT = _env_int("EMAIL_PORT", _env_int("SMTP_PORT", 587))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER") or os.getenv("SMTP_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD") or os.getenv("SMTP_PASS", "")
EMAIL_USE_TLS = _env_bool("EMAIL_USE_TLS", default=True)
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "no-reply@example.com")
EMPLOYEE_LOGIN_URL = os.getenv("EMPLOYEE_LOGIN_URL", "")
ADMIN_EMAIL = [email.strip() for email in os.getenv("ADMIN_EMAIL", "").split(",") if email.strip()]
REPORT_EMAIL = [email.strip() for email in os.getenv("REPORT_EMAIL", "").split(",") if email.strip()]






# ──────────────────────────────────────────────────────────────────────────────
# simplejwt — token lifetimes and signing
# ──────────────────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    # Employee / Admin token lifetimes
    'ACCESS_TOKEN_LIFETIME':  timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
 
    # Rotate refresh tokens on use — old refresh is invalidated
    'ROTATE_REFRESH_TOKENS':  True,
    'BLACKLIST_AFTER_ROTATION': False,   # Set True in Phase 2 with blacklist app
 
    # Device tokens are built with AccessToken() and .set_exp(timedelta(hours=8))
    # in device_auth.py — no separate setting needed here.
 
    # Separate signing key for JWTs — never the same as SECRET_KEY
    'SIGNING_KEY': os.getenv("JWT_SECRET_KEY", SECRET_KEY),       
    
    'ALGORITHM': 'HS256',
    'AUTH_HEADER_TYPES': ('Bearer', 'Token'),
 
    # The claim our permission classes read
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

# Configurable log directory — defaults to backend/logs/
LOGS_DIR = Path(os.getenv("LOGS_DIR", BASE_DIR / "logs"))
LOGS_DIR.mkdir(parents=True, exist_ok=True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,

    "formatters": {
        "verbose": {
            "format": "{asctime} {levelname} {name} {module}.{funcName}:{lineno} — {message}",
            "style": "{",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
        "simple": {
            "format": "{asctime} {levelname} — {message}",
            "style": "{",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },

    "handlers": {
        # Rotating daily file — keeps today only, auto-deletes old
        "file": {
            "class": "logging.handlers.TimedRotatingFileHandler",
            "filename": str(LOGS_DIR / "cms.log"),
            "when": "midnight",       # rotate at midnight
            "interval": 1,            # every 1 day
            "backupCount": 0,         #  0 = keep only current day, delete on rotate
            "formatter": "verbose",
            "encoding": "utf-8",
            "delay":True,
        },
        # Console output for dev
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "simple",
        },
    },

    "loggers": {
        # apps — catches all apps.* loggers
        "apps": {
            "handlers": ["file", "console"],
            "level": os.getenv("LOG_LEVEL", "DEBUG"),
            "propagate": False,
        },
        # Django internals
        # "django": {
        #     "handlers": ["file", "console"],
        #     "level": "INFO",
        #     "propagate": False,
        # },
        
    },

    # Catch anything not covered above
    "root": {
        "handlers": ["file", "console"],
        "level": "WARNING",
    },
}
