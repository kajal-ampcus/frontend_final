"""
apps/cms/views/device_auth.py

Device authentication — Kitchen / Counter station login.

Endpoints
---------
POST /api/v1/cms/auth/device-login/   — username + PIN → 8-hour access JWT (no refresh)

Separation guarantee:
  - This file has ZERO imports from apps/accounts/.
  - Employee auth has ZERO imports from this file.
  - They share only the common JWT secret (settings.SIMPLE_JWT['SIGNING_KEY']).
"""

import datetime
import logging

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone

from apps.cms.models.device import KitchenCounterUser

logger = logging.getLogger(__name__)

# Shift duration — device tokens are valid for exactly one shift.
# Re-login is required at the start of each shift.
_DEVICE_TOKEN_LIFETIME = datetime.timedelta(hours=8)


@api_view(['POST'])
@permission_classes([AllowAny])
def device_login_view(request):
    """
    POST /api/v1/cms/auth/device-login/
    Body : { "username": "kitchen-main", "pin": "482193" }

    Returns : 8-hour access JWT only. No refresh token.

    JWT claims added beyond simplejwt defaults:
        role            KITCHEN | COUNTER
        role_type       same value (normalised claim name for permission classes)
        canteen_id      UUID of the canteen this device is scoped to
        company_id      UUID of the tenant company
        device_user_id  UUID PK of the KitchenCounterUser row
        display_name    Human-readable label shown on the device UI

    Security notes:
        - PIN verification uses bcrypt (constant time).
        - A dummy bcrypt check runs on unknown usernames to prevent
          user-enumeration via timing differences.
        - No refresh token — device must re-authenticate each shift.
    """
    username = request.data.get('username', '').strip()
    pin      = request.data.get('pin', '').strip()

    if not username or not pin:
        return Response(
            {'detail': 'username and pin are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── Lookup device account ─────────────────────────────────────────────────
    try:
        device_user = (
            KitchenCounterUser.objects
            .get(username=username, is_active=True)
        )
    except KitchenCounterUser.DoesNotExist:
        # Run a dummy bcrypt check so the response time is identical to a
        # failed PIN check — prevents username enumeration via timing.
        import bcrypt
        bcrypt.checkpw(b'dummy', bcrypt.hashpw(b'dummy', bcrypt.gensalt(rounds=12)))
        return Response(
            {'detail': 'Invalid credentials.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # ── PIN verification ──────────────────────────────────────────────────────
    if not device_user.check_pin(pin):
        return Response(
            {'detail': 'Invalid credentials.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # ── Build 8-hour access token (no refresh) ────────────────────────────────
    access_token = AccessToken()
    access_token.set_exp(lifetime=_DEVICE_TOKEN_LIFETIME)

    # role + role_type carry the same value so permission classes only need
    # to check one claim name regardless of whether the user is an Employee
    # or a device account.
    access_token['role']           = device_user.role          # 'KITCHEN' | 'COUNTER'
    access_token['role_type']      = device_user.role          # normalised claim
    access_token['canteen_id']     = str(device_user.canteen_id)
    access_token['company_id']     = str(device_user.company_id)
    access_token['device_user_id'] = str(device_user.id)
    access_token['display_name']   = device_user.display_name
    access_token['username']       = device_user.username

    # ── Record last login (best-effort — never fail the login on DB error) ────
    try:
        device_user.last_login_at = timezone.now()
        device_user.save(update_fields=['last_login_at'])
    except Exception:
        logger.warning("Failed to update last_login_at for device user %s", device_user.id)

    return Response({
        'access':         str(access_token),
        'device_user_id': str(device_user.id),
        'display_name':   device_user.display_name,
        'role':           device_user.role,
        'role_type':      device_user.role,
        'canteen_id':     str(device_user.canteen_id),
        'company_id':     str(device_user.company_id),
        'username':       device_user.username,
    }, status=status.HTTP_200_OK)



@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def create_device_user_view(request):
    """
    POST /api/v1/cms/devices/

    Body:
    {
        "username": "kitchen-main",
        "pin": "482193",
        "role": "KITCHEN",   // or COUNTER
        "canteen_id": "uuid",
        "company_id": "uuid",
        "display_name": "Kitchen Main Device"
    }
    """

    data = request.data

    required_fields = [
        "username", "pin", "role",
        "canteen_id", "company_id", "display_name"
    ]

    for field in required_fields:
        if not data.get(field):
            return Response(
                {"detail": f"{field} is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

    if data["role"] not in ["KITCHEN", "COUNTER"]:
        return Response(
            {"detail": "Invalid role"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if KitchenCounterUser.objects.filter(username=data["username"]).exists():
        return Response(
            {"detail": "Username already exists"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Create user
    device_user = KitchenCounterUser(
        username=data["username"],
        role=data["role"],
        canteen_id=data["canteen_id"],
        company_id=data["company_id"],
        display_name=data["display_name"],
        is_active=True,
        created_at=timezone.now()
    )

    # Hash PIN
    device_user.set_pin(data["pin"])

    device_user.save()

    return Response({
        "message": "Device user created successfully",
        "device_user_id": str(device_user.id),
        "username": device_user.username
    }, status=status.HTTP_201_CREATED)