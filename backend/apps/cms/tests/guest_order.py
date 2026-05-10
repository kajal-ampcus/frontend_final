from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from apps.cms.models import MenuCategory, MenuOrderItem, GuestOrder, GuestOrderItem


class GuestOrderAPITestCase(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.client.force_authenticate(user=self.user)
        self.category = MenuCategory.objects.create(
            canteen_id='00000000-0000-0000-0000-000000000001',
            name='Veg',
        )
        self.menu_item = MenuOrderItem.objects.create(
            canteen_id='00000000-0000-0000-0000-000000000001',
            category=self.category,
            name='Test Item',
            base_price=100.00,
            item_type='MEAL',
        )

    def test_create_guest_order(self):
        url = '/api/v1/guest-orders/'
        data = {
            'guest_name': 'John Doe',
            'phone': '+91 9876543210',
            'items': [
                {'menu_item_id': str(self.menu_item.id), 'qty': 2}
            ]
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(GuestOrder.objects.count(), 1)
        self.assertEqual(GuestOrderItem.objects.count(), 1)

    def test_list_guest_orders(self):
        GuestOrder.objects.create(
            guest_name='Jane Doe',
            phone='+91 9876543211',
            total=200.00
        )
        url = '/api/v1/guest-orders/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)

    def test_delete_guest_order_not_allowed(self):
        order = GuestOrder.objects.create(
            guest_name='Cancel Test',
            phone='+91 9876543212',
            total=150.00
        )
        url = f'/api/v1/guest-orders/{order.id}/'
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(GuestOrder.objects.filter(id=order.id).count(), 1)

    def test_get_menu_available(self):
        url = '/api/v1/menu/available/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)

    def test_get_menu_slots(self):
        url = '/api/v1/menu/slots/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('slots', response.data)
