"""Booking edit validation, without application startup or external services."""
from datetime import datetime, timezone


class BookingEditError(ValueError):
    def __init__(self, status_code, detail):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def parse_time(value):
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed
    except (ValueError, TypeError, AttributeError):
        raise BookingEditError(400, 'Invalid booking date or time')


def drivers(booking):
    primary = (booking.get('assigned_to_user_id') or booking.get('user_id')
               or booking.get('created_by_user_id'))
    result = {primary} if primary else set()
    if booking.get('is_double_up_call') and booking.get('secondary_user_id'):
        result.add(booking['secondary_user_id'])
    return result


async def validate_booking_edit(db, booking, changes, tenant_id, is_admin):
    candidate = {**booking, **changes}
    relevant = {'car_id', 'start_time', 'end_time', 'assigned_to_user_id',
                'secondary_user_id', 'is_double_up_call', 'status'}
    if not any(key in changes and changes[key] != booking.get(key) for key in relevant):
        return

    if 'assigned_to_user_id' in changes and changes['assigned_to_user_id'] != booking.get('assigned_to_user_id'):
        if not is_admin:
            raise BookingEditError(403, 'Only admins can assign a booking to another user.')
        assignee = await db.users.find_one({'id': changes['assigned_to_user_id']})
        membership = await db.memberships.find_one({
            'user_id': changes['assigned_to_user_id'], 'tenant_id': tenant_id})
        if not assignee or assignee.get('is_active') is False or not membership or membership.get('is_active') is False:
            raise BookingEditError(400, 'Assigned user is not an active member of this tenant.')
        changes['user_name'] = assignee.get('name') or candidate.get('user_name', '')

    # Cancellation must remain possible even if the vehicle is now unavailable.
    if candidate.get('status') in ('cancelled', 'rejected'):
        return
    start, end = parse_time(candidate.get('start_time')), parse_time(candidate.get('end_time'))
    if end <= start:
        raise BookingEditError(400, 'Booking end time must be after start time')
    vehicle = await db.vehicles.find_one({'tenant_id': tenant_id, 'id': candidate.get('car_id')})
    if not vehicle:
        raise BookingEditError(404, 'Vehicle not found')
    if vehicle.get('is_blocked'):
        raise BookingEditError(400, 'Vehicle is currently blocked')
    for field, label in [('nct_due_date', 'NCT'), ('tax_due_date', 'Tax')]:
        raw = vehicle.get(field)
        if not raw:
            continue
        try:
            due = datetime.fromisoformat(str(raw).split('T')[0]).date()
        except (ValueError, TypeError):
            continue  # Match new-booking handling of legacy compliance data.
        if due < end.date():
            raise BookingEditError(409, f'Cannot book this vehicle — {label} expires before the booking ends.')

    # Compare actual instants, including legacy timestamps with different offsets.
    cursor = db.bookings.find({'tenant_id': tenant_id, 'id': {'$ne': booking['id']},
                               'status': {'$nin': ['rejected', 'cancelled']}}, {'_id': 0})
    candidate_drivers = drivers(candidate)
    async for other in cursor:
        if other.get('car_id') != candidate.get('car_id') and not candidate_drivers.intersection(drivers(other)):
            continue
        other_start, other_end = parse_time(other.get('start_time')), parse_time(other.get('end_time'))
        if other_start < end and other_end > start:
            if other.get('car_id') == candidate.get('car_id'):
                raise BookingEditError(409, 'Vehicle is already booked at this time')
            raise BookingEditError(409, 'A selected driver already has a booking at this time')
