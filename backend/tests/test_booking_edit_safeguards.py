"""Offline regression tests: no production database, HTTP, or app startup."""
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.booking_edit_validation import validate_booking_edit, BookingEditError


class Bookings:
    def __init__(self, rows):
        self.rows = rows

    def find(self, query, projection):
        async def results():
            for row in self.rows:
                if (row['tenant_id'] == query['tenant_id']
                        and row['id'] != query['id']['$ne']
                        and row['status'] not in query['status']['$nin']):
                    yield row
        return results()


class BookingEditTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.booking = dict(id='b1', tenant_id='t1', car_id='c1',
                            created_by_user_id='admin', assigned_to_user_id='driver',
                            start_time='2026-09-07T10:00:00Z',
                            end_time='2026-09-07T11:00:00Z', status='approved')
        self.vehicle = dict(id='c1', tenant_id='t1', nct_due_date='2026-09-07',
                            tax_due_date='2026-09-07')
        self.rows = []
        self.db = SimpleNamespace(
            vehicles=SimpleNamespace(find_one=AsyncMock(return_value=self.vehicle)),
            bookings=Bookings(self.rows),
            users=SimpleNamespace(find_one=AsyncMock(return_value={'name': 'New Driver'})),
            memberships=SimpleNamespace(find_one=AsyncMock(return_value={'is_active': True})))

    async def check(self, changes, code=None, admin=True):
        if code:
            with self.assertRaises(BookingEditError) as caught:
                await validate_booking_edit(self.db, self.booking, changes, 't1', admin)
            self.assertEqual(caught.exception.status_code, code)
        else:
            await validate_booking_edit(self.db, self.booking, changes, 't1', admin)

    def other(self, **overrides):
        return {**self.booking, 'id': 'b2', 'car_id': 'c2', **overrides}

    async def test_valid_edit_and_self_exclusion(self):
        self.rows.append(self.booking)
        await self.check({'end_time': '2026-09-07T11:30:00Z'})

    async def test_blocked_vehicle(self):
        self.vehicle['is_blocked'] = True
        await self.check({'car_id': 'c2'}, 400)

    async def test_missing_or_other_tenant_vehicle(self):
        self.db.vehicles.find_one.return_value = None
        await self.check({'car_id': 'foreign-car'}, 404)
        self.db.vehicles.find_one.assert_awaited_once_with({'tenant_id': 't1', 'id': 'foreign-car'})

    async def test_compliance_expiry(self):
        for field in ('nct_due_date', 'tax_due_date'):
            with self.subTest(field=field):
                self.vehicle[field] = '2026-09-06'
                await self.check({'end_time': '2026-09-07T11:30:00Z'}, 409)
                self.vehicle[field] = '2026-09-07'

    async def test_expiry_on_end_date_allowed(self):
        await self.check({'end_time': '2026-09-07T23:00:00Z'})

    async def test_invalid_or_reversed_times(self):
        for value in ('bad-date', '2026-09-07T09:00:00Z', '2026-09-07T10:00:00Z'):
            await self.check({'end_time': value}, 400)

    async def test_assigned_driver_overlap_with_offset(self):
        self.rows.append(self.other(start_time='2026-09-07T12:00:00+01:00',
                                    end_time='2026-09-07T13:00:00+01:00'))
        await self.check({'end_time': '2026-09-07T11:30:00Z'}, 409)

    async def test_secondary_driver_overlap(self):
        self.rows.append(self.other(assigned_to_user_id='other', is_double_up_call=True,
                                    secondary_user_id='helper'))
        await self.check({'is_double_up_call': True, 'secondary_user_id': 'helper'}, 409)

    async def test_admin_creator_is_not_assigned_driver(self):
        self.rows.append(self.other(assigned_to_user_id='different-driver'))
        await self.check({'end_time': '2026-09-07T11:30:00Z'})

    async def test_vehicle_overlap(self):
        self.rows.append(self.other(car_id='c1', assigned_to_user_id='different-driver'))
        await self.check({'end_time': '2026-09-07T11:30:00Z'}, 409)

    async def test_adjacent_bookings_allowed(self):
        self.rows.append(self.other(start_time='2026-09-07T11:30:00Z',
                                    end_time='2026-09-07T12:30:00Z'))
        await self.check({'end_time': '2026-09-07T11:30:00Z'})

    async def test_other_tenants_and_cancelled_bookings_ignored(self):
        self.rows.extend([self.other(tenant_id='t2'), self.other(status='cancelled'),
                          self.other(status='rejected')])
        await self.check({'end_time': '2026-09-07T11:30:00Z'})

    async def test_notes_and_cancellation_allowed_when_blocked(self):
        self.vehicle['is_blocked'] = True
        await self.check({'notes': 'Please clean after use'})
        await self.check({'status': 'cancelled'})
        self.db.vehicles.find_one.assert_not_awaited()

    async def test_reactivation_rechecks_vehicle(self):
        self.booking['status'] = 'cancelled'
        self.vehicle['is_blocked'] = True
        await self.check({'status': 'approved'}, 400)

    async def test_staff_cannot_reassign(self):
        await self.check({'assigned_to_user_id': 'new-driver'}, 403, admin=False)

    async def test_admin_reassignment_updates_name(self):
        changes = {'assigned_to_user_id': 'new-driver'}
        await self.check(changes)
        self.assertEqual(changes['user_name'], 'New Driver')

    async def test_assignee_must_be_active_member(self):
        self.db.memberships.find_one.return_value = None
        await self.check({'assigned_to_user_id': 'outsider'}, 400)


if __name__ == '__main__':
    unittest.main()
