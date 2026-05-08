import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon, Car, Filter, BarChart3 } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AllCarsCalendar = ({ vehicles, bookings, onBookingCreated }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState('all');
  
  // Filter bookings by selected vehicle
  const filteredBookings = useMemo(() => {
    if (selectedVehicleFilter === 'all') return bookings;
    return bookings.filter(b => b.car_id === selectedVehicleFilter);
  }, [bookings, selectedVehicleFilter]);

  // Calculate month statistics
  const monthStats = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
    
    const monthBookings = filteredBookings.filter(booking => {
      const bookingStart = new Date(booking.start_time);
      return bookingStart >= monthStart && bookingStart <= monthEnd;
    });
    
    const recurringCount = monthBookings.filter(b => b.is_recurring).length;
    const pendingCount = monthBookings.filter(b => b.status === 'pending').length;
    const confirmedCount = monthBookings.length - pendingCount;
    
    // Get unique vehicles used this month
    const vehiclesUsed = new Set(monthBookings.map(b => b.car_id)).size;
    
    return {
      total: monthBookings.length,
      confirmed: confirmedCount,
      pending: pendingCount,
      recurring: recurringCount,
      vehiclesUsed
    };
  }, [currentDate, filteredBookings]);
  
  // Get calendar days for the current month
  // Get calendar days for the current month
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    
    // Add padding for days before first of month
    const startPadding = firstDay.getDay();
    for (let i = 0; i < startPadding; i++) {
      const prevDate = new Date(year, month, -startPadding + i + 1);
      days.push({ date: prevDate, isCurrentMonth: false });
    }
    
    // Add days of current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push({ date: new Date(year, month, day), isCurrentMonth: true });
    }
    
    // Add padding for days after last of month
    const endPadding = 6 - lastDay.getDay();
    for (let i = 1; i <= endPadding; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    
    return days;
  }, [currentDate]);

  // Get bookings for a specific day (using filtered bookings)
  const getBookingsForDay = (date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    
    return filteredBookings.filter(booking => {
      const bookingStart = new Date(booking.start_time);
      return bookingStart >= dayStart && bookingStart <= dayEnd;
    });
  };

  // Navigate months
  const changeMonth = (delta) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  // Go to today
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Format time
  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('en-IE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // Get vehicle name by ID
  const getVehicleName = (carId) => {
    const vehicle = vehicles.find(v => v.id === carId);
    return vehicle ? vehicle.name : 'Unknown Vehicle';
  };

  // Get vehicle registration by ID
  const getVehicleReg = (carId) => {
    const vehicle = vehicles.find(v => v.id === carId);
    return vehicle ? vehicle.registration : '';
  };

  // Handle day click
  const handleDayClick = (dayInfo) => {
    setSelectedDay(dayInfo.date);
    setShowDayModal(true);
  };

  // Check if date is today
  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden" data-testid="all-cars-calendar">
      {/* Header with Stats */}
      <div className="bg-white text-slate-900 px-4 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg flex items-center space-x-2 text-slate-900">
            <CalendarIcon size={20} className="text-blue-600" />
            <span>All Cars Calendar</span>
          </h2>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium"
          >
            Go to Today
          </button>
        </div>
        
        {/* Month Statistics */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-center">
            <p className="text-blue-700 font-medium">This Month</p>
            <p className="text-xl font-bold text-blue-900">{monthStats.total}</p>
          </div>
          <div className="bg-rose-50 border border-rose-100 rounded-lg p-2 text-center">
            <p className="text-rose-700 font-medium">Confirmed</p>
            <p className="text-xl font-bold text-rose-900">{monthStats.confirmed}</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 text-center">
            <p className="text-amber-700 font-medium">Pending</p>
            <p className="text-xl font-bold text-amber-900">{monthStats.pending}</p>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-lg p-2 text-center">
            <p className="text-purple-700 font-medium">Recurring</p>
            <p className="text-xl font-bold text-purple-900">{monthStats.recurring}</p>
          </div>
        </div>
      </div>

      {/* Month Navigation & Filter */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
        <button
          onClick={() => changeMonth(-1)}
          className="p-2 hover:bg-gray-200 rounded-lg"
        >
          <ChevronLeft size={20} />
        </button>
        <h3 className="text-lg font-semibold text-gray-900">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h3>
        <button
          onClick={() => changeMonth(1)}
          className="p-2 hover:bg-gray-200 rounded-lg"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      
      {/* Vehicle Filter */}
      <div className="px-4 py-2 bg-gray-50 border-b flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter size={16} className="text-gray-500" />
          <select
            value={selectedVehicleFilter}
            onChange={(e) => setSelectedVehicleFilter(e.target.value)}
            className="text-sm border-gray-300 rounded-lg py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
            data-testid="vehicle-filter"
          >
            <option value="all">All Vehicles ({vehicles.length})</option>
            {vehicles.map(vehicle => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.name} ({vehicle.registration})
              </option>
            ))}
          </select>
        </div>
        <span className="text-xs text-gray-500">
          {monthStats.vehiclesUsed} vehicle{monthStats.vehiclesUsed !== 1 ? 's' : ''} used this month
        </span>
      </div>

      {/* Legend - Standardized Colors: Green=Free, Red=Booked, Purple=Recurring */}
      <div className="flex items-center justify-center space-x-6 px-4 py-2 bg-gray-50 border-b text-xs">
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 rounded bg-red-500"></div>
          <span className="text-gray-600">Booked</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 rounded bg-purple-500"></div>
          <span className="text-gray-600">Recurring</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 rounded bg-amber-400"></div>
          <span className="text-gray-600">Pending</span>
        </div>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 bg-gray-100">
        {dayNames.map(day => (
          <div key={day} className="py-2 text-center text-xs font-semibold text-gray-600">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((dayInfo, index) => {
          const dayBookings = getBookingsForDay(dayInfo.date);
          const bookingCount = dayBookings.length;
          const displayBookings = dayBookings.slice(0, 3);
          const moreCount = bookingCount - 3;
          
          return (
            <div
              key={index}
              onClick={() => handleDayClick(dayInfo)}
              className={`min-h-[120px] border-b border-r p-1 cursor-pointer hover:bg-gray-50 transition-colors ${
                !dayInfo.isCurrentMonth ? 'bg-gray-50' : ''
              } ${isToday(dayInfo.date) ? 'bg-blue-50' : ''}`}
            >
              {/* Date Number and Count */}
              <div className="flex items-start justify-between mb-1">
                <span className={`text-sm font-medium ${
                  !dayInfo.isCurrentMonth ? 'text-gray-400' : 
                  isToday(dayInfo.date) ? 'text-blue-600' : 'text-gray-900'
                }`}>
                  {dayInfo.date.getDate()}
                </span>
                {bookingCount > 0 && (
                  <span className="text-xs font-bold text-gray-500 bg-gray-200 px-1.5 rounded">
                    {bookingCount}
                  </span>
                )}
              </div>
              
              {/* Booking Pills - Standardized: Red=Booked, Purple=Recurring, Amber=Pending */}
              <div className="space-y-1">
                {displayBookings.map((booking, idx) => (
                  <div
                    key={booking.id || idx}
                    className={`text-[10px] px-1.5 py-0.5 rounded truncate ${
                      booking.is_recurring 
                        ? 'bg-purple-100 text-purple-800' 
                        : booking.status === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-800'
                    }`}
                    title={`${formatTime(booking.start_time)} - ${getVehicleName(booking.car_id)}`}
                  >
                    {formatTime(booking.start_time)} {getVehicleName(booking.car_id).split(' ')[0]}
                  </div>
                ))}
                {moreCount > 0 && (
                  <div className="text-[10px] text-blue-600 font-medium pl-1">
                    +{moreCount} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Day Detail Modal */}
      {showDayModal && selectedDay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b bg-blue-600 text-white">
              <h3 className="text-lg font-bold">
                {selectedDay.toLocaleDateString('en-IE', { 
                  weekday: 'long',
                  day: 'numeric', 
                  month: 'long',
                  year: 'numeric'
                })}
              </h3>
              <button 
                onClick={() => setShowDayModal(false)} 
                className="p-1 hover:bg-white/20 rounded"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {(() => {
                const dayBookings = getBookingsForDay(selectedDay);
                if (dayBookings.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-500">
                      <CalendarIcon size={40} className="mx-auto mb-3 opacity-50" />
                      <p>No bookings for this day</p>
                    </div>
                  );
                }
                
                // Sort by start time
                const sortedBookings = [...dayBookings].sort((a, b) => 
                  new Date(a.start_time) - new Date(b.start_time)
                );
                
                return (
                  <div className="space-y-3">
                    {sortedBookings.map((booking, idx) => (
                      <div 
                        key={booking.id || idx}
                        className={`p-3 rounded-lg border ${
                          booking.is_recurring 
                            ? 'bg-purple-50 border-purple-200' 
                            : booking.status === 'pending'
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-2">
                            <Car size={16} className={
                              booking.is_recurring ? 'text-purple-600' : 
                              booking.status === 'pending' ? 'text-amber-600' : 'text-red-600'
                            } />
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">
                                {getVehicleName(booking.car_id)}
                              </p>
                              <p className="text-xs text-gray-600">
                                {getVehicleReg(booking.car_id)}
                              </p>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            booking.is_recurring 
                              ? 'bg-purple-200 text-purple-800' 
                              : booking.status === 'pending'
                              ? 'bg-amber-200 text-amber-800'
                              : 'bg-red-200 text-red-800'
                          }`}>
                            {booking.is_recurring ? 'Recurring' : booking.status === 'pending' ? 'Pending' : 'Booked'}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-gray-600">
                          <p><strong>Time:</strong> {formatTime(booking.start_time)} - {formatTime(booking.end_time)}</p>
                          <p><strong>Driver:</strong> {booking.user_name || 'Not specified'}</p>
                          {booking.notes && <p><strong>Notes:</strong> {booking.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowDayModal(false)}
                className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllCarsCalendar;
