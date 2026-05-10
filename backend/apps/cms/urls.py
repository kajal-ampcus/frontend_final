from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.cms.views.health import HealthCheckView
from apps.cms.views.device_auth import device_login_view,create_device_user_view
from apps.cms.views.menu import (
    canteen_list_view,
    category_list_view,
    category_detail_view,
    menu_item_bulk_import_view,
    menu_item_list_create_view,
    menu_item_detail_view,
    menu_item_slot_config_view,
    menu_item_availability_view,
)
from apps.cms.views.device_auth import device_login_view, create_device_user_view
from apps.cms.views.guest_order import GuestOrderViewSet, MenuViewSet
from apps.cms.views.order import OrderViewSet, WalletViewSet, SlotCatalogViewSet

router = DefaultRouter()
router.register(r'guest-orders', GuestOrderViewSet)
router.register(r'menu', MenuViewSet, basename='menu')
router.register(r'orders', OrderViewSet, basename='orders')
router.register(r'wallet', WalletViewSet, basename='wallet')
router.register(r'slots', SlotCatalogViewSet, basename='slots')

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="cms-health"),

    # ── Device auth (Kitchen / Counter) ──────────────────────────────────────
    path('auth/device-login/', device_login_view, name='device-login'),
    path('devices/', create_device_user_view, name='create-device-user'),
    path('canteens/', canteen_list_view, name='canteen-list'),


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
        'canteens/<uuid:canteen_id>/menu/items/<uuid:item_id>/slots/',
        menu_item_slot_config_view,
        name='menu-item-slot-config',
    ),
    path(
        'canteens/<uuid:canteen_id>/menu/items/<uuid:item_id>/availability/',
        menu_item_availability_view,
        name='menu-item-availability',
    ),

    path('', include(router.urls)),
]
 



    
    
