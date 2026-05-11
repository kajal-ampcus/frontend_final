"""
apps/accounts/serializers.py

Employee API serializers with frontend ↔ backend field mapping.
"""

from rest_framework import serializers
from django.conf import settings
from django.db import transaction
import secrets
import string

from .models import Employee, Department, User, RoleChoices
from .email_service import send_employee_credentials_email


class DepartmentSerializer(serializers.ModelSerializer):
    """Lightweight department info for nested serialization."""
    
    class Meta:
        model = Department
        fields = ['id', 'name']


class EmployeeListSerializer(serializers.ModelSerializer):
    """
    List view serializer — maps frontend naming to backend.
    
    Frontend expects: employeeId, fullName, department, createdAt
    Backend has: employee_code, first_name, last_name, department_id
    """
    
    employeeId = serializers.CharField(source='employee_code', read_only=True)
    fullName = serializers.CharField(source='full_name', read_only=True)
    department = serializers.CharField(source='department.name', allow_null=True, read_only=True)
    joiningDate = serializers.DateField(source='joining_date', allow_null=True, read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    
    class Meta:
        model = Employee
        fields = [
            'id', 'employeeId', 'fullName', 'designation', 'email', 
            'phone', 'department', 'joiningDate', 'gender', 'address', 'createdAt'
        ]


class EmployeeDetailSerializer(serializers.ModelSerializer):
    """
    Detail view serializer for create/update/retrieve.
    Maps frontend input (firstName, lastName, employee_code) to backend (first_name, last_name, employee_code).
    """
    
    # Read-only output fields
    employeeId = serializers.CharField(source='employee_code', read_only=True)
    fullName = serializers.CharField(source='full_name', read_only=True)
    
    # Write-only input fields
    employee_code = serializers.CharField(max_length=20, required=True, write_only=True)  
    firstName = serializers.CharField(write_only=True, max_length=100, required=True)
    lastName = serializers.CharField(write_only=True, max_length=100, required=True)
    
    # FK field
    departmentId = serializers.PrimaryKeyRelatedField(
        source='department',
        queryset=Department.objects.all(),
        allow_null=True,
        required=False
    )
    
    # Validate gender choices
    gender = serializers.ChoiceField(
        choices=['Male', 'Female', 'Other', ''],
        required=False,
        allow_blank=True
    )
    
    # Nested read-only for response
    department = DepartmentSerializer(read_only=True)
    
    # Date field
    joiningDate = serializers.DateField(source='joining_date', required=False, allow_null=True)
    
    class Meta:
        model = Employee
        fields = [
            'id', 'employeeId', 'employee_code', 'firstName', 'lastName', 'fullName',
            'email', 'phone', 'designation', 'departmentId', 'department',
            'joiningDate', 'gender', 'address', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'employeeId', 'fullName', 'department']

    @staticmethod
    def _generate_secure_password(length=12):
        """
        Generate a secure random password with upper/lower/numeric/special chars.
        """
        if length < 12:
            length = 12

        uppercase = string.ascii_uppercase
        lowercase = string.ascii_lowercase
        digits = string.digits
        special = "!@#$%^&*()-_=+[]{}|;:,.<>?"

        required_chars = [
            secrets.choice(uppercase),
            secrets.choice(lowercase),
            secrets.choice(digits),
            secrets.choice(special),
        ]
        all_chars = uppercase + lowercase + digits + special
        remaining_chars = [secrets.choice(all_chars) for _ in range(length - len(required_chars))]

        password_chars = required_chars + remaining_chars
        secrets.SystemRandom().shuffle(password_chars)
        return "".join(password_chars)
    
    def create(self, validated_data):
        """Create Employee + linked User in one transaction."""
        first_name = validated_data.pop('firstName', '').strip() if validated_data.get('firstName') else ''
        last_name = validated_data.pop('lastName', '').strip() if validated_data.get('lastName') else ''
        email = (validated_data.get('email') or '').strip()
        employee_code = validated_data.get('employee_code', '').strip()

        validated_data['first_name'] = first_name
        validated_data['last_name'] = last_name
        validated_data['email'] = email

        raw_password = self._generate_secure_password()
        self.temporary_password = raw_password

        with transaction.atomic():
            user = User(
                username=employee_code,
                email=email,
                first_name=first_name,
                last_name=last_name,
                role_type=RoleChoices.EMPLOYEE,
                is_active=True,
            )
            user.set_password(raw_password)
            user.save()

            employee = super().create(validated_data)
            employee.user = user
            employee.save(update_fields=['user'])

            login_url = getattr(settings, 'EMPLOYEE_LOGIN_URL', '').strip()

            transaction.on_commit(
                lambda: send_employee_credentials_email(
                    to_email=employee.email,
                    employee_name=employee.full_name,
                    username=user.username,
                    raw_password=raw_password,
                    login_url=login_url,
                )
            )

        return employee
    
    def update(self, instance, validated_data):
        """Handle field mapping during update."""
        if 'firstName' in validated_data:
            fn = validated_data.pop('firstName')
            validated_data['first_name'] = fn.strip() if fn else ''
        if 'lastName' in validated_data:
            ln = validated_data.pop('lastName')
            validated_data['last_name'] = ln.strip() if ln else ''
        return super().update(instance, validated_data)
    
    def validate(self, data):
        """Validate required fields and ensure they're not empty."""
        # Check if firstName and lastName are provided and not empty
        first_name = str(data.get('firstName', '')).strip() if data.get('firstName') else ''
        last_name = str(data.get('lastName', '')).strip() if data.get('lastName') else ''
        
        if not first_name:
            raise serializers.ValidationError({'firstName': 'First name is required and cannot be empty.'})
        if not last_name:
            raise serializers.ValidationError({'lastName': 'Last name is required and cannot be empty.'})
        
        # Validate full name length (firstName + lastName combined)
        full_name = f"{first_name} {last_name}".strip()
        if len(full_name) > 50:
            raise serializers.ValidationError({
                'fullName': 'Full name (first name + last name) cannot exceed 50 characters.'
            })
        
        # Validate designation length
        designation = str(data.get('designation', '')).strip() if data.get('designation') else ''
        if designation and len(designation) > 50:
            raise serializers.ValidationError({
                'designation': 'Designation cannot exceed 50 characters.'
            })
        
        return data
    
    def validate_employee_code(self, value):
        """Check employee_code uniqueness on create."""
        instance = self.instance
        if instance is None:  # Create
            if Employee.objects.filter(employee_code=value).exists():
                raise serializers.ValidationError("Employee with this ID already exists.")
        else:  # Update
            if Employee.objects.filter(employee_code=value).exclude(id=instance.id).exists():
                raise serializers.ValidationError("Employee with this ID already exists.")
        return value
    
    def validate_email(self, value):
        """Check email uniqueness on create, allow existing on update."""
        value = value.strip()
        instance = self.instance
        if instance is None:  # Create
            if Employee.objects.filter(email=value).exists():
                raise serializers.ValidationError("Employee with this email already exists.")
            if User.objects.filter(email=value).exists():
                raise serializers.ValidationError("User with this email already exists.")
        else:  # Update
            if Employee.objects.filter(email=value).exclude(id=instance.id).exists():
                raise serializers.ValidationError("Employee with this email already exists.")
        return value
    
    def validate_phone(self, value):
        """Validate phone: must be exactly 10 digits, no special characters."""
        if not value:
            return value
        
        value = value.strip()
        
        # Check if it contains only digits (no spaces, hyphens, or any special chars)
        if not value.isdigit():
            raise serializers.ValidationError("Phone number must contain only digits. Special characters, letters, spaces, and hyphens are not allowed.")
        
        # Check if it's exactly 10 digits
        if len(value) != 10:
            raise serializers.ValidationError("Phone number must be exactly 10 digits.")
        
        return value
    
    def validate_employee_code(self, value):
        """Validate employee_code: max 10 characters, check uniqueness."""
        if not value:
            raise serializers.ValidationError("Employee ID is required.")
        
        value = value.strip()
        
        # Check max length
        if len(value) > 10:
            raise serializers.ValidationError("Employee ID cannot exceed 10 characters.")
        
        # Check uniqueness
        instance = self.instance
        if instance is None:  # Create
            if Employee.objects.filter(employee_code=value).exists():
                raise serializers.ValidationError("Employee with this ID already exists.")
        else:  # Update
            if Employee.objects.filter(employee_code=value).exclude(id=instance.id).exists():
                raise serializers.ValidationError("Employee with this ID already exists.")
        
        return value


class EmployeeSearchSerializer(serializers.Serializer):
    """Query parameter serializer for filtering."""
    search = serializers.CharField(required=False, allow_blank=True)
    department = serializers.CharField(required=False, allow_blank=True)
    page = serializers.IntegerField(required=False, default=1, min_value=1)
    page_size = serializers.IntegerField(required=False, default=10, min_value=10, max_value=100)


class EmployeeBulkCreateSerializer(serializers.Serializer):
    """Bulk create serializer — accepts list of employees."""
    
    employees = EmployeeDetailSerializer(many=True)
    
    def create(self, validated_data):
        """Create multiple employees, skipping those that fail validation."""
        created = []
        failed = []
        
        for idx, emp_data in enumerate(validated_data.get('employees', [])):
            serializer = EmployeeDetailSerializer(data=emp_data)
            if serializer.is_valid():
                try:
                    created.append(serializer.save())
                except Exception as e:
                    failed.append({
                        'row': idx + 1,
                        'email': emp_data.get('email', 'unknown'),
                        'error': str(e)
                    })
            else:
                failed.append({
                    'row': idx + 1,
                    'email': emp_data.get('email', 'unknown'),
                    'errors': serializer.errors
                })
        
        # Store errors in instance for response
        self.created_employees = created
        self.failed_employees = failed
        
        return created
