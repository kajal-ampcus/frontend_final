"""
test_models.py

Fixes applied vs original:
  BUG 8 FIX — Import path normalised to `apps.cms.models` to match the rest of
               the codebase (announcement_service.py uses apps.cms.models).
               Using `cms.models` works only if `cms` is directly on sys.path,
               which is inconsistent with how the service layer imports.
"""

from django.test import TestCase
from datetime import date, time

from apps.cms.models import Announcement           # BUG 8 FIX: consistent import path


def make_announcement(**kwargs):
    defaults = {
        'title': 'Test Announcement',
        'message': 'Test message',
        'date': date(2026, 5, 11),
        'time_from': time(7, 0),
        'time_to': time(9, 0),
        'special_dish': 'Dosa',
        'status': Announcement.STATUS_ACTIVE,
    }
    defaults.update(kwargs)
    return Announcement.objects.create(**defaults)


class AnnouncementModelTest(TestCase):

    def test_str_contains_title(self):
        a = make_announcement(title='Iftar')
        self.assertIn('Iftar', str(a))

    def test_time_range_property(self):
        a = make_announcement(time_from=time(7, 0), time_to=time(9, 0))
        self.assertEqual(a.time_range, '07:00 — 09:00')

    def test_is_active_true(self):
        a = make_announcement(status=Announcement.STATUS_ACTIVE)
        self.assertTrue(a.is_active)

    def test_is_active_false(self):
        a = make_announcement(status=Announcement.STATUS_INACTIVE)
        self.assertFalse(a.is_active)

    def test_default_status_is_active(self):
        a = Announcement.objects.create(
            title='X', date=date(2026, 5, 11),
            time_from=time(8, 0), time_to=time(9, 0),
        )
        self.assertEqual(a.status, Announcement.STATUS_ACTIVE)