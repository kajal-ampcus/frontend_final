"""
apps/accounts/views.py

Employee / Admin authentication endpoints.

Endpoints
---------
POST /api/v1/auth/login/    — username + password → JWT pair
POST /api/v1/auth/refresh/  — refresh token → new access token
POST /api/v1/auth/logout/   — stateless: instructs client to drop tokens
GET  /api/v1/auth/me/       — returns identity from current JWT

All Kitchen / Counter device auth lives in apps/cms/views/device_auth.py.
Do NOT merge them here.
"""

import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from .auth_service import authenticate_employee
from .models import RoleChoices

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Internal JWT builder — called only by login_view
# ──────────────────────────────────────────────────────────────────────────────

def _build_token_pair(payload):
    logger.debug(
        "JWT_BUILD_START user_id=%s username=%s role_type=%s company_id=%s employee_id=%s",
        payload.user_id,
        payload.username,
        payload.role_type,
        payload.company_id,
        payload.employee_id,
    )

    refresh = RefreshToken()

    refresh['user_id']     = payload.user_id
    refresh['username']    = payload.username
    refresh['role_type']   = payload.role_type
    refresh['company_id']  = payload.company_id
    refresh['employee_id'] = payload.employee_id

    access = refresh.access_token
    access['user_id']     = payload.user_id
    access['username']    = payload.username
    access['role_type']   = payload.role_type
    access['company_id']  = payload.company_id
    access['employee_id'] = payload.employee_id

    logger.debug("JWT_BUILD_SUCCESS user_id=%s", payload.user_id)

    return access, refresh


