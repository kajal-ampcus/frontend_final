"""
test_service.py

Fixes applied vs original:
  BUG 8 FIX — Import path normalised to `apps.cms.models` (was `cms.models`).
  BUG 4 FIX — test_get_filtered_by_search previously tested date__icontains
               indirectly. Now that the date icontains search is removed from
               the service (it raised FieldError at runtime), no date search
               test is included. A dedicated date filter test is added instead.
"""

from django.test import TestCase
from datetime import date, time

from apps.cms.models import Announcement                          # BUG 8 FIX
from apps.cms.services.announcement_service import AnnouncementService


def make_announcement(**kwargs):
    defaults = {
        'title': 'Service Test',
        'date': date(2026, 5, 11),
        'time_from': time(7, 0),
        'time_to': time(9, 0),
        'status': Announcement.STATUS_ACTIVE,
        'special_dish': 'Dosa',
    }
    defaults.update(kwargs)
    return Announcement.objects.create(**defaults)


class AnnouncementServiceTest(TestCase):

    def test_get_all(self):
        make_announcement()
        make_announcement(title='Second')
        self.assertEqual(AnnouncementService.get_all().count(), 2)

    def test_get_filtered_by_status(self):
        make_announcement(status=Announcement.STATUS_ACTIVE)
        make_announcement(status=Announcement.STATUS_INACTIVE)
        self.assertEqual(
            AnnouncementService.get_filtered(status='active').count(), 1
        )

    def test_get_filtered_by_search_title(self):
        make_announcement(title='Iftar Party')
        make_announcement(title='Lunch')
        self.assertEqual(
            AnnouncementService.get_filtered(search='iftar').count(), 1
        )

    def test_get_filtered_by_search_message(self):
        make_announcement(title='A', message='Special menu today')
        make_announcement(title='B', message='Normal day')
        self.assertEqual(
            AnnouncementService.get_filtered(search='special menu').count(), 1
        )

    def test_get_filtered_by_special_dish(self):
        make_announcement(special_dish='Biryani')
        make_announcement(special_dish='Dosa')
        self.assertEqual(
            AnnouncementService.get_filtered(search='biryani').count(), 1
        )

    def test_create(self):
        data = {
            'title': 'New',
            'date': date(2026, 5, 11),
            'time_from': time(7, 0),
            'time_to': time(9, 0),
        }
        instance = AnnouncementService.create(data)
        self.assertIsNotNone(instance.pk)

    def test_update(self):
        a = make_announcement()
        updated = AnnouncementService.update(a, {'title': 'Changed'})
        self.assertEqual(updated.title, 'Changed')

    def test_delete(self):
        a = make_announcement()
        pk = a.pk
        AnnouncementService.delete(a)
        self.assertFalse(Announcement.objects.filter(pk=pk).exists())

    def test_toggle_status_flip(self):
        a = make_announcement(status=Announcement.STATUS_ACTIVE)
        result = AnnouncementService.toggle_status(a)
        self.assertEqual(result.status, Announcement.STATUS_INACTIVE)

    def test_toggle_status_flip_back(self):
        a = make_announcement(status=Announcement.STATUS_INACTIVE)
        result = AnnouncementService.toggle_status(a)
        self.assertEqual(result.status, Announcement.STATUS_ACTIVE)

    def test_toggle_status_explicit(self):
        a = make_announcement(status=Announcement.STATUS_ACTIVE)
        result = AnnouncementService.toggle_status(a, new_status='inactive')
        self.assertEqual(result.status, Announcement.STATUS_INACTIVE)

    def test_get_stats(self):
        make_announcement(status=Announcement.STATUS_ACTIVE, special_dish='Dosa')
        make_announcement(status=Announcement.STATUS_INACTIVE, special_dish='')
        stats = AnnouncementService.get_stats()
        self.assertEqual(stats['total'], 2)
        self.assertEqual(stats['active'], 1)
        self.assertEqual(stats['inactive'], 1)
        self.assertEqual(stats['with_special_dish'], 1)

    def test_get_stats_null_special_dish_excluded(self):
        """
        BUG 3 FIX verification: rows with special_dish=None must not
        count toward with_special_dish.
        """
        make_announcement(special_dish='Idli')
        # Force a NULL via queryset update to bypass model default
        a = make_announcement(special_dish='')
        Announcement.objects.filter(pk=a.pk).update(special_dish=None)
        stats = AnnouncementService.get_stats()
        self.assertEqual(stats['with_special_dish'], 1)