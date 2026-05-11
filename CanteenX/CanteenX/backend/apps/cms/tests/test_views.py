"""
test_views.py

Fixes applied vs original:
  BUG 8 FIX  — Import path normalised to `apps.cms.models` (was `cms.models`).
  BUG 5 FIX  — Added test for toggle_status with irrelevant body keys to verify
                the `if 'status' in request.data` guard works correctly.
  BUG 9 NOTE — res.data['id'] vs a.id comparison: safe while PK is integer.
                If model migrates to UUID PK, change to `str(a.id)`.
  NEW TEST   — test_search_special_dish: verifies special_dish icontains search.
  NEW TEST   — test_toggle_status_irrelevant_body: sends body without 'status'
                key — should flip (not 400), verifying BUG 5 fix in the view.
"""

from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from datetime import date, time

from apps.cms.models import Announcement               # BUG 8 FIX


def make_announcement(**kwargs):
    defaults = {
        'title': 'View Test',
        'message': 'msg',
        'date': date(2026, 5, 11),
        'time_from': time(7, 0),
        'time_to': time(9, 0),
        'special_dish': 'Dosa',
        'status': Announcement.STATUS_ACTIVE,
    }
    defaults.update(kwargs)
    return Announcement.objects.create(**defaults)


BASE = '/api/cms/announcements/'


class AnnouncementViewTest(APITestCase):

    def setUp(self):
        self.client = APIClient()

    def test_create_201(self):
        payload = {
            'title': 'Iftar Celebration',
            'message': 'Refreshment served.',
            'date': '2026-05-11',
            'time_from': '07:00:00',
            'time_to': '09:00:00',
            'special_dish': 'Dosa',
            'status': 'active',
        }
        res = self.client.post(BASE, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['title'], 'Iftar Celebration')
        self.assertEqual(res.data['time_range'], '07:00 — 09:00')

    def test_create_invalid_time_range_400(self):
        payload = {
            'title': 'Bad',
            'date': '2026-05-11',
            'time_from': '09:00:00',
            'time_to': '07:00:00',
        }
        res = self.client.post(BASE, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_title_too_long_400(self):
        payload = {
            'title': 'A' * 81,
            'date': '2026-05-11',
            'time_from': '07:00:00',
            'time_to': '09:00:00',
        }
        res = self.client.post(BASE, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_200(self):
        make_announcement()
        make_announcement(title='Second', status=Announcement.STATUS_INACTIVE)
        res = self.client.get(BASE)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['count'], 2)

    def test_filter_active(self):
        make_announcement(status=Announcement.STATUS_ACTIVE)
        make_announcement(title='Inactive', status=Announcement.STATUS_INACTIVE)
        res = self.client.get(BASE, {'status': 'active'})
        self.assertEqual(res.data['count'], 1)

    def test_search_title(self):
        make_announcement(title='Iftar Party')
        make_announcement(title='Lunch')
        res = self.client.get(BASE, {'search': 'iftar'})
        self.assertEqual(res.data['count'], 1)

    def test_search_special_dish(self):
        """Verify special_dish is included in icontains search."""
        make_announcement(title='A', special_dish='Biryani')
        make_announcement(title='B', special_dish='Idli')
        res = self.client.get(BASE, {'search': 'biryani'})
        self.assertEqual(res.data['count'], 1)

    def test_retrieve_200(self):
        a = make_announcement()
        res = self.client.get(f'{BASE}{a.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # BUG 9 NOTE: safe for integer PK; use str(a.id) if migrated to UUID.
        self.assertEqual(res.data['id'], a.id)

    def test_retrieve_404(self):
        res = self.client.get(f'{BASE}9999/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_partial_update_200(self):
        a = make_announcement()
        res = self.client.patch(f'{BASE}{a.id}/', {'title': 'Updated'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['title'], 'Updated')

    def test_full_update_200(self):
        a = make_announcement()
        payload = {
            'title': 'Full Update',
            'message': 'new msg',
            'date': '2026-06-01',
            'time_from': '08:00:00',
            'time_to': '10:00:00',
            'special_dish': 'Idli',
            'status': 'active',
        }
        res = self.client.put(f'{BASE}{a.id}/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['title'], 'Full Update')

    def test_delete_204(self):
        a = make_announcement()
        res = self.client.delete(f'{BASE}{a.id}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Announcement.objects.filter(id=a.id).exists())

    def test_toggle_status_flip(self):
        a = make_announcement(status=Announcement.STATUS_ACTIVE)
        res = self.client.patch(f'{BASE}{a.id}/toggle_status/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], Announcement.STATUS_INACTIVE)

    def test_toggle_status_explicit(self):
        a = make_announcement(status=Announcement.STATUS_ACTIVE)
        res = self.client.patch(
            f'{BASE}{a.id}/toggle_status/', {'status': 'inactive'}, format='json'
        )
        self.assertEqual(res.data['status'], Announcement.STATUS_INACTIVE)

    def test_toggle_status_irrelevant_body_still_flips(self):
        """
        BUG 5 FIX verification: sending a body without the 'status' key
        must flip (not raise 400). Original `if request.data:` guard would
        have tried to validate the body and returned 400.
        """
        a = make_announcement(status=Announcement.STATUS_ACTIVE)
        res = self.client.patch(
            f'{BASE}{a.id}/toggle_status/', {'unrelated_key': 'value'}, format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], Announcement.STATUS_INACTIVE)

    def test_stats(self):
        make_announcement(status=Announcement.STATUS_ACTIVE, special_dish='Dosa')
        make_announcement(status=Announcement.STATUS_INACTIVE, special_dish='')
        res = self.client.get(f'{BASE}stats/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['total'], 2)
        self.assertEqual(res.data['active'], 1)
        self.assertEqual(res.data['inactive'], 1)
        self.assertEqual(res.data['with_special_dish'], 1)