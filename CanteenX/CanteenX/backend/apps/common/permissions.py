"""
apps/common/permissions.py

DRF permission classes for CanteenX.

All classes read the 'role_type' claim from the JWT payload.
Both Employee tokens and Device tokens use 'role_type' as the claim name
so one set of permission classes works for the entire system.

Usage on a ViewSet:
    from apps.common.permissions import IsEmployee, IsKitchenUser, IsCounterUser, IsCMSAdmin

    class OrderViewSet(viewsets.ModelViewSet):
        permission_classes = [IsAuthenticated, IsEmployee]

For endpoints accessible by multiple roles use CombinedPermission:
    permission_classes = [IsAuthenticated, IsKitchenOrCounter]
"""

from rest_framework.permissions import BasePermission

from apps.accounts.models import RoleChoices


# ──────────────────────────────────────────────────────────────────────────────
# Internal helper
# ──────────────────────────────────────────────────────────────────────────────

def _get_role(request) -> str:
    """
    Extract role_type from the JWT payload.
    Works for both simplejwt AccessToken objects (Employee / Admin)
    and device tokens (Kitchen / Counter) because both set 'role_type'.

    Returns empty string if the token is missing or has no role claim.
    """
    token = getattr(request, 'auth', None)
    if token is None:
        return ''
    # simplejwt token objects support dict-style access
    try:
        return token.get('role_type', '') or ''
    except Exception:
        return ''


# ──────────────────────────────────────────────────────────────────────────────
# Single-role permission classes
# ──────────────────────────────────────────────────────────────────────────────

class IsEmployee(BasePermission):
    """Grants access to users with role_type = EMPLOYEE."""
    message = 'Employee access required.'

    def has_permission(self, request, view):
        return _get_role(request) == RoleChoices.EMPLOYEE


class IsKitchenUser(BasePermission):
    """Grants access to Kitchen device accounts only."""
    message = 'Kitchen device access required.'

    def has_permission(self, request, view):
        return _get_role(request) == 'KITCHEN'


class IsCounterUser(BasePermission):
    """Grants access to Counter device accounts only."""
    message = 'Counter device access required.'

    def has_permission(self, request, view):
        return _get_role(request) == 'COUNTER'


class IsCMSAdmin(BasePermission):
    """
    Grants access to any admin role that can manage CMS.
    SUPER_ADMIN, COMPANY_ADMIN, CANTEEN_ADMIN.
    """
    message = 'CMS Admin access required.'

    def has_permission(self, request, view):
        return _get_role(request) in RoleChoices.CMS_ADMIN_ROLES


class IsAnyAdmin(BasePermission):
    """Grants access to ALL admin roles including HR and Payroll."""
    message = 'Admin access required.'

    def has_permission(self, request, view):
        return _get_role(request) in RoleChoices.ALL_ADMIN_ROLES


# ──────────────────────────────────────────────────────────────────────────────
# Combined permission classes — for endpoints shared across roles
# ──────────────────────────────────────────────────────────────────────────────

class IsKitchenOrCounter(BasePermission):
    """
    Grants access to both Kitchen and Counter device accounts.
    Used by the Guest Meal logging endpoint accessible from both portals.
    """
    message = 'Kitchen or Counter device access required.'

    def has_permission(self, request, view):
        return _get_role(request) in ('KITCHEN', 'COUNTER')


class IsEmployeeOrAdmin(BasePermission):
    """
    Grants access to Employees and any Admin role.
    Used by shared read endpoints (e.g. menu browsing for admin preview).
    """
    message = 'Employee or Admin access required.'

    def has_permission(self, request, view):
        role = _get_role(request)
        return role == RoleChoices.EMPLOYEE or role in RoleChoices.ALL_ADMIN_ROLES


class IsKitchenOrAdmin(BasePermission):
    """
    Grants access to Kitchen device accounts and CMS Admins.
    Used by Admin's ability to view the kitchen order board.
    """
    message = 'Kitchen or Admin access required.'

    def has_permission(self, request, view):
        role = _get_role(request)
        return role == 'KITCHEN' or role in RoleChoices.CMS_ADMIN_ROLES