# ──────────────────────────────────────────────────────────────────────────────
# Login
# ──────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    logger.info("LOGIN_ATTEMPT endpoint=/api/v1/auth/login/ ip=%s", request.META.get("REMOTE_ADDR"))

    login_id = request.data.get('login_id', '').strip()
    password = request.data.get('password', '')
    role = request.data.get('role', '').strip()

    logger.debug("LOGIN_INPUT login_id=%s role=%s", login_id, role)

    if not login_id or not password:
        logger.warning("LOGIN_FAILED_MISSING_FIELDS login_id=%s", login_id)
        return Response(
            {'detail': 'login_id and password are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    payload = authenticate_employee(login_id, password)

    if payload is None:
        logger.warning("LOGIN_FAILED_INVALID_CREDENTIALS login_id=%s", login_id)
        return Response(
            {'detail': 'Invalid credentials.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not payload.is_active:
        logger.warning("LOGIN_FAILED_INACTIVE_USER user_id=%s", payload.user_id)
        return Response(
            {'detail': 'Account is disabled.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    if role == 'admin' and payload.role_type not in RoleChoices.ALL_ADMIN_ROLES:
        logger.warning("LOGIN_FAILED_ROLE_MISMATCH_ADMIN user_id=%s role_type=%s", payload.user_id, payload.role_type)
        return Response(
            {'detail': 'Not an admin user.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    if role == 'employee' and payload.role_type != RoleChoices.EMPLOYEE:
        logger.warning("LOGIN_FAILED_ROLE_MISMATCH_EMPLOYEE user_id=%s role_type=%s", payload.user_id, payload.role_type)
        return Response(
            {'detail': 'Not an employee.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    access, refresh = _build_token_pair(payload)

    logger.info(
        "LOGIN_SUCCESS user_id=%s username=%s role_type=%s company_id=%s",
        payload.user_id,
        payload.username,
        payload.role_type,
        payload.company_id,
    )

    return Response({
        'access':      str(access),
        'refresh':     str(refresh),
        'user_id':     payload.user_id,
        'username':    payload.username,
        'full_name':   payload.full_name,
        'role_type':   payload.role_type,
        'email':       payload.email,
        'company_id':  payload.company_id,
        'employee_id': payload.employee_id,
    }, status=status.HTTP_200_OK)


# ──────────────────────────────────────────────────────────────────────────────
# Refresh
# ──────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_view(request):
    logger.info("TOKEN_REFRESH_ATTEMPT endpoint=/api/v1/auth/refresh/")

    raw_refresh = request.data.get('refresh', '').strip()

    if not raw_refresh:
        logger.warning("TOKEN_REFRESH_FAILED_NO_TOKEN")
        return Response(
            {'detail': 'refresh token is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        refresh = RefreshToken(raw_refresh)

        if refresh.get('role_type') in ('KITCHEN', 'COUNTER'):
            logger.warning("TOKEN_REFRESH_BLOCKED_DEVICE_TOKEN")
            return Response(
                {'detail': 'Device tokens cannot be refreshed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        logger.info("TOKEN_REFRESH_SUCCESS user_id=%s", refresh.get('user_id'))
        access = refresh.access_token
        
        return Response({
            'access': str(access),
            'user_id': access.get('user_id'),
            'username': access.get('username'),
            'role_type': access.get('role_type'),
            'company_id': access.get('company_id'),
            'employee_id': access.get('employee_id'),
        })

    except TokenError:
        logger.warning("TOKEN_REFRESH_FAILED_INVALID")
        return Response(
            {'detail': 'Invalid or expired refresh token.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )


# ──────────────────────────────────────────────────────────────────────────────
# Logout
# ──────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logger.info(
        "LOGOUT_SUCCESS endpoint=/api/v1/auth/logout/ user_id=%s",
        request.user.id if request.user else None
    )
    return Response(status=status.HTTP_204_NO_CONTENT)


# ──────────────────────────────────────────────────────────────────────────────
# Me — identity check
# ──────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    logger.info("ME_ENDPOINT_HIT endpoint=/api/v1/auth/me/")

    token = request.auth

    if token is None:
        logger.warning("ME_FAILED_NO_TOKEN")
        return Response({'detail': 'No token.'}, status=status.HTTP_401_UNAUTHORIZED)

    logger.debug("ME_SUCCESS user_id=%s", token.get('user_id'))

    return Response({
        'user_id':     token.get('user_id'),
        'username':    token.get('username'),
        'role_type':   token.get('role_type'),
        'company_id':  token.get('company_id'),
        'employee_id': token.get('employee_id'),
    }, status=status.HTTP_200_OK)


# ──────────────────────────────────────────────────────────────────────────────
# Employee Management — CRUD Endpoints
# ──────────────────────────────────────────────────────────────────────────────

from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from django.db.models import Q

from .models import Employee, Department
from .serializers import (
    EmployeeListSerializer,
    EmployeeDetailSerializer,
    EmployeeBulkCreateSerializer,
    DepartmentSerializer,
)
from apps.common.permissions import IsCMSAdmin


class EmployeeViewSet(ModelViewSet):
    """
    Employee CRUD API with search, filtering, and bulk operations.
    
    Endpoints:
        GET    /api/v1/auth/employees/                  — list (paginated, searchable)
        POST   /api/v1/auth/employees/                  — create single
        POST   /api/v1/auth/employees/bulk-create/      — bulk create
        GET    /api/v1/auth/employees/{id}/             — retrieve
        PUT    /api/v1/auth/employees/{id}/             — full update
        PATCH  /api/v1/auth/employees/{id}/             — partial update
        DELETE /api/v1/auth/employees/{id}/             — delete
    """
    
    queryset = Employee.objects.select_related('department').order_by('-created_at')
    permission_classes = [IsAuthenticated, IsCMSAdmin]
    pagination_class = None
    
    def get_serializer_class(self):
        """Use detail serializer for create/update, list for retrieve."""
        if self.action in ['create', 'update', 'partial_update', 'retrieve']:
            return EmployeeDetailSerializer
        return EmployeeListSerializer
    
    def list(self, request, *args, **kwargs):
        """
        GET /api/v1/auth/employees/?page=1&page_size=10&search=john&department=IT
        """
        page = request.query_params.get('page', 1)
        page_size = request.query_params.get('page_size', 10)
        search = request.query_params.get('search', '').strip()
        department_filter = request.query_params.get('department', '').strip()
        
        queryset = self.get_queryset()
        
        # Search across 6 fields
        if search:
            queryset = queryset.filter(
                Q(employee_code__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search) |
                Q(designation__icontains=search)
            )
        
        # Department filter by name
        if department_filter and department_filter != 'All':
            queryset = queryset.filter(department__name__icontains=department_filter)
        
        total_count = queryset.count()
        
        # Pagination
        page_size = min(int(page_size), 100)
        page = max(int(page), 1)
        start = (page - 1) * page_size
        end = start + page_size
        
        employees = queryset[start:end]
        serializer = self.get_serializer(employees, many=True)
        
        return Response({
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'results': serializer.data,
        }, status=status.HTTP_200_OK)
    
    def create(self, request, *args, **kwargs):
        """POST /api/v1/auth/employees/ — create single employee."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee = serializer.save()
        response_data = EmployeeDetailSerializer(employee).data
        response_data['temporary_password'] = getattr(serializer, 'temporary_password', None)
        return Response(response_data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'], url_path='bulk-create')
    def bulk_create(self, request):
        """POST /api/v1/auth/employees/bulk-create/ — bulk create employees."""
        serializer = EmployeeBulkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        created = serializer.save()
        
        response_data = {
            'created': EmployeeDetailSerializer(created, many=True).data,
            'count': len(created),
        }
        
        # Include failed employees if any
        if hasattr(serializer, 'failed_employees') and serializer.failed_employees:
            response_data['failed'] = serializer.failed_employees
            response_data['failed_count'] = len(serializer.failed_employees)
        
        return Response(response_data, status=status.HTTP_201_CREATED)


class DepartmentViewSet(ModelViewSet):
    """
    Department CRUD API.
    
    Endpoints:
        GET    /api/v1/auth/departments/          — list all active departments
        POST   /api/v1/auth/departments/          — create department
        GET    /api/v1/auth/departments/{id}/     — retrieve department
        PUT    /api/v1/auth/departments/{id}/     — full update
        PATCH  /api/v1/auth/departments/{id}/     — partial update
        DELETE /api/v1/auth/departments/{id}/     — delete department
    """
    
    queryset = Department.objects.filter(is_active=True).order_by('name')
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated, IsCMSAdmin]
    
    def get_queryset(self):
        """Return only active departments."""
        return super().get_queryset().filter(is_active=True)
