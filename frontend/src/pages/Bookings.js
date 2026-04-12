import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { bookingAPI, carAPI } from '../api/api';
import { Calendar as CalendarIcon, Plus, Trash2, AlertCircle, ChevronLeft, ChevronRight, Car, X, Clock, User, MapPin, Edit, Lightbulb, ChevronDown, ChevronUp, Minus, AlertTriangle, Users, Map, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import EditBookingModal from '../components/EditBookingModal';
import CarAvailabilityCard from '../components/CarAvailabilityCard';

// Lazy load the map component
const BookingLocationsMap = lazy(() => import('../components/BookingLocationsMap'));

const Bookings = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const carFromQR = searchParams.get('car'); // Get car ID from QR code URL
  
  const [bookings, setBookings] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCar, setSelectedCar] = useState('all'); // 'all' or car id
  const [selectedBooking, setSelectedBooking] = useState(null); // For modal preview
  const [editingBooking, setEditingBooking] = useState(null); // For edit modal
  const [selectedDateBookings, setSelectedDateBookings] = useState(null); // For day preview modal
  const [selectedDateStr, setSelectedDateStr] = useState(''); // Selected date string
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showAllCars, setShowAllCars] = useState(false); // Show more cars toggle
  const [showCarTabs, setShowCarTabs] = useState(false); // Toggle car tabs visibility
  const [qrCarName, setQrCarName] = useState(''); // Name of car from QR
  const [viewMode, setViewMode] = useState('all'); // 'all' or 'my' bookings
  const [conflictWarning, setConflictWarning] = useState(null); // Booking conflict alert
  const [checkingConflicts, setCheckingConflicts] = useState(false); // Loading state for conflict check
  const [showMap, setShowMap] = useState(false); // Toggle map view
  
  const [formData, setFormData] = useState({
    car_id: carFromQR || '',
    user_name: '',
    start_time: '',
    end_time: '',
    purpose: '',
    location: '',
    is_double_up_call: false,
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

  // Handle QR code car parameter - auto-select car and open booking form
  useEffect(() => {
    if (carFromQR && cars.length > 0) {
      const car = cars.find(c => c.id === carFromQR);
      if (car) {
        setSelectedCar(carFromQR);
        setQrCarName(car.name);
        setFormData(prev => ({ ...prev, car_id: carFromQR }));
        setShowForm(true);
        // Scroll to form
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
      }
    }
  }, [carFromQR, cars]);

  const fetchData = async () => {
    try {
      const [bookingsRes, carsRes, suggestionsRes] = await Promise.all([
        bookingAPI.getAll(),
        carAPI.getAll(),
        bookingAPI.getSuggestions(),
      ]);
      console.log('Fetched bookings:', bookingsRes.data?.length, 'Cars:', carsRes.data?.length);
      setBookings(bookingsRes.data || []);
      setCars(carsRes.data || []);
      setSuggestions(suggestionsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  // Check for booking conflicts when car or time changes - now with API-based recommendations
  const checkBookingConflicts = async (carId, startTime, endTime) => {
    if (!carId || !startTime || !endTime) {
      setConflictWarning(null);
      return;
    }

    try {
      const newStart = new Date(startTime);
      const newEnd = new Date(endTime);
      
      if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
        setConflictWarning(null);
        return;
      }

      // Use the API to check availability and get recommendations
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/bookings/check-availability?car_id=${carId}&start_time=${startTime}&end_time=${endTime}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        
        if (!data.available && data.conflict) {
          setConflictWarning({
            carName: data.requested_car?.name || cars.find(c => c.id === carId)?.name || 'Unknown',
            conflicts: [{
              user: data.conflict.booked_by,
              start: formatTime(data.conflict.start_time),
              end: formatTime(data.conflict.end_time),
              date: new Date(data.conflict.start_time).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }),
              status: 'confirmed'
            }],
            recommendedCars: data.recommended_cars || [],
            totalAvailable: data.total_available || 0
          });
        } else {
          setConflictWarning(null);
        }
      } else {
        // Fallback to local check if API fails
        const conflictingBookings = bookings.filter(booking => {
          if (booking.car_id !== carId) return false;
          if (booking.status === 'rejected' || booking.status === 'cancelled') return false;
          
          const existingStart = new Date(booking.start_time);
          const existingEnd = new Date(booking.end_time);
          
          return newStart < existingEnd && newEnd > existingStart;
        });

        if (conflictingBookings.length > 0) {
          const conflicts = conflictingBookings.map(b => ({
            user: b.user_name,
            start: formatTime(b.start_time),
            end: formatTime(b.end_time),
            date: new Date(b.start_time).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }),
            status: b.status
          }));
          setConflictWarning({
            carName: cars.find(c => c.id === carId)?.name || 'Unknown',
            conflicts,
            recommendedCars: [],
            totalAvailable: 0
          });
        } else {
          setConflictWarning(null);
        }
      }
    } catch (error) {
      console.error('Error checking conflicts:', error);
      setConflictWarning(null);
    }
  };

  // Watch for changes in form data to check conflicts
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      checkBookingConflicts(formData.car_id, formData.start_time, formData.end_time);
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [formData.car_id, formData.start_time, formData.end_time, bookings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate required fields
    if (!formData.car_id) {
      setError('Please select a car');
      alert('Please select a car');
      return;
    }
    if (!formData.user_name) {
      setError('Please enter your name');
      alert('Please enter your name');
      return;
    }
    if (!formData.start_time) {
      setError('Please select a start time');
      alert('Please select a start time');
      return;
    }
    if (!formData.end_time) {
      setError('Please select an end time');
      alert('Please select an end time');
      return;
    }

    try {
      const startDate = new Date(formData.start_time);
      const endDate = new Date(formData.end_time);
      
      // Validate dates
      if (isNaN(startDate.getTime())) {
        setError('Invalid start time');
        alert('Invalid start time');
        return;
      }
      if (isNaN(endDate.getTime())) {
        setError('Invalid end time');
        alert('Invalid end time');
        return;
      }
      if (endDate <= startDate) {
        setError('End time must be after start time');
        alert('End time must be after start time');
        return;
      }

      const bookingData = {
        car_id: formData.car_id,
        user_name: formData.user_name,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        purpose: formData.purpose || '',
        location: formData.location || '',
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
      
      console.log('Submitting booking:', bookingData);
      await bookingAPI.create(bookingData);
      
      const isRecurring = formData.is_recurring && formData.recurrence_type;
      const isStaff = user?.role !== 'admin';
      
      const successMsg = isRecurring && isStaff 
        ? 'Recurring booking submitted for admin approval!' 
        : 'Booking created successfully!';
      
      setSuccess(successMsg);
      alert(successMsg); // Immediate feedback
      window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to show message
      
      setShowForm(false);
      setFormData({
        car_id: '',
        user_name: '',
        start_time: '',
        end_time: '',
        purpose: '',
        location: '',
        is_recurring: false,
        recurrence_type: '',
        recurrence_end_date: '',
        recurrence_count: '',
      });
      fetchData(); // Auto-refresh calendar
    } catch (err) {
      console.error('Booking error:', err);
      // Handle error - detail can be string or array of validation errors
      let errorMsg = 'Failed to create booking';
      const detail = err.response?.data?.detail;
      
      // Handle 409 Conflict with recommendations
      if (err.response?.status === 409 && detail && typeof detail === 'object' && detail.available_cars) {
        errorMsg = detail.message || 'Vehicle is already booked at this time';
        // Show recommendations in the conflict warning
        setConflictWarning({
          carName: cars.find(c => c.id === formData.car_id)?.name || 'Selected car',
          conflicts: [{
            user: detail.conflict?.booked_by || 'Another user',
            start: formatTime(detail.conflict?.start_time),
            end: formatTime(detail.conflict?.end_time),
            date: detail.conflict?.start_time ? new Date(detail.conflict.start_time).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) : '',
            status: 'confirmed'
          }],
          recommendedCars: detail.available_cars || [],
          totalAvailable: detail.total_available || 0
        });
      } else if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (Array.isArray(detail)) {
        // Validation errors come as array of objects
        errorMsg = detail.map(e => e.msg || e.message || 'Validation error').join(', ');
      } else if (detail && typeof detail === 'object') {
        errorMsg = detail.msg || detail.message || 'Failed to create booking';
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(errorMsg);
      alert('Booking failed: ' + errorMsg); // Immediate feedback
      window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to show error
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

  // Delete entire recurring series
  const handleDeleteSeries = async (recurringGroupId) => {
    // Count bookings in series
    const seriesBookings = bookings.filter(b => b.recurring_group_id === recurringGroupId);
    const confirmMsg = `This will delete ALL ${seriesBookings.length} bookings in this recurring series. Are you sure?`;
    
    if (!window.confirm(confirmMsg)) return;
    
    try {
      const result = await bookingAPI.deleteSeries(recurringGroupId);
      setSuccess(`Deleted ${result.data.deleted_count} bookings in the series`);
      fetchData();
    } catch (err) {
      setError('Failed to delete booking series');
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
    // Note: Purple is reserved for recurring bookings, so removed from car colors
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-orange-500', 
      'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-500'
    ];
    const index = cars.findIndex(c => c.id === carId);
    return colors[index % colors.length];
  };

  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-IE', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatFullDateTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-IE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-IE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
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
    
    // Filter by "My Bookings" if viewMode is 'my'
    if (viewMode === 'my' && user?.email) {
      filteredBookings = filteredBookings.filter(b => b.created_by_email === user.email);
    }
    
    return filteredBookings.filter(booking => {
      if (!booking.start_time || !booking.end_time) return false;
      
      // Parse booking dates - handle both ISO strings and date objects
      let startDate, endDate;
      try {
        startDate = new Date(booking.start_time);
        endDate = new Date(booking.end_time);
      } catch (e) {
        console.warn('Error parsing booking dates:', booking.id, e);
        return false;
      }
      
      // Check for invalid dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.warn('Invalid booking dates:', booking.id, booking.start_time, booking.end_time);
        return false;
      }
      
      // Compare using just the date parts (year, month, day) to avoid timezone issues
      // Extract the date components from the booking start time
      const bookingStartYear = startDate.getFullYear();
      const bookingStartMonth = startDate.getMonth();
      const bookingStartDay = startDate.getDate();
      
      const bookingEndYear = endDate.getFullYear();
      const bookingEndMonth = endDate.getMonth();
      const bookingEndDay = endDate.getDate();
      
      // Check if the calendar day falls within the booking date range
      // A booking shows on a day if:
      // - The booking starts on or before this day AND
      // - The booking ends on or after this day
      const calendarDate = new Date(year, month, day);
      const bookingStartDate = new Date(bookingStartYear, bookingStartMonth, bookingStartDay);
      const bookingEndDate = new Date(bookingEndYear, bookingEndMonth, bookingEndDay);
      
      return bookingStartDate <= calendarDate && bookingEndDate >= calendarDate;
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
              // Check both is_recurring flag and recurring_group_id for robustness
              const isRecurring = booking.is_recurring === true || (booking.recurring_group_id != null && booking.recurring_group_id !== undefined && booking.recurring_group_id !== '');
              // Use purple for recurring, gray for pending, otherwise car color
              const bgColor = isPending ? 'bg-gray-400' : isRecurring ? 'bg-purple-500' : getCarColor(booking.car_id);
              return (
                <div 
                  key={booking.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedBooking(booking); }}
                  className={`${bgColor} text-white text-[10px] sm:text-xs px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity ${isPending ? 'opacity-60' : ''}`}
                  title={isPending ? "Pending admin approval" : isRecurring ? "Recurring booking - Click to view" : "Click to view details"}
                >
                  {isPending && <span className="mr-1">⏳</span>}
                  {isRecurring && !isPending && <span className="mr-1">🔄</span>}
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
        {/* Car Selector Toggle Button */}
        <div className="bg-gray-100 border-b">
          <button
            onClick={() => setShowCarTabs(!showCarTabs)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-200 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Car size={16} className="text-gray-600" />
              <span className="text-sm font-medium text-gray-700">
                {selectedCar === 'all' ? 'All Cars' : cars.find(c => c.id === selectedCar)?.name || 'Select Car'}
              </span>
              {selectedCar !== 'all' && (
                <span className={`w-3 h-3 rounded-full ${getCarColor(selectedCar)}`}></span>
              )}
            </div>
            <div className={`w-6 h-6 flex items-center justify-center rounded-full ${showCarTabs ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'} transition-colors`}>
              {showCarTabs ? <Minus size={14} /> : <Plus size={14} />}
            </div>
          </button>
          
          {/* Collapsible Car Tabs - All options inside */}
          {showCarTabs && (
            <div className="p-2 border-t overflow-x-auto bg-white">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setSelectedCar('all'); setShowCarTabs(false); }}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    selectedCar === 'all' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <CalendarIcon size={14} />
                  <span>All Cars</span>
                </button>
                {cars.filter(car => !car.is_blocked).map((car) => (
                  <button
                    key={car.id}
                    onClick={() => { setSelectedCar(car.id); setShowCarTabs(false); }}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      selectedCar === car.id 
                        ? `${getCarColor(car.id)} text-white` 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Car size={14} />
                    <span>{car.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Calendar Header */}
        <div className={`${viewMode === 'my' ? 'bg-indigo-600' : selectedCarInfo ? getCarColor(selectedCarInfo.id) : 'bg-blue-600'} text-white p-4`}>
          <div className="flex justify-between items-center">
            <button 
              onClick={prevMonth}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <h2 className="text-xl font-bold">
                {viewMode === 'my' ? '👤 My Bookings - ' : ''}{selectedCarInfo ? `${selectedCarInfo.name} - ` : ''}{monthNames[month]} {year}
              </h2>
              {selectedCarInfo && (
                <p className="text-sm opacity-80">{selectedCarInfo.registration}</p>
              )}
              {viewMode === 'my' && user?.email && (
                <p className="text-sm opacity-80">{user.email}</p>
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

        {/* Booking Type Legend */}
        <div className="p-3 bg-gray-50 border-t">
          <p className="text-xs text-gray-500 mb-2">Booking Types:</p>
          <div className="flex flex-wrap gap-3 mb-3">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded bg-blue-500"></div>
              <span className="text-xs text-gray-600">One-time</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded bg-purple-500"></div>
              <span className="text-xs text-gray-600">🔄 Recurring</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded bg-gray-400"></div>
              <span className="text-xs text-gray-600">⏳ Pending</span>
            </div>
          </div>
        </div>

        {/* Car Legend - only show when viewing all cars */}
        {selectedCar === 'all' && (
          <div className="p-3 bg-white border-t">
            <p className="text-xs text-gray-500 mb-2">Car Colors:</p>
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
          <div className="p-3 bg-white border-t">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                <span className="font-medium">
                  {bookings.filter(b => {
                    if (b.car_id !== selectedCar) return false;
                    const bookingDate = new Date(b.start_time);
                    return bookingDate.getMonth() === currentDate.getMonth() && 
                           bookingDate.getFullYear() === currentDate.getFullYear();
                  }).length}
                </span> bookings this month
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

        {/* My Bookings Stats - show when in My Bookings view */}
        {viewMode === 'my' && user?.email && (
          <div className="p-3 bg-indigo-50 border-t">
            <div className="flex justify-between items-center">
              <p className="text-sm text-indigo-700">
                <span className="font-medium">
                  {bookings.filter(b => {
                    if (b.created_by_email !== user.email) return false;
                    const bookingDate = new Date(b.start_time);
                    return bookingDate.getMonth() === currentDate.getMonth() && 
                           bookingDate.getFullYear() === currentDate.getFullYear();
                  }).length}
                </span> of your bookings this month
              </p>
              <button
                onClick={() => setViewMode('all')}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                View All Bookings →
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
      {/* QR Code Banner */}
      {carFromQR && qrCarName && (
        <div className="bg-blue-600 text-white rounded-lg p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Car size={24} />
            <div>
              <p className="font-bold text-lg">📱 Booking: {qrCarName}</p>
              <p className="text-blue-100 text-sm">Scanned from QR code - Fill in the form below to book this car</p>
            </div>
          </div>
          <button
            onClick={() => window.history.replaceState({}, '', '/bookings')}
            className="text-blue-200 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 space-y-3 sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900" data-testid="bookings-title">Car Bookings</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Auto-updates every 30 seconds</p>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
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

      {/* View Mode Toggle: All Bookings / My Bookings + Map Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1" data-testid="view-mode-toggle">
          <button
            onClick={() => setViewMode('all')}
            data-testid="all-bookings-tab"
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'all'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Users size={16} />
            <span>All Bookings</span>
          </button>
          <button
            onClick={() => setViewMode('my')}
            data-testid="my-bookings-tab"
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'my'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <User size={16} />
            <span>My Bookings</span>
            {user?.email && (
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full ml-1">
                {bookings.filter(b => b.created_by_email === user.email).length}
              </span>
            )}
          </button>
        </div>

        {/* Map Toggle Button */}
        <button
          onClick={() => setShowMap(!showMap)}
          data-testid="map-toggle-button"
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showMap
              ? 'bg-emerald-600 text-white'
              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
          }`}
        >
          <Map size={16} />
          <span>{showMap ? 'Hide Map' : 'Show Map'}</span>
        </button>
      </div>

      {/* Booking Locations Map */}
      {showMap && (
        <div className="mb-6">
          <Suspense fallback={
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto mb-3"></div>
                <p className="text-gray-600 text-sm">Loading map...</p>
              </div>
            </div>
          }>
            <BookingLocationsMap 
              carId={selectedCar !== 'all' ? selectedCar : null}
              selectedDate={currentDate.toISOString().split('T')[0]}
              height="350px"
              showDatePicker={false}
            />
          </Suspense>
        </div>
      )}

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

      {/* Booking Suggestions Section */}
      {cars.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg mb-6 overflow-hidden" data-testid="suggestions-section">
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-100/50 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Lightbulb className="text-amber-600" size={20} />
              <span className="font-semibold text-amber-900">Available Cars & Time Slots</span>
              <span className="bg-amber-200 text-amber-800 text-xs px-2 py-0.5 rounded-full">
                {cars.filter(c => !c.is_blocked).length} cars
              </span>
            </div>
            {showSuggestions ? <ChevronUp className="text-amber-600" size={20} /> : <ChevronDown className="text-amber-600" size={20} />}
          </button>
          
          {showSuggestions && (
            <div className="px-4 pb-4">
              <p className="text-xs text-amber-700 mb-3">
                Click on any available hour to book, or use Day/Week/Month view to see availability
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cars
                  .filter(c => !c.is_blocked)
                  .slice(0, showAllCars ? undefined : 6)
                  .map((car) => (
                    <CarAvailabilityCard
                      key={car.id}
                      car={car}
                      onBookClick={(car, date, hour) => {
                        // Pre-fill form with car and time
                        const startTime = hour !== undefined 
                          ? `${date}T${String(hour).padStart(2, '0')}:00`
                          : `${date}T09:00`;
                        const endHour = hour !== undefined ? hour + 1 : 17;
                        const endTime = `${date}T${String(endHour).padStart(2, '0')}:00`;
                        
                        setFormData({
                          ...formData,
                          car_id: car.id,
                          start_time: startTime,
                          end_time: endTime,
                        });
                        setShowForm(true);
                      }}
                    />
                  ))}
              </div>
              
              {/* Show More / Show Less Button */}
              {cars.filter(c => !c.is_blocked).length > 6 && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setShowAllCars(!showAllCars)}
                    className="px-6 py-2 bg-amber-200 text-amber-800 rounded-lg hover:bg-amber-300 transition-colors font-medium text-sm"
                  >
                    {showAllCars 
                      ? `Show Less` 
                      : `Show All ${cars.filter(c => !c.is_blocked).length} Cars`
                    }
                  </button>
                  {!showAllCars && (
                    <p className="text-xs text-amber-600 mt-1">
                      Showing 6 of {cars.filter(c => !c.is_blocked).length} available cars
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Booking Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Create New Booking</h2>
          
          {/* Booking Conflict Warning */}
          {conflictWarning && (
            <div className="bg-orange-50 border border-orange-300 rounded-lg p-4 mb-4" data-testid="conflict-warning">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="text-orange-500 flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <h4 className="font-semibold text-orange-800">⚠️ Booking Conflict Detected</h4>
                  <p className="text-sm text-orange-700 mt-1">
                    <strong>{conflictWarning.carName}</strong> has overlapping booking(s) for this time:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {conflictWarning.conflicts.map((conflict, idx) => (
                      <li key={idx} className="text-sm text-orange-700 flex items-center space-x-2">
                        <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
                        <span>
                          <strong>{conflict.user}</strong> on {conflict.date}: {conflict.start} - {conflict.end}
                          {conflict.status === 'pending_approval' && (
                            <span className="ml-2 text-xs bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded">Pending</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                  
                  {/* Recommended Available Cars */}
                  {conflictWarning.recommendedCars && conflictWarning.recommendedCars.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-orange-200">
                      <h5 className="font-semibold text-green-700 flex items-center">
                        <CheckCircle size={16} className="mr-1.5" />
                        Available Cars at This Time:
                      </h5>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {conflictWarning.recommendedCars.map((car) => (
                          <button
                            key={car.id}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, car_id: car.id }));
                              setConflictWarning(null);
                            }}
                            className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-800 text-sm rounded-lg border border-green-300 transition-colors flex items-center space-x-1"
                          >
                            <Car size={14} />
                            <span className="font-medium">{car.name}</span>
                            <span className="text-xs text-green-600">({car.registration})</span>
                          </button>
                        ))}
                      </div>
                      {conflictWarning.totalAvailable > 5 && (
                        <p className="text-xs text-green-600 mt-2">
                          + {conflictWarning.totalAvailable - 5} more cars available
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* No cars available message */}
                  {conflictWarning.recommendedCars && conflictWarning.recommendedCars.length === 0 && conflictWarning.totalAvailable === 0 && (
                    <p className="text-xs text-red-600 mt-3 pt-2 border-t border-orange-200">
                      ⚠️ No other cars are available at this time. Please choose a different time slot.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Purpose
                </label>
                <textarea
                  data-testid="booking-purpose"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="2"
                  placeholder="What is the purpose of this booking?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location (Eircode)
                </label>
                <input
                  type="text"
                  data-testid="booking-location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. V93 ABC1"
                />
                <p className="text-xs text-gray-500 mt-1">This will show in the Live Sheet</p>
              </div>
            </div>

            {/* Double Up Call Checkbox */}
            <div className="flex items-center space-x-3 py-3 px-4 bg-amber-50 border border-amber-200 rounded-lg">
              <input
                type="checkbox"
                id="is_double_up_call"
                data-testid="booking-double-up"
                checked={formData.is_double_up_call}
                onChange={(e) => setFormData({ ...formData, is_double_up_call: e.target.checked })}
                className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
              />
              <label htmlFor="is_double_up_call" className="text-sm font-medium text-amber-800">
                👥 Double up call?
              </label>
              <span className="text-xs text-amber-600">(Check if this is a shared/double up visit)</span>
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
      {renderCalendar()}

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

              {/* Location (Eircode) */}
              {selectedBooking.location && (
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <MapPin className="text-blue-600" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Location (Eircode)</p>
                    <p className="font-semibold text-gray-900">{selectedBooking.location}</p>
                  </div>
                </div>
              )}

              {/* Purpose */}
              {(selectedBooking.purpose || selectedBooking.destination_notes) && (
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <AlertCircle className="text-purple-600" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Purpose</p>
                    <p className="font-semibold text-gray-900">{selectedBooking.purpose || selectedBooking.destination_notes}</p>
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
                const isRecurring = selectedBooking.is_recurring === true || !!selectedBooking.recurring_group_id;
                const seriesCount = isRecurring 
                  ? bookings.filter(b => b.recurring_group_id === selectedBooking.recurring_group_id).length 
                  : 0;

                return (
                  <div className="space-y-3">
                    {/* Show who created the booking */}
                    {selectedBooking.created_by_email && (
                      <p className="text-xs text-gray-500 text-center">
                        Created by: {selectedBooking.created_by_email}
                        {isOwner && <span className="text-blue-600 ml-1">(You)</span>}
                        {isRecurring && <span className="text-purple-600 ml-2">(Recurring - {seriesCount} bookings)</span>}
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
                          data-testid="delete-single-booking"
                        >
                          <Trash2 size={18} />
                          <span>{isRecurring ? 'Cancel This One' : (isAdmin && !isOwner ? 'Delete' : 'Cancel')}</span>
                        </button>
                      ) : (
                        <div className="flex-1 bg-gray-200 text-gray-500 py-2 px-4 rounded-lg text-center text-sm">
                          Only the creator or admin can cancel
                        </div>
                      )}
                    </div>
                    
                    {/* Delete Entire Series Button - Only for recurring bookings */}
                    {isRecurring && canDelete && (
                      <button
                        onClick={() => {
                          handleDeleteSeries(selectedBooking.recurring_group_id);
                          setSelectedBooking(null);
                        }}
                        className="w-full bg-red-700 hover:bg-red-800 text-white py-2 px-4 rounded-lg transition-colors font-medium flex items-center justify-center space-x-2"
                        data-testid="delete-entire-series"
                      >
                        <Trash2 size={18} />
                        <span>Cancel Entire Series ({seriesCount} bookings)</span>
                      </button>
                    )}
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
                const isRecurring = booking.is_recurring === true || !!booking.recurring_group_id;
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
                        : isRecurring
                        ? 'bg-purple-50 border-purple-500 shadow-sm'
                        : 'bg-white border-blue-500 shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Car size={16} className={isRecurring ? 'text-purple-500' : 'text-gray-500'} />
                          <span className="font-medium text-gray-900">{carName}</span>
                          {isPending && (
                            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded">
                              ⏳ Pending
                            </span>
                          )}
                          {isRecurring && !isPending && (
                            <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded">
                              🔄 Recurring
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
                          {booking.location && (
                            <div className="flex items-center space-x-2">
                              <MapPin size={14} className="text-blue-500" />
                              <span className="truncate text-blue-600">{booking.location}</span>
                            </div>
                          )}
                          {(booking.purpose || booking.destination_notes) && (
                            <div className="flex items-center space-x-2">
                              <AlertCircle size={14} />
                              <span className="truncate">{booking.purpose || booking.destination_notes}</span>
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
