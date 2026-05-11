from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.cms.views.health import HealthCheckView
from apps.cms.views.announcement_view import AnnouncementViewSet
from apps.cms.views.device_auth import device_login_view,create_device_user_view
from apps.cms.views.menu import (
    canteen_list_view,
    category_list_view,
    category_detail_view,
    menu_item_bulk_import_view,
    menu_item_list_create_view,
    menu_item_detail_view,
    menu_item_availability_view,
)
from apps.cms.views.employee_order import (
    employee_menu_view,
    employee_order_cancel_view,
    employee_orders_view,
)
from apps.cms.views.counter import (
    counter_order_collect_view,
    counter_order_lookup_view,
    counter_recent_collections_view,
)
from apps.cms.views.wallet import (
    employee_wallet_export_view,
    employee_wallet_recharge_view,
    employee_wallet_view,
)
from apps.cms.views.admin import (
    admin_dashboard_view,
    admin_orders_view,
    admin_sales_report_view,
    admin_customer_report_view,
    admin_customer_orders_view,
    admin_wallet_fund_view,
    admin_employee_search_view,
    admin_debug_slots_view,
)
from apps.cms.views.device_auth import device_login_view, create_device_user_view
from apps.cms.views.guest_order import GuestOrderViewSet, MenuViewSet
from apps.cms.views.slot import MealSlotViewSet

router = DefaultRouter()
router.register(r'guest-orders', GuestOrderViewSet)
router.register(r'menu', MenuViewSet, basename='menu')
router.register(r'announcements', AnnouncementViewSet, basename='announcement')
router.register(r'slots', MealSlotViewSet, basename='slots')

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="cms-health"),

    # ── Device auth (Kitchen / Counter) ──────────────────────────────────────
    path('auth/device-login/', device_login_view, name='device-login'),
    path('devices/', create_device_user_view, name='create-device-user'),
    path('canteens/', canteen_list_view, name='canteen-list'),
    path('employee/menu/', employee_menu_view, name='employee-menu'),
    path('employee/orders/', employee_orders_view, name='employee-orders'),
    path('employee/orders/<uuid:order_id>/cancel/', employee_order_cancel_view, name='employee-order-cancel'),
    path('employee/wallet/', employee_wallet_view, name='employee-wallet'),
    path('employee/wallet/recharge/', employee_wallet_recharge_view, name='employee-wallet-recharge'),
    path('employee/wallet/export/', employee_wallet_export_view, name='employee-wallet-export'),
    path('counter/orders/<str:order_code>/', counter_order_lookup_view, name='counter-order-lookup'),
    path('counter/orders/<uuid:order_id>/collect/', counter_order_collect_view, name='counter-order-collect'),
    path('counter/recent/', counter_recent_collections_view, name='counter-recent-collections'),

    # ── Admin endpoints ──────────────────────────────────────────────────────
    path('admin/dashboard/', admin_dashboard_view, name='admin-dashboard'),
    path('admin/orders/', admin_orders_view, name='admin-orders'),
    path('admin/reports/sales/', admin_sales_report_view, name='admin-sales-report'),
    path('admin/reports/customers/', admin_customer_report_view, name='admin-customer-report'),
    path('admin/reports/customers/<uuid:customer_id>/orders/', admin_customer_orders_view, name='admin-customer-orders'),
    path('admin/wallet/fund/', admin_wallet_fund_view, name='admin-wallet-fund'),
    path('admin/employees/search/', admin_employee_search_view, name='admin-employee-search'),
    path('admin/debug/slots/', admin_debug_slots_view, name='admin-debug-slots'),

# ── Menu: Categories ──────────────────────────────────────────────────────
    path(
        'canteens/<uuid:canteen_id>/menu/categories/',
        category_list_view,
        name='menu-category-list',
    ),
    path(
        'canteens/<uuid:canteen_id>/menu/categories/<uuid:category_id>/',
        category_detail_view,
        name='menu-category-detail',
    ),
 
    # ── Menu: Items list + create ─────────────────────────────────────────────
    path(
        'canteens/<uuid:canteen_id>/menu/items/',
        menu_item_list_create_view,
        name='menu-item-list-create',
    ),
    path(
        'canteens/<uuid:canteen_id>/menu/items/bulk-import/',
        menu_item_bulk_import_view,
        name='menu-item-bulk-import',
    ),
 
    # ── Menu: Item detail + update + delete ───────────────────────────────────
    path(
        'canteens/<uuid:canteen_id>/menu/items/<uuid:item_id>/',
        menu_item_detail_view,
        name='menu-item-detail',
    ),
 
    # ── Menu: Availability toggle ─────────────────────────────────────────────
    path(
        'canteens/<uuid:canteen_id>/menu/items/<uuid:item_id>/availability/',
        menu_item_availability_view,
        name='menu-item-availability',

    ),
    path('', include(router.urls)),
]

 



    
    
