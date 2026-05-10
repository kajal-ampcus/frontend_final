"""
apps/accounts/auth_service.py

THE PHASE 2 SWAP POINT.

This module is the only place that knows HOW to authenticate an employee.
In Phase 1: checks against the local User + Employee stub.
In Phase 2: replace the body of `authenticate_employee` with an HRMS
            API call or shared-DB lookup. Nothing else changes.

The function contract must stay identical:
    Input  : username (str), password (str)
    Output : EmployeeAuthPayload | None
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional
from django.contrib.auth import authenticate, get_user_model
from apps.accounts.models import Employee
from django.contrib.auth import authenticate

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmployeeAuthPayload:
    """
    Normalised employee identity returned after successful authentication.
    Consumed by the JWT builder in apps/accounts/views.py.
    All IDs are strings so the JWT serialiser never has to call str() itself.
    """
    user_id:     str
    username:    str
    full_name:   str
    role_type:   str
    email:       str
    company_id:  Optional[str]
    employee_id: Optional[str]
    is_active:   bool


User = get_user_model()

def authenticate_employee(login_id: str, password: str) -> Optional[EmployeeAuthPayload]:
    try:
        user = None

        # 1. Try username login
        user = authenticate(username=login_id, password=password)

        # 2. Try employee_code login
        if user is None:
            emp = Employee.objects.select_related('user').filter(employee_code=login_id).first()

            if emp and emp.user:
                user = authenticate(username=emp.user.username, password=password)

        # 3. Validate
        if user is None or not user.is_active:
            return None

        # 4. Resolve employee profile
        company_id = None
        employee_id = None

        emp = getattr(user, 'employee_profile', None)
        if emp:
            company_id = str(emp.company_id) if emp.company_id else None
            employee_id = str(emp.id)

        return EmployeeAuthPayload(
            user_id=str(user.pk),
            username=user.username,
            full_name=user.get_full_name() or user.username,
            role_type=getattr(user, 'role_type', 'EMPLOYEE'),
            email=user.email or '',
            company_id=company_id,
            employee_id=employee_id,
            is_active=user.is_active,
        )

    except Exception:
        logger.exception("Unexpected error in authenticate_employee for login_id=%s", login_id)
        return None