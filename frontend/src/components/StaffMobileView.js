import React, { useState, useEffect, useCallback } from 'react';
import { 
  Home, Calendar, Car, Clock, MapPin, Bell, User, Phone,
  RefreshCw, X, ChevronRight, Send, CheckCircle,
  AlertCircle, Navigation, Plus, ChevronLeft, Wrench
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { liftRequestAPI, assistanceAPI } from '../api/api';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StaffMobileView = ({ tenantSlug }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [liftRequests, setLiftRequests] = useState([]);
  const [assistanceProviders, setAssistanceProviders] = useState([]);
  
  // Booking form state
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    purpose: ''
  });
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  
  // Lift request form state
  const [liftForm, setLiftForm] = useState({
    name: user?.name || '',
    phone: '',
    from_location: '',
    to_location: '',
    date: new Date().toISOString().split('T')[0],
    time: ''
  });
  const [isSubmittingLift, setIsSubmittingLift] = useState(false);
  const [liftSuccess, setLiftSuccess] = useState(false);

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Fetch data
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [vehiclesRes, bookingsRes, liftsRes, assistanceRes] = await Promise.all([
        axios.get(`${API}/vehicles`, { headers }),
        axios.get(`${API}/bookings`, { headers }),
        axios.get(`${API}/lift-requests/active`, { headers }).catch(() => ({ data: [] })),
        assistanceAPI.getAll().catch(() => ({ data: [] }))
      ]);
      
      setVehicles(vehiclesRes.data || []);
      setBookings(bookingsRes.data || []);
      setLiftRequests(liftsRes.data || []);
      setAssistanceProviders(assistanceRes.data || []);
      
      // Filter bookings for current user
      const userBookings = (bookingsRes.data || []).filter(b => 
        b.user_id === user?.id || 
        b.user_name === user?.name ||
        b.created_by_email === user?.email
      );
      setMyBookings(userBookings);
      
    } catch (err) {
      if (!silent) toast.error('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Update lift form name when user loads
  useEffect(() => {
    if (user?.name) {
      setLiftForm(prev => ({ ...prev, name: user.name }));
    }
  }, [user]);

  // Get vehicle status
  const getVehicleStatus = (vehicle) => {
    if (vehicle.is_blocked) return 'blocked';
    const now = new Date();
    const currentBooking = bookings.find(b => 
      b.car_id === vehicle.id && 
      new Date(b.start_time) <= now && 
      new Date(b.end_time) >= now
    );
    return currentBooking ? 'in-use' : 'available';
  };

  // Format time
  const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString('en-IE', { 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IE', { 
      weekday: 'short', day: 'numeric', month: 'short' 
    });
  };

  // Get vehicle name by ID
  const getVehicleName = (carId) => {
    const vehicle = vehicles.find(v => v.id === carId);
    return vehicle?.name || 'Vehicle';
  };

  // Submit booking
  const handleSubmitBooking = async () => {
    if (!selectedVehicle || !bookingForm.purpose) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmittingBooking(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const startDateTime = `${bookingForm.date}T${bookingForm.startTime}:00`;
      const endDateTime = `${bookingForm.date}T${bookingForm.endTime}:00`;

      await axios.post(`${API}/bookings`, {
        car_id: selectedVehicle.id,
        start_time: startDateTime,
        end_time: endDateTime,
        purpose: bookingForm.purpose,
        user_name: user?.name || 'Staff',
        status: 'pending'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Booking submitted!');
      setShowBookingForm(false);
      setSelectedVehicle(null);
      setBookingForm({
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '17:00',
        purpose: ''
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create booking');
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Submit lift request
  const handleSubmitLiftRequest = async (e) => {
    e.preventDefault();
    
    if (!liftForm.from_location || !liftForm.to_location || !liftForm.time || !liftForm.phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmittingLift(true);
    try {
      await liftRequestAPI.create({
        from_location: liftForm.from_location,
        to_location: liftForm.to_location,
        date: liftForm.date,
        time: liftForm.time,
        notes: `Contact: ${liftForm.name} - ${liftForm.phone}`,
        seats_needed: 1
      });

      setLiftSuccess(true);
      toast.success('Lift request sent to all staff!');
      
      // Reset after showing success
      setTimeout(() => {
        setLiftSuccess(false);
        setLiftForm({
          name: user?.name || '',
          phone: '',
          from_location: '',
          to_location: '',
          date: new Date().toISOString().split('T')[0],
          time: ''
        });
      }, 3000);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send request');
    } finally {
      setIsSubmittingLift(false);
    }
  };

  // Get today's bookings
  const today = new Date().toISOString().split('T')[0];
  const todaysBookings = myBookings.filter(b => 
    (b.start_time?.split('T')[0] === today) || (b.date === today)
  );

  // Get upcoming bookings (next 7 days)
  const upcomingBookings = myBookings
    .filter(b => new Date(b.start_time || b.date) >= new Date())
    .sort((a, b) => new Date(a.start_time || a.date) - new Date(b.start_time || b.date))
    .slice(0, 10);

  // Get bookings for calendar display
  const getBookingsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return myBookings.filter(b => 
      (b.start_time?.split('T')[0] === dateStr) || (b.date === dateStr)
    );
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    // Add empty cells for days before first day
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    
    return days;
  };

  // Available vehicles for booking
  const availableVehicles = vehicles.filter(v => getVehicleStatus(v) === 'available');

  // Group assistance providers by region
  const groupedProviders = assistanceProviders.reduce((acc, provider) => {
    if (!acc[provider.region]) {
      acc[provider.region] = [];
    }
    acc[provider.region].push(provider);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="staff-mobile-container min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="staff-mobile-container min-h-screen bg-gray-100 pb-24" data-testid="staff-mobile-view">
      {/* Header with Quick Wing Logo */}
      <div className="bg-gradient-to-br from-violet-700 via-violet-800 to-purple-900 text-white px-4 pt-12 pb-6">
        {/* Logo and Refresh Row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <img 
              src="/quick-wing-logo.png" 
              alt="Quick Wing" 
              className="w-10 h-10 mr-3 rounded-lg object-contain bg-white/10 p-1"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div>
              <h1 className="text-lg font-bold tracking-tight">Quick Wing</h1>
              <p className="text-xs text-violet-300">Fleet Management</p>
            </div>
          </div>
          <button 
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-3 bg-white/20 rounded-full active:bg-white/30 transition-colors"
            data-testid="refresh-btn"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* User Greeting */}
        <div className="mb-4">
          <p className="text-violet-300 text-sm">Welcome back,</p>
          <h2 className="text-xl font-bold">{user?.name || 'Staff'}</h2>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold">{todaysBookings.length}</p>
            <p className="text-xs text-violet-200">Today</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold">{availableVehicles.length}</p>
            <p className="text-xs text-violet-200">Available</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold">{upcomingBookings.length}</p>
            <p className="text-xs text-violet-200">Upcoming</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 -mt-4">
        {/* ========== HOME TAB ========== */}
        {activeTab === 'home' && (
          <div className="space-y-4">
            {/* Today's Bookings Alert */}
            {todaysBookings.length > 0 && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-200 shadow-lg">
                <div className="flex items-center mb-3">
                  <Bell className="text-amber-600 mr-2" size={20} />
                  <h3 className="font-bold text-amber-800">Today's Bookings</h3>
                </div>
                <div className="space-y-2">
                  {todaysBookings.map((booking) => (
                    <div 
                      key={booking.id}
                      className="flex items-center p-3 bg-white rounded-xl shadow-sm"
                      data-testid={`today-booking-${booking.id}`}
                    >
                      <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center mr-3">
                        <Car className="text-violet-600" size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {getVehicleName(booking.car_id)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                        booking.status === 'confirmed' || booking.status === 'approved'
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {booking.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fleet Status */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                <h2 className="font-bold text-gray-800 flex items-center">
                  <Car className="mr-2 text-violet-600" size={20} />
                  Fleet Status
                </h2>
                <span className="text-xs text-green-600 font-medium flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                  Live
                </span>
              </div>
              
              <div className="divide-y max-h-64 overflow-y-auto">
                {vehicles.map((vehicle) => {
                  const status = getVehicleStatus(vehicle);
                  const currentBooking = bookings.find(b => 
                    b.car_id === vehicle.id && 
                    new Date(b.start_time) <= new Date() && 
                    new Date(b.end_time) >= new Date()
                  );
                  
                  return (
                    <div 
                      key={vehicle.id}
                      className="p-4 flex items-center"
                      data-testid={`vehicle-${vehicle.id}`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-3 flex-shrink-0 ${
                        status === 'available' ? 'bg-green-100' :
                        status === 'in-use' ? 'bg-orange-100' : 'bg-red-100'
                      }`}>
                        <Car className={`${
                          status === 'available' ? 'text-green-600' :
                          status === 'in-use' ? 'text-orange-600' : 'text-red-600'
                        }`} size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{vehicle.name}</p>
                        <p className="text-xs text-gray-500">{vehicle.registration}</p>
                        {currentBooking && (
                          <p className="text-xs text-orange-600 mt-1 truncate">
                            {currentBooking.user_name} until {formatTime(currentBooking.end_time)}
                          </p>
                        )}
                      </div>
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0 ${
                        status === 'available' ? 'bg-green-100 text-green-700' :
                        status === 'in-use' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {status === 'available' ? 'Free' : status === 'in-use' ? 'In Use' : 'Blocked'}
                      </span>
                    </div>
                  );
                })}
                
                {vehicles.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    <Car size={40} className="mx-auto mb-2 opacity-50" />
                    <p>No vehicles available</p>
                  </div>
                )}
              </div>
            </div>

            {/* My Upcoming Bookings */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <h2 className="font-bold text-gray-800 flex items-center">
                  <Calendar className="mr-2 text-violet-600" size={20} />
                  My Upcoming Bookings
                </h2>
              </div>
              
              {upcomingBookings.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Calendar size={40} className="mx-auto mb-2 opacity-50" />
                  <p>No upcoming bookings</p>
                  <button
                    onClick={() => setActiveTab('bookings')}
                    className="mt-3 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium"
                  >
                    Book a Car
                  </button>
                </div>
              ) : (
                <div className="divide-y max-h-64 overflow-y-auto">
                  {upcomingBookings.slice(0, 5).map((booking) => (
                    <div 
                      key={booking.id}
                      className="p-4 flex items-center"
                      data-testid={`upcoming-booking-${booking.id}`}
                    >
                      <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center mr-3 flex-shrink-0">
                        <Calendar className="text-violet-600" size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {getVehicleName(booking.car_id)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(booking.start_time || booking.date)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                        booking.status === 'confirmed' || booking.status === 'approved'
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {booking.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== BOOKINGS TAB ========== */}
        {activeTab === 'bookings' && (
          <div className="space-y-4">
            {/* Book a Car Section */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white">
                <h2 className="font-bold flex items-center">
                  <Plus className="mr-2" size={20} />
                  Book a Car
                </h2>
                <p className="text-sm text-violet-200">Select an available vehicle</p>
              </div>
              
              <div className="p-4">
                {availableVehicles.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <Car size={40} className="mx-auto mb-2 opacity-50" />
                    <p>No vehicles available right now</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableVehicles.map((vehicle) => (
                      <button
                        key={vehicle.id}
                        onClick={() => {
                          setSelectedVehicle(vehicle);
                          setShowBookingForm(true);
                        }}
                        className="w-full flex items-center p-4 bg-green-50 rounded-xl active:bg-green-100 transition-colors text-left"
                        data-testid={`book-vehicle-${vehicle.id}`}
                      >
                        <div className="w-12 h-12 bg-green-200 rounded-xl flex items-center justify-center mr-3 flex-shrink-0">
                          <Car className="text-green-700" size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 truncate">{vehicle.name}</p>
                          <p className="text-sm text-gray-500">{vehicle.registration}</p>
                        </div>
                        <div className="flex items-center text-green-700 flex-shrink-0">
                          <span className="text-sm font-medium mr-1">Book</span>
                          <ChevronRight size={20} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Personal Calendar */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                <h2 className="font-bold text-gray-800 flex items-center">
                  <Calendar className="mr-2 text-violet-600" size={20} />
                  My Calendar
                </h2>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className="text-sm font-medium min-w-[100px] text-center">
                    {calendarMonth.toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}
                  </span>
                  <button 
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
              
              <div className="p-4">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {generateCalendarDays().map((date, idx) => {
                    if (!date) return <div key={`empty-${idx}`} className="aspect-square" />;
                    
                    const isToday = date.toDateString() === new Date().toDateString();
                    const dayBookings = getBookingsForDate(date);
                    const hasBookings = dayBookings.length > 0;
                    
                    return (
                      <div
                        key={date.toISOString()}
                        className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm relative ${
                          isToday ? 'bg-violet-600 text-white font-bold' :
                          hasBookings ? 'bg-violet-100 text-violet-800' : 'text-gray-700'
                        }`}
                      >
                        {date.getDate()}
                        {hasBookings && !isToday && (
                          <div className="absolute bottom-1 w-1.5 h-1.5 bg-violet-600 rounded-full"></div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center space-x-4 mt-4 pt-3 border-t">
                  <div className="flex items-center text-xs text-gray-500">
                    <div className="w-3 h-3 bg-violet-600 rounded mr-1"></div>
                    Today
                  </div>
                  <div className="flex items-center text-xs text-gray-500">
                    <div className="w-3 h-3 bg-violet-100 rounded mr-1"></div>
                    Has Booking
                  </div>
                </div>
              </div>
            </div>

            {/* Bookings List */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <h2 className="font-bold text-gray-800">All My Bookings</h2>
              </div>
              
              {myBookings.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Calendar size={40} className="mx-auto mb-2 opacity-50" />
                  <p>No bookings yet</p>
                </div>
              ) : (
                <div className="divide-y max-h-80 overflow-y-auto">
                  {myBookings.sort((a, b) => new Date(b.start_time || b.date) - new Date(a.start_time || a.date)).map((booking) => (
                    <div key={booking.id} className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-gray-900 truncate flex-1 mr-2">{getVehicleName(booking.car_id)}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                          booking.status === 'confirmed' || booking.status === 'approved'
                            ? 'bg-green-100 text-green-700' 
                            : booking.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{formatDate(booking.start_time || booking.date)}</p>
                      <p className="text-xs text-gray-400">{formatTime(booking.start_time)} - {formatTime(booking.end_time)}</p>
                      {booking.purpose && (
                        <p className="text-xs text-gray-500 mt-1 truncate">{booking.purpose}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== REQUEST LIFT TAB ========== */}
        {activeTab === 'lift' && (
          <div className="space-y-4">
            {liftSuccess ? (
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="text-green-600" size={40} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Request Sent!</h2>
                <p className="text-gray-600">
                  Your lift request has been sent to all staff members.
                </p>
              </div>
            ) : (
              <>
                {/* Request Form */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                  <div className="px-4 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white">
                    <h2 className="font-bold text-lg flex items-center">
                      <Navigation className="mr-2" size={22} />
                      Request a Lift
                    </h2>
                    <p className="text-sm text-violet-200">Ask a colleague for a ride</p>
                  </div>
                  
                  <form onSubmit={handleSubmitLiftRequest} className="p-4 space-y-4">
                    {/* Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        <User size={16} className="mr-2 text-gray-500" />
                        Your Name *
                      </label>
                      <input
                        type="text"
                        value={liftForm.name}
                        onChange={(e) => setLiftForm({ ...liftForm, name: e.target.value })}
                        className="w-full px-4 py-4 text-base border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:ring-0 focus:outline-none"
                        placeholder="Your name"
                        required
                        data-testid="lift-name-input"
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        <Phone size={16} className="mr-2 text-gray-500" />
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        value={liftForm.phone}
                        onChange={(e) => setLiftForm({ ...liftForm, phone: e.target.value })}
                        className="w-full px-4 py-4 text-base border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:ring-0 focus:outline-none"
                        placeholder="Your phone number"
                        required
                        data-testid="lift-phone-input"
                      />
                    </div>

                    {/* From Location */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        <MapPin size={16} className="mr-2 text-green-600" />
                        Where are you now? *
                      </label>
                      <input
                        type="text"
                        value={liftForm.from_location}
                        onChange={(e) => setLiftForm({ ...liftForm, from_location: e.target.value })}
                        className="w-full px-4 py-4 text-base border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:ring-0 focus:outline-none"
                        placeholder="e.g., Office, Home, etc."
                        required
                        data-testid="lift-from-input"
                      />
                    </div>

                    {/* To Location */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        <MapPin size={16} className="mr-2 text-red-500" />
                        Where are you going? *
                      </label>
                      <input
                        type="text"
                        value={liftForm.to_location}
                        onChange={(e) => setLiftForm({ ...liftForm, to_location: e.target.value })}
                        className="w-full px-4 py-4 text-base border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:ring-0 focus:outline-none"
                        placeholder="e.g., Client site, Station, etc."
                        required
                        data-testid="lift-to-input"
                      />
                    </div>

                    {/* Date and Time */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          <Calendar size={16} className="mr-2 text-violet-600" />
                          Date *
                        </label>
                        <input
                          type="date"
                          value={liftForm.date}
                          onChange={(e) => setLiftForm({ ...liftForm, date: e.target.value })}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full px-3 py-4 text-base border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:ring-0 focus:outline-none"
                          required
                          data-testid="lift-date-input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          <Clock size={16} className="mr-2 text-violet-600" />
                          Time *
                        </label>
                        <input
                          type="time"
                          value={liftForm.time}
                          onChange={(e) => setLiftForm({ ...liftForm, time: e.target.value })}
                          className="w-full px-3 py-4 text-base border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:ring-0 focus:outline-none"
                          required
                          data-testid="lift-time-input"
                        />
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSubmittingLift}
                      className="w-full py-5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-lg font-bold rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center space-x-2"
                      data-testid="submit-lift-btn"
                    >
                      {isSubmittingLift ? (
                        <>
                          <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <Send size={22} />
                          <span>Send Lift Request</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Info Box */}
                <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4">
                  <h3 className="font-bold text-violet-800 mb-2 flex items-center">
                    <AlertCircle size={18} className="mr-2" />
                    How it works
                  </h3>
                  <ul className="text-sm text-violet-700 space-y-1">
                    <li>• Your request will notify all staff members</li>
                    <li>• Include your phone so they can contact you</li>
                    <li>• You'll be notified when someone accepts</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        {/* ========== ASSISTANCE TAB ========== */}
        {activeTab === 'assistance' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="px-4 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white">
                <h2 className="font-bold text-lg flex items-center">
                  <Wrench className="mr-2" size={22} />
                  Breakdown Assistance
                </h2>
                <p className="text-sm text-violet-200">Emergency contacts by region</p>
              </div>
              
              {assistanceProviders.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Wrench size={40} className="mx-auto mb-2 opacity-50" />
                  <p>No assistance providers added yet</p>
                  <p className="text-sm mt-1">Contact your admin for help</p>
                </div>
              ) : (
                <div className="divide-y">
                  {Object.entries(groupedProviders).map(([region, providers]) => (
                    <div key={region} className="p-4">
                      <div className="flex items-center mb-3">
                        <MapPin className="text-violet-600 mr-2" size={18} />
                        <h3 className="font-bold text-gray-800">{region}</h3>
                      </div>
                      <div className="space-y-2">
                        {providers.map((provider) => (
                          <div 
                            key={provider.id}
                            className="p-3 bg-gray-50 rounded-xl"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-semibold text-gray-900">{provider.name}</p>
                              <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                                {provider.service_type}
                              </span>
                            </div>
                            <a 
                              href={`tel:${provider.phone}`}
                              className="flex items-center text-violet-600 font-medium mt-2"
                            >
                              <Phone size={16} className="mr-2" />
                              {provider.phone}
                            </a>
                            {provider.address && (
                              <p className="text-xs text-gray-500 mt-1 flex items-center">
                                <MapPin size={12} className="mr-1" />
                                {provider.address}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Tab Navigation - 4 tabs */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 safe-area-bottom z-50">
        <div className="flex justify-around items-center max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-colors min-w-[60px] ${
              activeTab === 'home' 
                ? 'bg-violet-100 text-violet-700' 
                : 'text-gray-500 active:bg-gray-100'
            }`}
            data-testid="tab-home"
          >
            <Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
            <span className="text-xs font-medium mt-1">Home</span>
          </button>
          
          <button
            onClick={() => setActiveTab('bookings')}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-colors min-w-[60px] ${
              activeTab === 'bookings' 
                ? 'bg-violet-100 text-violet-700' 
                : 'text-gray-500 active:bg-gray-100'
            }`}
            data-testid="tab-bookings"
          >
            <Calendar size={24} strokeWidth={activeTab === 'bookings' ? 2.5 : 2} />
            <span className="text-xs font-medium mt-1">Bookings</span>
          </button>
          
          <button
            onClick={() => setActiveTab('lift')}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-colors min-w-[60px] ${
              activeTab === 'lift' 
                ? 'bg-violet-100 text-violet-700' 
                : 'text-gray-500 active:bg-gray-100'
            }`}
            data-testid="tab-lift"
          >
            <Navigation size={24} strokeWidth={activeTab === 'lift' ? 2.5 : 2} />
            <span className="text-xs font-medium mt-1">Lift</span>
          </button>
          
          <button
            onClick={() => setActiveTab('assistance')}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-colors min-w-[60px] ${
              activeTab === 'assistance' 
                ? 'bg-violet-100 text-violet-700' 
                : 'text-gray-500 active:bg-gray-100'
            }`}
            data-testid="tab-assistance"
          >
            <Wrench size={24} strokeWidth={activeTab === 'assistance' ? 2.5 : 2} />
            <span className="text-xs font-medium mt-1">Help</span>
          </button>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingForm && selectedVehicle && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
          <div className="bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white px-5 py-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Book Vehicle</h2>
              <button 
                onClick={() => {
                  setShowBookingForm(false);
                  setSelectedVehicle(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Selected Vehicle */}
              <div className="flex items-center p-4 bg-violet-50 rounded-2xl">
                <div className="w-14 h-14 bg-violet-600 rounded-xl flex items-center justify-center mr-4 flex-shrink-0">
                  <Car className="text-white" size={28} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 text-lg truncate">{selectedVehicle.name}</p>
                  <p className="text-gray-500">{selectedVehicle.registration}</p>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={bookingForm.date}
                  onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:ring-0 focus:outline-none"
                />
              </div>

              {/* Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                  <input
                    type="time"
                    value={bookingForm.startTime}
                    onChange={(e) => setBookingForm({ ...bookingForm, startTime: e.target.value })}
                    className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:ring-0 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                  <input
                    type="time"
                    value={bookingForm.endTime}
                    onChange={(e) => setBookingForm({ ...bookingForm, endTime: e.target.value })}
                    className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:ring-0 focus:outline-none"
                  />
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Purpose *</label>
                <input
                  type="text"
                  value={bookingForm.purpose}
                  onChange={(e) => setBookingForm({ ...bookingForm, purpose: e.target.value })}
                  placeholder="e.g., Client meeting, Delivery"
                  className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:ring-0 focus:outline-none"
                  data-testid="booking-purpose-input"
                />
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmitBooking}
                disabled={isSubmittingBooking || !bookingForm.purpose}
                className="w-full py-5 bg-violet-600 text-white text-lg font-bold rounded-xl disabled:opacity-50 active:bg-violet-700 transition-colors"
                data-testid="submit-booking-btn"
              >
                {isSubmittingBooking ? 'Submitting...' : 'Request Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .safe-area-bottom {
          padding-bottom: max(8px, env(safe-area-inset-bottom));
        }
        .staff-mobile-container {
          -webkit-text-size-adjust: 100%;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .staff-mobile-container input,
        .staff-mobile-container button {
          font-size: 16px; /* Prevents iOS zoom on focus */
        }
      `}</style>
    </div>
  );
};

export default StaffMobileView;
