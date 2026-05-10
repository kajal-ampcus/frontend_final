from django.contrib import admin
from apps.cms.models.device import KitchenCounterUser
from apps.cms.models.canteen import CanteenLocation
from apps.cms.models.menu import MenuOrderItem
from apps.cms.models.guest_order import GuestOrder, GuestOrderItem


@admin.register(MenuOrderItem)
class MenuOrderItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'base_price', 'category', 'item_type', 'is_available']
    list_filter = ['category', 'item_type', 'is_available']
    search_fields = ['name', 'description']


@admin.register(GuestOrder)
class GuestOrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'guest_name', 'phone', 'status', 'total', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['id', 'guest_name', 'phone']
    readonly_fields = ['id', 'created_at']


@admin.register(GuestOrderItem)
class GuestOrderItemAdmin(admin.ModelAdmin):
    list_display = ['order', 'name', 'qty', 'price', 'is_custom']
    list_filter = ['is_custom']
    search_fields = ['name']


admin.site.register(KitchenCounterUser)
admin.site.register(CanteenLocation)
