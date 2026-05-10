"""
apps/common/authentication.py

Custom JWT authentication that handles both:
1. Employee/Admin tokens (with user_id -> Django User)
2. Device tokens (kitchen/counter with device_user_id -> no Django User)
"""

from rest_framework import authentication, exceptions
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import AccessToken, TokenError
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser


User = get_user_model()


class DeviceUser:
    """
    A non-Django user object for device tokens (kitchen/counter).
    Mimics enough of Django's User interface for DRF permissions.
    """
    def __init__(self, token_payload):
        self.id = token_payload.get('device_user_id')
        self.username = token_payload.get('username', '')
        self.display_name = token_payload.get('display_name', '')
        self.role_type = token_payload.get('role_type', token_payload.get('role', ''))
        self.canteen_id = token_payload.get('canteen_id')
        self.company_id = token_payload.get('company_id')
        self.is_authenticated = True
        self.is_active = True
        self.is_anonymous = False
        self.is_staff = False
        self.is_superuser = False

    def __str__(self):
        return f"DeviceUser({self.username})"

    @property
    def pk(self):
        return self.id


class CombinedJWTAuthentication(JWTAuthentication):
    """
    Custom JWT authentication that handles both employee and device tokens.

    - Employee tokens have 'user_id' -> resolved to Django User
    - Device tokens have 'device_user_id' -> resolved to DeviceUser object
    """

    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None

        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None

        try:
            # Decode token without verification first to check type
            token = AccessToken(raw_token, verify=False)

            # Check if this is a device token
            if token.get('device_user_id'):
                # Verify the token properly
                validated_token = self.get_validated_token(raw_token)
                device_user = DeviceUser(validated_token.payload)
                return (device_user, validated_token.payload)

            # Otherwise, use standard JWT authentication for employee/admin tokens
            return super().authenticate(request)

        except TokenError as e:
            raise exceptions.AuthenticationFailed(str(e))
        except Exception as e:
            # If standard auth fails, try device auth as fallback
            try:
                validated_token = self.get_validated_token(raw_token)
                if validated_token.get('device_user_id'):
                    device_user = DeviceUser(validated_token.payload)
                    return (device_user, validated_token.payload)
            except:
                pass
            raise exceptions.AuthenticationFailed(str(e))

    def get_validated_token(self, raw_token):
        """
        Validates the token and returns it.
        """
        try:
            return AccessToken(raw_token)
        except TokenError as e:
            raise exceptions.AuthenticationFailed(str(e))
