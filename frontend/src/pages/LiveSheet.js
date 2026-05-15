import React, { useState, useEffect } from 'react';
import { statusAPI, bookingAPI } from '../api/api';
import StatusBadge from '../components/StatusBadge';
import { RefreshCw, Download, MapPin, User, Clock } from 'lucide-react';

const LiveSheet = () => {
  const [liveStatus, setLiveStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchLiveStatus = async () => {
    try {
      setLoading(true);
      // Fetch vehicles AND bookings in parallel — Live Sheet needs booking
      // info (driver, time window, location, notes) for every car that is
      // currently Booked/In Use/Recurring. Without the join, the right-hand
      // columns are stuck on "-".
      const [vehiclesRes, bookingsRes] = await Promise.all([
        statusAPI.getLive(),
        bookingAPI.getAll().catch(() => ({ data: [] }))
      ]);

      const vehicles = vehiclesRes.data || [];
      const allBookings = bookingsRes.data || [];
      const now = new Date();

      // Build the "currently active booking" for each car (the one whose
      // window covers `now`). If none, fall back to the next upcoming
      // booking starting within the next 24h so the dispatcher can see
      // who's about to take the car. Cancelled/rejected bookings ignored.
      const liveBookingByCar = new Map();
      const upcomingBookingByCar = new Map();
      allBookings.forEach(b => {
        if (!b.car_id || !b.start_time || !b.end_time) return;
        if (b.status === 'rejected' || b.status === 'cancelled') return;
        const start = new Date(b.start_time);
        const end = new Date(b.end_time);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
        if (start <= now && end >= now) {
          // Active right now — prefer the latest-starting one if multiple
          const existing = liveBookingByCar.get(b.car_id);
          if (!existing || new Date(existing.start_time) < start) {
            liveBookingByCar.set(b.car_id, b);
          }
        } else if (start > now && start - now <= 24 * 60 * 60 * 1000) {
          const existing = upcomingBookingByCar.get(b.car_id);
          if (!existing || new Date(existing.start_time) > start) {
            upcomingBookingByCar.set(b.car_id, b);
          }
        }
      });

      const transformedData = vehicles.map(item => {
        const car = item.car ? item.car : item;
        const existingStatus = item.car ? item.latest_status : null;
        const activeBooking = liveBookingByCar.get(car.id);
        const upcomingBooking = !activeBooking ? upcomingBookingByCar.get(car.id) : null;
        const booking = activeBooking || upcomingBooking;

        // Synthesize a `latest_status` from the booking when present so the
        // existing table columns keep working as-is.
        let latest_status = existingStatus;
        if (booking) {
          const isRecurring = booking.is_recurring === true || !!booking.recurring_group_id;
          latest_status = {
            ...(existingStatus || {}),
            booking_id: booking.id,
            booked_by: booking.user_name || booking.created_by_email,
            user_name: booking.user_name || booking.created_by_email,
            location: booking.location || booking.start_address || existingStatus?.location || null,
            timestamp: booking.start_time,
            start_time: booking.start_time,
            end_time: booking.end_time,
            is_recurring: isRecurring,
            is_upcoming: !!upcomingBooking,
            notes: booking.notes || booking.purpose || existingStatus?.notes || null,
          };
        }
        return { car, latest_status };
      });

      setLiveStatus(transformedData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching live status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchLiveStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate counters
  const counters = {
    total: liveStatus.length,
    free: liveStatus.filter(item => item.car.current_status === 'Free' && !item.car.is_blocked).length,
    booked: liveStatus.filter(item => item.car.current_status === 'Booked' && !item.car.is_blocked).length,
    recurring: liveStatus.filter(item => item.car.current_status === 'Recurring' && !item.car.is_blocked).length,
    inUse: liveStatus.filter(item => item.car.current_status === 'In Use' && !item.car.is_blocked).length,
    needsCleaning: liveStatus.filter(item => item.car.current_status === 'Needs Cleaning' && !item.car.is_blocked).length,
    needsRepair: liveStatus.filter(item => item.car.current_status === 'Needs Repair' && !item.car.is_blocked).length,
    blocked: liveStatus.filter(item => item.car.is_blocked).length,
  };

  const formatTime = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleString('en-IE', { 
      day: 'numeric',
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
  };

  const exportToCSV = () => {
    const headers = ['Vehicle', 'Registration', 'Status', 'Location', 'Start Time', 'End Time', 'Booked By', 'Notes'];
    const rows = liveStatus.map(item => [
      item.car.name,
      item.car.registration,
      item.car.current_status,
      item.latest_status?.location || '-',
      item.latest_status?.start_time ? formatTime(item.latest_status.start_time) : (item.latest_status?.timestamp ? formatTime(item.latest_status.timestamp) : '-'),
      item.latest_status?.end_time ? formatTime(item.latest_status.end_time) : '-',
      item.latest_status?.booked_by || item.latest_status?.user_name || '-',
      item.latest_status?.notes || '-'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quick-wing-fleet-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (loading && liveStatus.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="live-sheet-title">Live Fleet Sheet</h1>
          <p className="text-sm text-gray-500 flex items-center mt-1">
            <Clock size={14} className="mr-1" />
            Last updated: {lastUpdated ? formatTime(lastUpdated) : 'Loading...'}
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={exportToCSV}
            data-testid="export-button"
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download size={18} />
            <span>Export Excel</span>
          </button>
          <button
            onClick={fetchLiveStatus}
            data-testid="refresh-button"
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={18} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Live Counters */}
      <div className="grid grid-cols-2 md:grid-cols-8 gap-4 mb-6">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-600">Total Cars</p>
          <p className="text-3xl font-bold text-blue-900" data-testid="counter-total">{counters.total}</p>
        </div>
        
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
          <p className="text-sm font-medium text-green-600">Free</p>
          <p className="text-3xl font-bold text-green-900" data-testid="counter-free">{counters.free}</p>
        </div>

        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <p className="text-sm font-medium text-red-600">Booked</p>
          <p className="text-3xl font-bold text-red-900" data-testid="counter-booked">{counters.booked}</p>
        </div>

        <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
          <p className="text-sm font-medium text-purple-600">Recurring</p>
          <p className="text-3xl font-bold text-purple-900" data-testid="counter-recurring">{counters.recurring}</p>
        </div>
        
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-600">In Use</p>
          <p className="text-3xl font-bold text-blue-900" data-testid="counter-in-use">{counters.inUse}</p>
        </div>
        
        <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
          <p className="text-sm font-medium text-orange-600">Needs Cleaning</p>
          <p className="text-3xl font-bold text-orange-900" data-testid="counter-cleaning">{counters.needsCleaning}</p>
        </div>
        
        <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
          <p className="text-sm font-medium text-orange-700">Needs Repair</p>
          <p className="text-3xl font-bold text-orange-900" data-testid="counter-repair">{counters.needsRepair}</p>
        </div>

        <div className="bg-gray-100 border-2 border-gray-300 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700">Blocked</p>
          <p className="text-3xl font-bold text-gray-900" data-testid="counter-blocked">{counters.blocked}</p>
        </div>
      </div>

      {/* Table View */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vehicle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Booking Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Booked By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {liveStatus.map((item) => (
                <tr key={item.car.id} data-testid={`row-${item.car.id}`} className={`hover:bg-gray-50 ${item.car.is_blocked ? 'bg-gray-100' : ''} ${item.car.current_status === 'Booked' ? 'bg-red-50' : ''} ${item.car.current_status === 'Recurring' ? 'bg-purple-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{item.car.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{item.car.registration}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge 
                      status={item.car.current_status} 
                      isBlocked={item.car.is_blocked}
                      blockReason={item.car.block_reason}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {item.latest_status?.location ? (
                        <span className="flex items-center">
                          <MapPin size={14} className="mr-1 text-blue-600" />
                          {item.latest_status.location}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {item.latest_status?.start_time ? (
                        <div data-testid={`row-${item.car.id}-time`}>
                          <div className={item.latest_status?.is_upcoming ? 'text-amber-700 font-medium' : ''}>
                            {item.latest_status?.is_upcoming ? 'Next: ' : ''}
                            {formatTime(item.latest_status.start_time)}
                          </div>
                          {item.latest_status?.end_time && !item.latest_status?.is_upcoming && (
                            <div className="text-xs text-gray-400">
                              until {formatTime(item.latest_status.end_time)}
                            </div>
                          )}
                        </div>
                      ) : item.latest_status?.timestamp ? formatTime(item.latest_status.timestamp) : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {item.latest_status?.booked_by || item.latest_status?.user_name ? (
                        <span
                          className={`flex items-center ${
                            item.latest_status?.is_recurring ? 'text-purple-700' :
                            (item.car.current_status === 'Booked' || item.car.current_status === 'In Use') ? 'text-red-700' :
                            item.latest_status?.is_upcoming ? 'text-amber-700' : ''
                          }`}
                          data-testid={`row-${item.car.id}-user`}
                        >
                          <User
                            size={14}
                            className={`mr-1 ${
                              item.latest_status?.is_recurring ? 'text-purple-600' :
                              (item.car.current_status === 'Booked' || item.car.current_status === 'In Use') ? 'text-red-600' :
                              item.latest_status?.is_upcoming ? 'text-amber-600' : 'text-gray-400'
                            }`}
                          />
                          {item.latest_status.booked_by || item.latest_status.user_name}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500 max-w-xs truncate" data-testid={`row-${item.car.id}-notes`}>
                      {item.latest_status?.notes ? (
                        <span className={
                          item.latest_status?.is_recurring ? 'text-purple-700 font-medium' :
                          (item.car.current_status === 'Booked' || item.car.current_status === 'In Use') ? 'text-red-700' :
                          item.latest_status?.is_upcoming ? 'text-amber-700' : ''
                        }>
                          {item.latest_status?.is_recurring ? '🔄 ' : ''}
                          {item.latest_status.notes}
                        </span>
                      ) : item.car.current_status === 'Recurring' ? (
                        <span className="text-purple-700 font-medium">🔄 Recurring booking</span>
                      ) : item.car.current_status === 'Booked' ? (
                        <span className="text-red-700 font-medium">Currently booked</span>
                      ) : '-'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {liveStatus.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No vehicles in the fleet. Add vehicles from the Admin panel.</p>
        </div>
      )}
    </div>
  );
};

export default LiveSheet;
