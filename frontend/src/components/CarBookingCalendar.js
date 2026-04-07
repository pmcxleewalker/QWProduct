import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon, MapPin } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Time slots from 07:00 to 22:00
const TIME_SLOTS = [];
for (let hour = 7; hour <= 22; hour++) {
  TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:00`);
}

const CarBookingCalendar = ({ vehicle, bookings, onBookingCreated, isAdmin, tenantSlug, users = [] }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('day'); // day, week, month
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    user_name: '',
    start_time: '',
    end_time: '',
    notes: '',
    is_recurring: false,
    is_double_up_call: false,
    secondary_user_id: '',
    secondary_user_name: '',
    start_eircode: '',
    start_address: '',
    end_eircode: '',
    end_address: '',
    journey_stops: []
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [newStop, setNewStop] = useState({ eircode: '', address: '' });

  // Get bookings for this specific vehicle
  const vehicleBookings = bookings.filter(b => b.car_id === vehicle.id);

  // Check if a time slot is booked
  const isSlotBooked = (date, timeSlot) => {
    const slotStart = new Date(date);
    const [hours] = timeSlot.split(':').map(Number);
    slotStart.setHours(hours, 0, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setHours(hours + 1, 0, 0, 0);

    return vehicleBookings.find(booking => {
      const bookingStart = new Date(booking.start_time);
      const bookingEnd = new Date(booking.end_time);
      return (slotStart < bookingEnd && slotEnd > bookingStart);
    });
  };

  // Get slot status and color
  const getSlotStatus = (date, timeSlot) => {
    const booking = isSlotBooked(date, timeSlot);
    if (!booking) return { status: 'free', color: 'bg-green-100 hover:bg-green-200 text-green-800 border-green-300' };
    if (booking.is_recurring) return { status: 'recurring', color: 'bg-purple-100 text-purple-800 border-purple-300', booking };
    return { status: 'booked', color: 'bg-red-100 text-red-800 border-red-300', booking };
  };

  // Navigate dates
  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  // Format date for display
  const formatDateDisplay = (date) => {
    return date.toLocaleDateString('en-IE', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
  };

  // Handle slot click
  const handleSlotClick = (timeSlot) => {
    const slotStatus = getSlotStatus(selectedDate, timeSlot);
    if (slotStatus.status === 'free') {
      const [hours] = timeSlot.split(':').map(Number);
      const startDate = new Date(selectedDate);
      startDate.setHours(hours, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setHours(hours + 1, 0, 0, 0);
      
      setSelectedSlot(timeSlot);
      setBookingForm({
        user_name: '',
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        notes: '',
        is_recurring: false,
        is_double_up_call: false,
        secondary_user_id: '',
        secondary_user_name: ''
      });
      setShowBookingModal(true);
    }
  };

  // Submit booking
  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    // Validate mandatory journey fields
    if (!bookingForm.start_eircode || !bookingForm.end_eircode) {
      setError('Start and End Eircode are required');
      setSubmitting(false);
      return;
    }

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      await axios.post(`${API}/bookings`, {
        car_id: vehicle.id,
        user_name: bookingForm.user_name,
        start_time: bookingForm.start_time,
        end_time: bookingForm.end_time,
        notes: bookingForm.notes,
        is_recurring: bookingForm.is_recurring,
        is_double_up_call: bookingForm.is_double_up_call,
        secondary_user_id: bookingForm.secondary_user_id || null,
        secondary_user_name: bookingForm.secondary_user_name || null,
        start_eircode: bookingForm.start_eircode,
        start_address: bookingForm.start_address,
        end_eircode: bookingForm.end_eircode,
        end_address: bookingForm.end_address,
        journey_stops: bookingForm.journey_stops
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setShowBookingModal(false);
      setSelectedSlot(null);
      // Reset form
      setBookingForm({
        user_name: '',
        start_time: '',
        end_time: '',
        notes: '',
        is_recurring: false,
        start_eircode: '',
        start_address: '',
        end_eircode: '',
        end_address: '',
        journey_stops: []
      });
      if (onBookingCreated) onBookingCreated();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  // Add a stop to the journey
  const addStop = () => {
    if (newStop.eircode) {
      setBookingForm({
        ...bookingForm,
        journey_stops: [
          ...bookingForm.journey_stops,
          { ...newStop, stop_order: bookingForm.journey_stops.length }
        ]
      });
      setNewStop({ eircode: '', address: '' });
    }
  };

  // Remove a stop
  const removeStop = (index) => {
    setBookingForm({
      ...bookingForm,
      journey_stops: bookingForm.journey_stops.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden" data-testid={`car-calendar-${vehicle.id}`}>
      {/* Vehicle Header */}
      <div className="bg-blue-50 px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{vehicle.name}</h3>
            <p className="text-xs text-gray-600">{vehicle.registration}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1 text-xs rounded ${viewMode === 'day' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 text-xs rounded ${viewMode === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
        <button
          onClick={() => changeDate(-1)}
          className="p-1 hover:bg-gray-200 rounded"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="font-medium text-sm text-gray-700">
          {formatDateDisplay(selectedDate)}
        </span>
        <button
          onClick={() => changeDate(1)}
          className="p-1 hover:bg-gray-200 rounded"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-4 px-4 py-2 bg-gray-50 border-b text-xs">
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 rounded bg-green-200 border border-green-400"></div>
          <span className="text-gray-600">Free</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 rounded bg-red-200 border border-red-400"></div>
          <span className="text-gray-600">Booked</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 rounded bg-purple-200 border border-purple-400"></div>
          <span className="text-gray-600">Recurring</span>
        </div>
      </div>

      {/* Time Slots Grid */}
      <div className="p-4">
        <div className="grid grid-cols-4 gap-2">
          {TIME_SLOTS.map(timeSlot => {
            const slotInfo = getSlotStatus(selectedDate, timeSlot);
            const isClickable = slotInfo.status === 'free';
            
            return (
              <button
                key={timeSlot}
                onClick={() => handleSlotClick(timeSlot)}
                disabled={!isClickable}
                className={`p-2 rounded border text-xs font-medium transition-all ${slotInfo.color} ${
                  isClickable ? 'cursor-pointer' : 'cursor-default'
                }`}
                title={slotInfo.booking ? `${slotInfo.booking.user_name || 'Booked'}` : 'Available'}
              >
                <div>{timeSlot}</div>
                {slotInfo.booking && (
                  <div className="truncate text-[10px] mt-0.5 opacity-75">
                    {slotInfo.booking.user_name || 'Booked'}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Book Button */}
      <div className="px-4 pb-4">
        <button
          onClick={() => {
            setSelectedSlot(null);
            const now = new Date();
            now.setMinutes(0, 0, 0);
            const end = new Date(now);
            end.setHours(end.getHours() + 1);
            setBookingForm({
              user_name: '',
              start_time: now.toISOString(),
              end_time: end.toISOString(),
              notes: '',
              is_recurring: false,
              is_double_up_call: false,
              secondary_user_id: '',
              secondary_user_name: '',
              start_eircode: '',
              start_address: '',
              end_eircode: '',
              end_address: '',
              journey_stops: []
            });
            setShowBookingModal(true);
          }}
          className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
          data-testid={`book-btn-${vehicle.id}`}
        >
          <Plus size={16} />
          <span>Book</span>
        </button>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold">New Booking</h3>
              <button onClick={() => setShowBookingModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmitBooking} className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
              )}
              
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-blue-900">{vehicle.name}</p>
                <p className="text-xs text-blue-700">{vehicle.registration}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name / Driver</label>
                <input
                  type="text"
                  value={bookingForm.user_name}
                  onChange={(e) => setBookingForm({ ...bookingForm, user_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                  placeholder="Enter name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    value={bookingForm.start_time.slice(0, 16)}
                    onChange={(e) => setBookingForm({ ...bookingForm, start_time: new Date(e.target.value).toISOString() })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    value={bookingForm.end_time.slice(0, 16)}
                    onChange={(e) => setBookingForm({ ...bookingForm, end_time: new Date(e.target.value).toISOString() })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={bookingForm.notes}
                  onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Purpose, instructions, etc."
                />
              </div>

              {/* Journey Details - Mandatory */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <MapPin className="mr-2 text-blue-600" size={18} />
                  Journey Details <span className="text-red-500 ml-1">*</span>
                </h4>
                
                {/* Start Location */}
                <div className="bg-green-50 p-3 rounded-lg mb-3">
                  <label className="block text-sm font-medium text-green-800 mb-1">
                    Start Eircode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bookingForm.start_eircode}
                    onChange={(e) => setBookingForm({ ...bookingForm, start_eircode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 mb-2"
                    placeholder="e.g. D02 X285"
                    required
                  />
                  <input
                    type="text"
                    value={bookingForm.start_address}
                    onChange={(e) => setBookingForm({ ...bookingForm, start_address: e.target.value })}
                    className="w-full px-3 py-2 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                    placeholder="Address (optional)"
                  />
                </div>

                {/* Stops */}
                {bookingForm.journey_stops.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {bookingForm.journey_stops.map((stop, index) => (
                      <div key={index} className="flex items-center space-x-2 bg-amber-50 p-2 rounded-lg">
                        <div className="flex-1">
                          <span className="text-xs text-amber-700 font-medium">Stop {index + 1}</span>
                          <p className="text-sm font-medium text-amber-900">{stop.eircode}</p>
                          {stop.address && <p className="text-xs text-amber-600">{stop.address}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeStop(index)}
                          className="p-1 text-red-500 hover:bg-red-100 rounded"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Stop */}
                <div className="flex items-end space-x-2 mb-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Add Stop (optional)</label>
                    <input
                      type="text"
                      value={newStop.eircode}
                      onChange={(e) => setNewStop({ ...newStop, eircode: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="Stop Eircode"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addStop}
                    disabled={!newStop.eircode}
                    className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 disabled:opacity-50"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                {/* End Location */}
                <div className="bg-red-50 p-3 rounded-lg">
                  <label className="block text-sm font-medium text-red-800 mb-1">
                    End Eircode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bookingForm.end_eircode}
                    onChange={(e) => setBookingForm({ ...bookingForm, end_eircode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 mb-2"
                    placeholder="e.g. D04 Y123"
                    required
                  />
                  <input
                    type="text"
                    value={bookingForm.end_address}
                    onChange={(e) => setBookingForm({ ...bookingForm, end_address: e.target.value })}
                    className="w-full px-3 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 text-sm"
                    placeholder="Address (optional)"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_recurring"
                  checked={bookingForm.is_recurring}
                  onChange={(e) => setBookingForm({ ...bookingForm, is_recurring: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_recurring" className="text-sm text-gray-700">Recurring booking</label>
              </div>

              {/* Double-Up Call Option */}
              <div className="border-t pt-4">
                <div className="flex items-center space-x-2 mb-3">
                  <input
                    type="checkbox"
                    id="is_double_up"
                    checked={bookingForm.is_double_up_call}
                    onChange={(e) => setBookingForm({ 
                      ...bookingForm, 
                      is_double_up_call: e.target.checked,
                      secondary_user_id: '',
                      secondary_user_name: ''
                    })}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="is_double_up" className="text-sm text-gray-700">
                    Double-up call (add another user)
                  </label>
                </div>

                {bookingForm.is_double_up_call && (
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <label className="block text-sm font-medium text-purple-800 mb-1">
                      Select Secondary User
                    </label>
                    {users.length > 0 ? (
                      <select
                        value={bookingForm.secondary_user_id}
                        onChange={(e) => {
                          const selectedUser = users.find(u => u.id === e.target.value);
                          setBookingForm({
                            ...bookingForm,
                            secondary_user_id: e.target.value,
                            secondary_user_name: selectedUser?.name || ''
                          });
                        }}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        required={bookingForm.is_double_up_call}
                      >
                        <option value="">-- Select User --</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={bookingForm.secondary_user_name}
                        onChange={(e) => setBookingForm({
                          ...bookingForm,
                          secondary_user_name: e.target.value
                        })}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter secondary user name"
                        required={bookingForm.is_double_up_call}
                      />
                    )}
                    <p className="text-xs text-purple-600 mt-2">
                      This booking will also appear in the secondary user's calendar
                    </p>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Booking...' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CarBookingCalendar;
