"""
Management command to seed test data for CanteenX.

Creates:
- A canteen (if none exists)
- Menu categories
- Menu items
- Meal slots for today
- Links menu items to slots

Usage:
    python manage.py seed_test_data
"""

import uuid
from datetime import time
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import Company, Department, Employee, User, RoleChoices
from apps.cms.models.canteen import CanteenLocation
from apps.cms.models.menu import MenuCategory, CanteenMenuItem
from apps.cms.models.slot import MealSlot, SlotMenuItem, MealType, SlotLabel
from apps.cms.models.wallet import CanteenWallet


class Command(BaseCommand):
    help = 'Seeds test data for CanteenX including canteen, menu items, and slots for today'

    def handle(self, *args, **options):
        self.stdout.write("Seeding test data...")

        # 1. Create or get company
        company, created = Company.objects.get_or_create(
            code='TESTCO',
            defaults={'name': 'Test Company', 'is_active': True}
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created company: {company.name}"))
        else:
            self.stdout.write(f"Using existing company: {company.name}")

        # 2. Create or get department
        department, created = Department.objects.get_or_create(
            company=company,
            name='Engineering',
            defaults={'code': 'ENG', 'is_active': True}
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created department: {department.name}"))

        # 3. Create or get canteen
        canteen, created = CanteenLocation.objects.get_or_create(
            company=company,
            name='Main Canteen',
            defaults={
                'address_floor': 'Ground Floor',
                'is_active': True,
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created canteen: {canteen.name}"))
        else:
            self.stdout.write(f"Using existing canteen: {canteen.name}")

        # 4. Create categories
        categories_data = ['Veg', 'Non-Veg', 'Beverages', 'Snacks']

        categories = {}
        for cat_name in categories_data:
            cat, created = MenuCategory.objects.get_or_create(
                canteen=canteen,
                name=cat_name,
                defaults={'is_active': True}
            )
            categories[cat_name] = cat
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created category: {cat.name}"))

        # 5. Create menu items
        menu_items_data = [
            # Breakfast items
            {'name': 'Idli Sambar', 'category': 'Veg', 'price': 40, 'item_type': 'BREAKFAST', 'is_veg': True},
            {'name': 'Dosa', 'category': 'Veg', 'price': 50, 'item_type': 'BREAKFAST', 'is_veg': True},
            {'name': 'Poha', 'category': 'Veg', 'price': 35, 'item_type': 'BREAKFAST', 'is_veg': True},
            {'name': 'Upma', 'category': 'Veg', 'price': 35, 'item_type': 'BREAKFAST', 'is_veg': True},
            {'name': 'Omelette', 'category': 'Non-Veg', 'price': 30, 'item_type': 'BREAKFAST', 'is_veg': False},
            # Breakfast beverages
            {'name': 'Morning Tea', 'category': 'Beverages', 'price': 15, 'item_type': 'BREAKFAST', 'is_veg': True},
            {'name': 'Morning Coffee', 'category': 'Beverages', 'price': 20, 'item_type': 'BREAKFAST', 'is_veg': True},

            # Meal (Lunch/Dinner) items
            {'name': 'Veg Thali', 'category': 'Veg', 'price': 80, 'item_type': 'MEAL', 'is_veg': True},
            {'name': 'Dal Rice', 'category': 'Veg', 'price': 60, 'item_type': 'MEAL', 'is_veg': True},
            {'name': 'Paneer Butter Masala', 'category': 'Veg', 'price': 120, 'item_type': 'MEAL', 'is_veg': True},
            {'name': 'Chicken Biryani', 'category': 'Non-Veg', 'price': 150, 'item_type': 'MEAL', 'is_veg': False},
            {'name': 'Mutton Curry', 'category': 'Non-Veg', 'price': 180, 'item_type': 'MEAL', 'is_veg': False},
            {'name': 'Fish Fry', 'category': 'Non-Veg', 'price': 140, 'item_type': 'MEAL', 'is_veg': False},

            # Meal Beverages
            {'name': 'Tea', 'category': 'Beverages', 'price': 15, 'item_type': 'MEAL', 'is_veg': True},
            {'name': 'Coffee', 'category': 'Beverages', 'price': 20, 'item_type': 'MEAL', 'is_veg': True},
            {'name': 'Lassi', 'category': 'Beverages', 'price': 30, 'item_type': 'MEAL', 'is_veg': True},

            # Snacks
            {'name': 'Samosa', 'category': 'Snacks', 'price': 20, 'item_type': 'MEAL', 'is_veg': True},
            {'name': 'Vada Pav', 'category': 'Snacks', 'price': 25, 'item_type': 'MEAL', 'is_veg': True},
        ]

        menu_items = {}
        for item_data in menu_items_data:
            item, created = CanteenMenuItem.objects.get_or_create(
                canteen=canteen,
                name=item_data['name'],
                defaults={
                    'category': categories[item_data['category']],
                    'description': f"Delicious {item_data['name']}",
                    'base_price': Decimal(str(item_data['price'])),
                    'item_type': item_data['item_type'],
                    'is_veg': item_data['is_veg'],
                    'is_available': True,
                    'is_active': True,
                }
            )
            menu_items[item_data['name']] = item
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created menu item: {item.name} - ₹{item.base_price}"))

        # 6. Create slots for TODAY
        today = timezone.localdate()
        self.stdout.write(f"\nCreating slots for today: {today}")

        slots_data = [
            {
                'name': 'Breakfast',
                'meal_type': MealType.BREAKFAST,
                'start_time': time(7, 0),
                'end_time': time(10, 0),
                'items': ['Idli Sambar', 'Dosa', 'Poha', 'Upma', 'Omelette', 'Tea', 'Coffee']
            },
            {
                'name': 'Lunch',
                'meal_type': MealType.MEAL,
                'start_time': time(12, 0),
                'end_time': time(14, 30),
                'items': ['Veg Thali', 'Dal Rice', 'Paneer Butter Masala', 'Chicken Biryani', 'Mutton Curry', 'Lassi']
            },
            {
                'name': 'Snacks',
                'meal_type': MealType.MEAL,
                'start_time': time(16, 0),
                'end_time': time(18, 0),
                'items': ['Samosa', 'Vada Pav', 'Tea', 'Coffee']
            },
            {
                'name': 'Dinner',
                'meal_type': MealType.MEAL,
                'start_time': time(19, 0),
                'end_time': time(21, 30),
                'items': ['Veg Thali', 'Dal Rice', 'Paneer Butter Masala', 'Chicken Biryani', 'Fish Fry']
            },
        ]

        for slot_data in slots_data:
            slot, created = MealSlot.objects.get_or_create(
                canteen=canteen,
                date=today,
                name=slot_data['name'],
                defaults={
                    'meal_type': slot_data['meal_type'],
                    'start_time': slot_data['start_time'],
                    'end_time': slot_data['end_time'],
                    'capacity': 100,
                    'is_active': True,
                    'label': SlotLabel.ACTIVE,  # Set to ACTIVE so employees can order
                }
            )

            if created:
                self.stdout.write(self.style.SUCCESS(
                    f"Created slot: {slot.name} ({slot.start_time} - {slot.end_time})"
                ))
            else:
                # Update existing slot to be active
                slot.is_active = True
                slot.label = SlotLabel.ACTIVE
                slot.save(update_fields=['is_active', 'label'])
                self.stdout.write(f"Updated slot to active: {slot.name}")

            # Link menu items to slot
            for item_name in slot_data['items']:
                if item_name in menu_items:
                    item = menu_items[item_name]
                    slot_item, si_created = SlotMenuItem.objects.get_or_create(
                        slot=slot,
                        menu_item_id=item.id,
                        defaults={'is_enabled': True, 'max_qty_per_order': 5}
                    )
                    if si_created:
                        self.stdout.write(f"  - Linked: {item_name}")
                    else:
                        slot_item.is_enabled = True
                        slot_item.save(update_fields=['is_enabled'])

        # 7. Create a test employee if none exists
        test_user, user_created = User.objects.get_or_create(
            username='testemployee',
            defaults={
                'email': 'test@example.com',
                'first_name': 'Test',
                'last_name': 'Employee',
                'role_type': RoleChoices.EMPLOYEE,
            }
        )
        if user_created:
            test_user.set_password('test123')
            test_user.save()
            self.stdout.write(self.style.SUCCESS("Created test user: testemployee / test123"))

        test_employee, emp_created = Employee.objects.get_or_create(
            user=test_user,
            defaults={
                'company': company,
                'department': department,
                'employee_code': 'EMP-001',
                'first_name': 'Test',
                'last_name': 'Employee',
                'email': 'test@example.com',
                'is_active': True,
            }
        )
        if emp_created:
            self.stdout.write(self.style.SUCCESS(f"Created employee: {test_employee.full_name}"))

            # Create wallet with balance
            wallet, _ = CanteenWallet.objects.get_or_create(
                employee=test_employee,
                defaults={'balance': Decimal('1000.00')}
            )
            self.stdout.write(self.style.SUCCESS(f"Created wallet with balance: ₹{wallet.balance}"))

        # 8. Create an admin user if none exists
        admin_user, admin_created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@example.com',
                'first_name': 'Admin',
                'last_name': 'User',
                'role_type': RoleChoices.CANTEEN_ADMIN,
                'is_staff': True,
            }
        )
        if admin_created:
            admin_user.set_password('admin123')
            admin_user.save()
            self.stdout.write(self.style.SUCCESS("Created admin user: admin / admin123"))

        admin_employee, admin_emp_created = Employee.objects.get_or_create(
            user=admin_user,
            defaults={
                'company': company,
                'department': department,
                'employee_code': 'ADMIN-001',
                'first_name': 'Admin',
                'last_name': 'User',
                'email': 'admin@example.com',
                'is_active': True,
            }
        )
        if admin_emp_created:
            self.stdout.write(self.style.SUCCESS(f"Created admin employee: {admin_employee.full_name}"))

        self.stdout.write(self.style.SUCCESS("\n✅ Test data seeded successfully!"))
        self.stdout.write("\nYou can now:")
        self.stdout.write("  - Login as employee: testemployee / test123")
        self.stdout.write("  - Login as admin: admin / admin123")
        self.stdout.write(f"\nSlots created for today ({today}) with menu items linked.")
