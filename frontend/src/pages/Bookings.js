import React, { useState, useEffect } from 'react';
import { bookingAPI, carAPI } from '../api/api';
import { Calendar as CalendarIcon, Plus, Trash2, AlertCircle, ChevronLeft, ChevronRight, List, Grid, Car, X, Clock, User, MapPin, Edit, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import EditBookingModal from '../components/EditBookingModal';

const Bookings = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'list'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCar, setSelectedCar] = useState('all'); // 'all' or car id
  const [selectedBooking, setSelectedBooking] = useState(null); // For modal preview
  const [editingBooking, setEditingBooking] = useState(null); // For edit modal
  const [selectedDateBookings, setSelectedDateBookings] = useState(null); // For day preview modal
  const [selectedDateStr, setSelectedDateStr] = useState(''); // Selected date string
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  
  const [formData, setFormData] = useState({
    car_id: '',
    user_name: '',
    start_time: '',
    end_time: '',
    destination_notes: '',
    is_recurring: false,
    recurrence_type: '',
    recurrence_end_date: '',
    recurrence_count: '',
  });

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [bookingsRes, carsRes] = await Promise.all([
        bookingAPI.getAll(),
        carAPI.getAll(),
      ]);
      setBookings(bookingsRes.data);
      setCars(carsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const bookingData = {
        car_id: formData.car_id,
        user_name: formData.user_name,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
        destination_notes: formData.destination_notes || '',
        is_recurring: false,
      };
      
      // Add recurrence data if recurring
      if (formData.is_recurring && formData.recurrence_type) {
        bookingData.is_recurring = true;
        bookingData.recurrence_type = formData.recurrence_type;
        
        if (formData.recurrence_end_date) {
          bookingData.recurrence_end_date = new Date(formData.recurrence_end_date).toISOString();
        }
        
        if (formData.recurrence_count && formData.recurrence_count !== '') {
          bookingData.recurrence_count = parseInt(formData.recurrence_count, 10);
        }
      }
      
      await bookingAPI.create(bookingData);
      
      const isRecurring = formData.is_recurring && formData.recurrence_type;
      const isStaff = user?.role !== 'admin';
      
      if (isRecurring && isStaff) {
        setSuccess('Recurring booking submitted for admin approval!');
      } else {
        setSuccess('Booking created successfully!');
      }
      
      setShowForm(false);
      setFormData({
        car_id: '',
        user_name: '',
        start_time: '',
        end_time: '',
        destination_notes: '',
        is_recurring: false,
        recurrence_type: '',
        recurrence_end_date: '',
        recurrence_count: '',
      });
      fetchData(); // Auto-refresh calendar
    } catch (err) {
      // Handle error - detail can be string or array of validation errors
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail)) {
        // Validation errors come as array of objects
        setError(detail.map(e => e.msg || e.message || 'Validation error').join(', '));
      } else if (detail && typeof detail === 'object') {
        setError(detail.msg || detail.message || 'Failed to create booking');
      } else {
        setError('Failed to create booking');
      }
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this booking?')) return;
    
    try {
      await bookingAPI.delete(id);
      setSuccess('Booking deleted successfully');
      fetchData(); // Auto-refresh calendar
    } catch (err) {
      setError('Failed to delete booking');
    }
  };

  const getCarName = (carId) => {
    const car = cars.find(c => c.id === carId);
    return car ? car.name : 'Unknown';
  };

  const getCarInfo = (carId) => {
    return cars.find(c => c.id === carId);
  };

  const getCarColor = (carId) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 
      'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-500'
    ];
    const index = cars.findIndex(c => c.id === carId);
    return colors[index % colors.length];
  };

  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFullDateTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    return { daysInMonth, startingDay, year, month };
  };

  const getBookingsForDate = (day) => {
    const { year, month } = getDaysInMonth(currentDate);
    
    // Filter bookings by selected car first
    let filteredBookings = bookings;
    if (selectedCar !== 'all') {
      filteredBookings = bookings.filter(b => b.car_id === selectedCar);
    }
    
    return filteredBookings.filter(booking => {
      const startDate = new Date(booking.start_time);
      const endDate = new Date(booking.end_time);
      
      // Check if the booking overlaps with this day
      const dayStart = new Date(year, month, day, 0, 0, 0);
      const dayEnd = new Date(year, month, day, 23, 59, 59);
      
      return startDate <= dayEnd && endDate >= dayStart;
    });
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (day) => {
    const today = new Date();
    const { year, month } = getDaysInMonth(currentDate);
    return today.getDate() === day && 
           today.getMonth() === month && 
           today.getFullYear() === year;
  };

  // Handle clicking on a date to show all bookings for that day
  const handleDateClick = (day, dayBookings) => {
    if (dayBookings.length === 0) return;
    
    const { year, month } = getDaysInMonth(currentDate);
    const dateStr = new Date(year, month, day).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    setSelectedDateStr(dateStr);
    setSelectedDateBookings(dayBookings);
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDay, year, month } = getDaysInMonth(currentDate);
    const days = [];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Get selected car info
    const selectedCarInfo = selectedCar !== 'all' ? cars.find(c => c.id === selectedCar) : null;

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="h-20 sm:h-24 md:h-32 bg-gray-50 border border-gray-100"></div>
      );
    }

    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayBookings = getBookingsForDate(day);
      const todayClass = isToday(day) ? 'bg-blue-50 border-blue-300' : 'bg-white';
      const hasBookings = dayBookings.length > 0;
      
      days.push(
        <div 
          key={day} 
          onClick={() => handleDateClick(day, dayBookings)}
          className={`h-20 sm:h-24 md:h-32 ${todayClass} border border-gray-200 p-1 overflow-hidden hover:bg-gray-50 transition-colors ${hasBookings ? 'cursor-pointer' : ''}`}
        >
          <div className="flex justify-between items-start">
            <span className={`text-xs sm:text-sm font-medium ${isToday(day) ? 'text-blue-600' : 'text-gray-700'}`}>
              {day}
            </span>
            {hasBookings && (
              <span className="bg-blue-100 text-blue-700 text-[10px] sm:text-xs px-1 rounded-full">
                {dayBookings.length}
              </span>
            )}
          </div>
          <div className="space-y-0.5 overflow-y-auto max-h-12 sm:max-h-16 md:max-h-24 mt-0.5">
            {dayBookings.slice(0, 2).map((booking, idx) => {
              const isPending = booking.status === 'pending_approval';
              return (
                <div 
                  key={booking.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedBooking(booking); }}
                  className={`${isPending ? 'bg-gray-400' : getCarColor(booking.car_id)} text-white text-[10px] sm:text-xs px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity ${isPending ? 'opacity-60' : ''}`}
                  title={isPending ? "Pending admin approval" : "Click to view details"}
                >
                  {isPending && <span className="mr-1">⏳</span>}
                  <span className="hidden sm:inline">{formatTime(booking.start_time)} </span>
                  {selectedCar === 'all' ? getCarName(booking.car_id) : booking.user_name}
                </div>
              );
            })}
            {dayBookings.length > 2 && (
              <div className="text-[10px] sm:text-xs text-blue-600 font-medium px-1">
                +{dayBookings.length - 2} more
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Car Selector Tabs */}
        <div className="bg-gray-100 p-2 border-b overflow-x-auto">
          <div className="flex space-x-2 min-w-max">
            <button
              onClick={() => setSelectedCar('all')}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                selectedCar === 'all' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Grid size={14} />
              <span>All Cars</span>
            </button>
            {cars.filter(car => !car.is_blocked).map((car) => (
              <button
                key={car.id}
                onClick={() => setSelectedCar(car.id)}
                className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedCar === car.id 
                    ? `${getCarColor(car.id)} text-white` 
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Car size={14} />
                <span>{car.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Calendar Header */}
        <div className={`${selectedCarInfo ? getCarColor(selectedCarInfo.id) : 'bg-blue-600'} text-white p-4`}>
          <div className="flex justify-between items-center">
            <button 
              onClick={prevMonth}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <h2 className="text-xl font-bold">
                {selectedCarInfo ? `${selectedCarInfo.name} - ` : ''}{monthNames[month]} {year}
              </h2>
              {selectedCarInfo && (
                <p className="text-sm opacity-80">{selectedCarInfo.registration}</p>
              )}
              <button 
                onClick={goToToday}
                className="text-sm opacity-80 hover:opacity-100 transition-colors"
              >
                Go to Today
              </button>
            </div>
            <button 
              onClick={nextMonth}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        
        {/* Day Headers */}
        <div className="grid grid-cols-7 bg-gray-100">
          {dayNames.map(day => (
            <div key={day} className="p-2 text-center text-sm font-medium text-gray-600 border-b">
              <span className="hidden md:inline">{day}</span>
              <span className="md:hidden">{day.charAt(0)}</span>
            </div>
          ))}
        </div>
        
        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {days}
        </div>

        {/* Legend - only show when viewing all cars */}
        {selectedCar === 'all' && (
          <div className="p-3 bg-gray-50 border-t">
            <p className="text-xs text-gray-500 mb-2">Car Legend:</p>
            <div className="flex flex-wrap gap-2">
              {cars.filter(car => !car.is_blocked).slice(0, 6).map((car) => (
                <div key={car.id} className="flex items-center space-x-1">
                  <div className={`w-3 h-3 rounded ${getCarColor(car.id)}`}></div>
                  <span className="text-xs text-gray-600">{car.name}</span>
                </div>
              ))}
              {cars.filter(car => !car.is_blocked).length > 6 && (
                <span className="text-xs text-gray-500">+{cars.filter(car => !car.is_blocked).length - 6} more</span>
              )}
            </div>
          </div>
        )}

        {/* Single car stats */}
        {selectedCar !== 'all' && (
          <div className="p-3 bg-gray-50 border-t">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                <span className="font-medium">{bookings.filter(b => b.car_id === selectedCar).length}</span> bookings this month
              </p>
              <button
                onClick={() => {
                  setFormData({ ...formData, car_id: selectedCar });
                  setShowForm(true);
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                + Book this car
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 py-4 sm:px-6 lg:px-8 pb-20 sm:pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 space-y-3 sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900" data-testid="bookings-title">Car Bookings</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Auto-updates every 30 seconds</p>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center space-x-1 px-2 sm:px-3 py-1.5 rounded-md text-sm transition-colors ${
                viewMode === 'calendar' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'
              }`}
            >
              <Grid size={16} />
              <span className="hidden sm:inline">Calendar</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center space-x-1 px-2 sm:px-3 py-1.5 rounded-md text-sm transition-colors ${
                viewMode === 'list' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'
              }`}
            >
              <List size={16} />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
          
          <button
            onClick={() => setShowForm(!showForm)}
            data-testid="new-booking-button"
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            <span>New Booking</span>
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6" data-testid="success-message">
          <p className="text-green-800">{success}</p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center" data-testid="error-message">
          <AlertCircle className="text-red-500 mr-2" size={20} />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Booking Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Create New Booking</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Car *
                </label>
                <select
                  data-testid="booking-car-select"
                  value={formData.car_id}
                  onChange={(e) => setFormData({ ...formData, car_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Choose a car</option>
                  {cars.filter(car => !car.is_blocked).map((car) => (
                    <option key={car.id} value={car.id}>
                      {car.name} ({car.registration})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name *
                </label>
                <input
                  type="text"
                  data-testid="booking-user-name"
                  value={formData.user_name}
                  onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time *
                </label>
                <input
                  type="datetime-local"
                  data-testid="booking-start-time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Time *
                </label>
                <input
                  type="datetime-local"
                  data-testid="booking-end-time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Destination / Notes
              </label>
              <textarea
                data-testid="booking-notes"
                value={formData.destination_notes}
                onChange={(e) => setFormData({ ...formData, destination_notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows="2"
                placeholder="Where will the car be left?"
              />
            </div>

            {/* Recurring Booking Section */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center space-x-2 mb-4">
                <input
                  type="checkbox"
                  id="is_recurring"
                  checked={formData.is_recurring}
                  onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_recurring" className="text-sm font-medium text-gray-700">
                  🔄 Make this a recurring booking
                </label>
                {user?.role !== 'admin' && formData.is_recurring && (
                  <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                    Requires admin approval
                  </span>
                )}
              </div>

              {formData.is_recurring && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Repeat *
                    </label>
                    <select
                      value={formData.recurrence_type}
                      onChange={(e) => setFormData({ ...formData, recurrence_type: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required={formData.is_recurring}
                    >
                      <option value="">Select frequency</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Until Date
                    </label>
                    <input
                      type="date"
                      value={formData.recurrence_end_date}
                      onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Or # of times
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="52"
                      value={formData.recurrence_count}
                      onChange={(e) => setFormData({ ...formData, recurrence_count: e.target.value })}
                      placeholder="e.g., 10"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex space-x-4">
              <button
                type="submit"
                data-testid="submit-booking-button"
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {formData.is_recurring ? 'Create Recurring Booking' : 'Create Booking'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && renderCalendar()}

      {/* List View */}
      {viewMode === 'list' && (
        <>
          {bookings.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <CalendarIcon className="mx-auto text-gray-400" size={48} />
              <p className="text-gray-500 mt-4">No bookings yet. Create your first booking!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => {
                const isPending = booking.status === 'pending_approval';
                return (
                  <div
                    key={booking.id}
                    data-testid={`booking-card-${booking.id}`}
                    className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow ${isPending ? 'opacity-60 border-2 border-gray-300' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${isPending ? 'bg-gray-400' : getCarColor(booking.car_id)}`}></div>
                          <h3 className="text-lg font-bold text-gray-900">
                            {getCarName(booking.car_id)}
                          </h3>
                          {isPending && (
                            <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded">
                              ⏳ Pending Approval
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Booked by: <span className="font-medium">{booking.user_name}</span>
                          {booking.created_by_email === user?.email && (
                            <span className="text-blue-600 ml-1">(You)</span>
                          )}
                        </p>
                        <div className="mt-3 space-y-1">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">From:</span> {formatDateTime(booking.start_time)}
                          </p>
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">To:</span> {formatDateTime(booking.end_time)}
                          </p>
                        </div>
                        {booking.destination_notes && (
                          <p className="text-sm text-gray-600 mt-2 italic">
                            Destination: {booking.destination_notes}
                          </p>
                        )}
                      </div>
                      {/* Only show delete button if admin or owner */}
                      {(user?.role === 'admin' || booking.created_by_email === user?.email) && !isPending && (
                        <button
                          onClick={() => handleDelete(booking.id)}
                          data-testid={`delete-booking-${booking.id}`}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        title={user?.role === 'admin' ? 'Delete booking' : 'Cancel your booking'}
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </>
      )}

      {/* Booking Preview Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal Header */}
            <div className={`${selectedBooking.status === 'pending_approval' ? 'bg-gray-500' : getCarColor(selectedBooking.car_id)} text-white p-4`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xl font-bold">{getCarName(selectedBooking.car_id)}</h3>
                    {selectedBooking.status === 'pending_approval' && (
                      <span className="bg-white/20 text-white text-xs px-2 py-1 rounded">
                        ⏳ Pending
                      </span>
                    )}
                  </div>
                  {getCarInfo(selectedBooking.car_id) && (
                    <p className="text-sm opacity-80">{getCarInfo(selectedBooking.car_id).registration}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Booked By */}
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Booked By</p>
                  <p className="font-semibold text-gray-900">{selectedBooking.user_name}</p>
                </div>
              </div>

              {/* Start Time */}
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Clock className="text-green-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Start Time</p>
                  <p className="font-semibold text-gray-900">{formatFullDateTime(selectedBooking.start_time)}</p>
                </div>
              </div>

              {/* End Time */}
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Clock className="text-red-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">End Time</p>
                  <p className="font-semibold text-gray-900">{formatFullDateTime(selectedBooking.end_time)}</p>
                </div>
              </div>

              {/* Destination */}
              {selectedBooking.destination_notes && (
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <MapPin className="text-purple-600" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Destination / Notes</p>
                    <p className="font-semibold text-gray-900">{selectedBooking.destination_notes}</p>
                  </div>
                </div>
              )}

              {/* Duration */}
              <div className="bg-gray-50 rounded-lg p-3 mt-4">
                <p className="text-sm text-gray-500">Duration</p>
                <p className="font-semibold text-gray-900">
                  {(() => {
                    const start = new Date(selectedBooking.start_time);
                    const end = new Date(selectedBooking.end_time);
                    const diffMs = end - start;
                    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    if (diffHours > 0 && diffMins > 0) {
                      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ${diffMins} min${diffMins !== 1 ? 's' : ''}`;
                    } else if (diffHours > 0) {
                      return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
                    } else {
                      return `${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
                    }
                  })()}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t p-4">
              {/* Permission check: Admin can delete any, user can only cancel their own */}
              {(() => {
                const isAdmin = user?.role === 'admin';
                const isOwner = selectedBooking.created_by_email === user?.email;
                const canDelete = isAdmin || isOwner;
                const isRecurring = !!selectedBooking.recurring_group_id;

                return (
                  <div className="space-y-3">
                    {/* Show who created the booking */}
                    {selectedBooking.created_by_email && (
                      <p className="text-xs text-gray-500 text-center">
                        Created by: {selectedBooking.created_by_email}
                        {isOwner && <span className="text-blue-600 ml-1">(You)</span>}
                        {isRecurring && <span className="text-purple-600 ml-2">(Recurring)</span>}
                      </p>
                    )}
                    
                    <div className="flex space-x-3">
                      <button
                        onClick={() => setSelectedBooking(null)}
                        className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                      >
                        Close
                      </button>
                      
                      {/* Admin Edit Button */}
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setEditingBooking(selectedBooking);
                            setSelectedBooking(null);
                          }}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors font-medium flex items-center justify-center space-x-2"
                        >
                          <Edit size={18} />
                          <span>Edit</span>
                        </button>
                      )}
                      
                      {canDelete ? (
                        <button
                          onClick={() => {
                            handleDelete(selectedBooking.id);
                            setSelectedBooking(null);
                          }}
                          className={`flex-1 ${isAdmin && !isOwner ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-500 hover:bg-orange-600'} text-white py-2 px-4 rounded-lg transition-colors font-medium flex items-center justify-center space-x-2`}
                        >
                          <Trash2 size={18} />
                          <span>{isAdmin && !isOwner ? 'Delete' : 'Cancel Booking'}</span>
                        </button>
                      ) : (
                        <div className="flex-1 bg-gray-200 text-gray-500 py-2 px-4 rounded-lg text-center text-sm">
                          Only the creator or admin can cancel
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Edit Booking Modal */}
      <EditBookingModal
        isOpen={!!editingBooking}
        onClose={() => setEditingBooking(null)}
        booking={editingBooking}
        onSuccess={() => {
          setEditingBooking(null);
          fetchData();
        }}
      />

      {/* Day Preview Modal - Shows all bookings for selected date */}
      {selectedDateBookings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-center bg-blue-50 rounded-t-lg">
              <div>
                <h3 className="text-lg font-bold text-gray-900">📅 {selectedDateStr}</h3>
                <p className="text-sm text-gray-600">{selectedDateBookings.length} booking(s)</p>
              </div>
              <button
                onClick={() => { setSelectedDateBookings(null); setSelectedDateStr(''); }}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <X size={24} />
              </button>
            </div>
            
            {/* Bookings List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedDateBookings.map((booking) => {
                const isPending = booking.status === 'pending_approval';
                const carName = getCarName(booking.car_id);
                
                return (
                  <div 
                    key={booking.id}
                    onClick={() => {
                      setSelectedDateBookings(null);
                      setSelectedDateStr('');
                      setSelectedBooking(booking);
                    }}
                    className={`p-3 rounded-lg border-l-4 cursor-pointer hover:shadow-md transition-shadow ${
                      isPending 
                        ? 'bg-gray-50 border-gray-400' 
                        : 'bg-white border-blue-500 shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Car size={16} className="text-gray-500" />
                          <span className="font-medium text-gray-900">{carName}</span>
                          {isPending && (
                            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded">
                              ⏳ Pending
                            </span>
                          )}
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <Clock size={14} />
                            <span>{formatTime(booking.start_time)} - {formatTime(booking.end_time)}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <User size={14} />
                            <span>{booking.user_name}</span>
                          </div>
                          {booking.destination_notes && (
                            <div className="flex items-center space-x-2">
                              <MapPin size={14} />
                              <span className="truncate">{booking.destination_notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${isPending ? 'bg-gray-400' : getCarColor(booking.car_id)}`}></div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t bg-gray-50 rounded-b-lg">
              <button
                onClick={() => { setSelectedDateBookings(null); setSelectedDateStr(''); }}
                className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 font-medium"
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

export default Bookings;
