from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
 
from apps.accounts.models import User, Company, Employee, Location
 
 
@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        "username",
        "email",
        "first_name",
        "last_name",
        "role_type",
        "is_staff",
    )
 
    list_filter = (
        "role_type",
        "is_staff",
        "is_superuser",
        "is_active",
    )
 
    fieldsets = BaseUserAdmin.fieldsets + (
        (
            "Custom Fields",
            {
                "fields": ("role_type",),
            },
        ),
    )
 
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        (
            "Custom Fields",
            {
                "fields": ("role_type",),
            },
        ),
    )
 
 
admin.site.register(Company)
admin.site.register(Employee)
admin.site.register(Location)
 