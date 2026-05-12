import React, { useState, useEffect, useCallback } from 'react';
import { 
  Car, Calendar, Clock, MapPin, User, Phone,
  RefreshCw, X, ChevronRight, ChevronLeft, Send, CheckCircle,
  Bell, LogOut, Navigation, Plus, Users, Home, FileText
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { liftRequestAPI } from '../api/api';
import CustomDocumentsStaff from './CustomDocumentsStaff';
import DriverLicenceCard from './DriverLicenceCard';
import Greeting from './Greeting';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StaffMobileView = ({ tenantSlug }) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Self profile (carries driver_licence_expiry — refreshed after edits)
  const [profile, setProfile] = useState(user || null);
  
  // Data states
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  
  // Booking states
  const [bookingView, setBookingView] = useState('all');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookingForm, setBookingForm] = useState({
    car_id: '',
    user_name: user?.name || '',
    start_time: '',
    end_time: '',
    start_eircode: '',
    end_eircode: '',
    purpose: '',
    is_double_up_call: false,
    is_recurring: false
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

  // Lock viewport for mobile app experience
  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
    }
    const originalStyle = document.body.style.cssText;
    document.body.style.cssText = 'overflow: hidden; position: fixed; width: 100%; height: 100%; margin: 0; padding: 0;';
    document.documentElement.style.cssText = 'overflow: hidden; height: 100%;';
    return () => {
      document.body.style.cssText = originalStyle;
      document.documentElement.style.cssText = '';
    };
  }, []);

  // Fetch data
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [vehiclesRes, bookingsRes] = await Promise.all([
        axios.get(`${API}/vehicles`, { headers }),
        axios.get(`${API}/bookings`, { headers })
      ]);
      
      setVehicles(vehiclesRes.data || []);
      setBookings(bookingsRes.data || []);
      
      const userBookings = (bookingsRes.data || []).filter(b => 
        b.user_id === user?.id || 
        b.user_name === user?.name ||
        b.created_by_email === user?.email
      );
      setMyBookings(userBookings);
      
    } catch (err) {
      if (!silent) toast.error('Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Fetch latest /auth/me so we always have the freshest driver_licence_expiry
  const refreshProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.user) setProfile(res.data.user);
    } catch (err) {
      // Non-fatal — staff can still use the app without licence info
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (user?.name) {
      setLiftForm(prev => ({ ...prev, name: user.name }));
      setBookingForm(prev => ({ ...prev, user_name: user.name }));
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

  const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const getVehicleName = (carId) => {
    const vehicle = vehicles.find(v => v.id === carId);
    return vehicle?.name || 'Vehicle';
  };

  // Generate time slots
  const generateTimeSlots = () => {
    const slots = [];
    for (let h = 7; h <= 22; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
    }
    return slots;
  };

  // Check if slot is booked
  const isSlotBooked = (vehicleId, hour) => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    return bookings.some(b => {
      if (b.car_id !== vehicleId) return false;
      const startDate = b.start_time?.split('T')[0];
      if (startDate !== dateStr) return false;
      const startHour = parseInt(b.start_time?.split('T')[1]?.split(':')[0] || 0);
      const endHour = parseInt(b.end_time?.split('T')[1]?.split(':')[0] || 0);
      return hour >= startHour && hour < endHour;
    });
  };

  // Submit booking
  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    if (!bookingForm.car_id || !bookingForm.start_time || !bookingForm.end_time) {
      toast.error('Please fill required fields');
      return;
    }
    setIsSubmittingBooking(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      await axios.post(`${API}/bookings`, {
        ...bookingForm,
        user_name: user?.name || 'Staff'
      }, { headers: { Authorization: `Bearer ${token}` } });

      toast.success('Booking created!');
      setShowBookingForm(false);
      setBookingForm({
        car_id: '',
        user_name: user?.name || '',
        start_time: '',
        end_time: '',
        start_eircode: '',
        end_eircode: '',
        purpose: '',
        is_double_up_call: false,
        is_recurring: false
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create booking');
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Book a slot
  const handleBookSlot = (vehicleId, hour) => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    setBookingForm({
      ...bookingForm,
      car_id: vehicleId,
      start_time: `${dateStr}T${hour.toString().padStart(2, '0')}:00:00`,
      end_time: `${dateStr}T${(hour + 1).toString().padStart(2, '0')}:00:00`
    });
    setShowBookingForm(true);
  };

  // Submit lift request
  const handleSubmitLiftRequest = async (e) => {
    e.preventDefault();
    if (!liftForm.from_location || !liftForm.to_location || !liftForm.time || !liftForm.phone) {
      toast.error('Please fill all required fields');
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
      toast.success('Lift request sent!');
      setTimeout(() => {
        setLiftSuccess(false);
        setLiftForm({ name: user?.name || '', phone: '', from_location: '', to_location: '', date: new Date().toISOString().split('T')[0], time: '' });
      }, 3000);
    } catch (error) {
      toast.error('Failed to send request');
    } finally {
      setIsSubmittingLift(false);
    }
  };

  const availableVehicles = vehicles.filter(v => getVehicleStatus(v) === 'available');
  const inUseVehicles = vehicles.filter(v => getVehicleStatus(v) === 'in-use');
  const today = new Date().toISOString().split('T')[0];

  if (loading) {
    return (
      <div className="staff-app" data-testid="staff-mobile-loading">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="staff-app" data-testid="staff-mobile-view">
      {/* Header */}
      <header className="app-header">
        <div className="header-brand">
          <span className="logo-text">Quick Wing</span>
        </div>
        <div className="header-actions">
          <button className="icon-btn" data-testid="notifications-btn">
            <Bell size={20} />
          </button>
          <span className="user-badge">{user?.name?.split(' ')[0] || 'Staff'}</span>
          <button onClick={logout} className="icon-btn logout" data-testid="logout-btn">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-content">
        {/* HOME TAB - Dashboard */}
        {activeTab === 'home' && (
          <div className="tab-page" data-testid="home-tab">
            <div className="page-header">
              <div>
                <Greeting
                  user={profile || user}
                  className="page-title"
                  subtitleClassName="page-subtitle"
                  testid="staff-greeting"
                />
              </div>
              <p className="current-time">
                <Clock size={14} />
                {new Date().toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
              <div className="stat-card available">
                <div className="stat-icon">
                  <Car size={24} />
                </div>
                <div className="stat-info">
                  <span className="stat-value">{availableVehicles.length}</span>
                  <span className="stat-label">Available</span>
                </div>
              </div>
              <div className="stat-card in-use">
                <div className="stat-icon">
                  <Car size={24} />
                </div>
                <div className="stat-info">
                  <span className="stat-value">{inUseVehicles.length}</span>
                  <span className="stat-label">In Use</span>
                </div>
              </div>
            </div>

            {/* Driver's Licence — self-service expiry tracking */}
            <div style={{ marginTop: 16 }}>
              <DriverLicenceCard user={profile} onUpdated={refreshProfile} />
            </div>

            {/* Refresh Button */}
            <button 
              onClick={() => fetchData(true)} 
              className="refresh-btn" 
              disabled={refreshing}
              data-testid="refresh-btn"
            >
              <RefreshCw size={18} className={refreshing ? 'spinning' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>

            {/* Live Fleet Status Section */}
            <div className="section">
              <div className="section-header">
                <span className="live-indicator"></span>
                <h2>Live Fleet Status</h2>
                <span className="update-info">Auto-updates every 15s</span>
              </div>

              {/* Vehicle Grid - 2 Column */}
              <div className="vehicle-grid">
                {vehicles.map(vehicle => {
                  const status = getVehicleStatus(vehicle);
                  const currentBooking = bookings.find(b => 
                    b.car_id === vehicle.id && 
                    new Date(b.start_time) <= new Date() && 
                    new Date(b.end_time) >= new Date()
                  );
                  
                  return (
                    <div 
                      key={vehicle.id} 
                      className={`vehicle-card ${status}`}
                      data-testid={`vehicle-card-${vehicle.id}`}
                    >
                      <div className="vehicle-header">
                        <span className="vehicle-name">{vehicle.name}</span>
                        <div className={`status-toggle ${status}`}>
                          <span className="toggle-knob"></span>
                        </div>
                      </div>
                      <p className="vehicle-reg">{vehicle.registration}</p>
                      
                      {currentBooking && (
                        <div className="vehicle-booking">
                          <p className="booking-user">
                            <User size={12} />
                            {currentBooking.user_name}
                          </p>
                          <p className="booking-time">
                            <Clock size={12} />
                            Until {formatTime(currentBooking.end_time)}
                          </p>
                        </div>
                      )}
                      
                      {!currentBooking && status === 'available' && (
                        <p className="available-text">Available Now</p>
                      )}
                      
                      {status === 'blocked' && (
                        <p className="blocked-text">Blocked</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* BOOKINGS TAB */}
        {activeTab === 'bookings' && !showBookingForm && (
          <div className="tab-page" data-testid="bookings-tab">
            <div className="page-header">
              <h1 className="page-title">Car Bookings</h1>
              <p className="page-subtitle">Auto-updates every 15 seconds</p>
            </div>

            {/* New Booking Button */}
            <button 
              onClick={() => setShowBookingForm(true)} 
              className="primary-btn full-width"
              data-testid="new-booking-btn"
            >
              <Plus size={18} />
              New Booking
            </button>

            {/* Booking View Tabs */}
            <div className="tab-pills">
              <button 
                className={`pill ${bookingView === 'all' ? 'active' : ''}`}
                onClick={() => setBookingView('all')}
                data-testid="all-bookings-tab"
              >
                <Users size={16} />
                All Bookings
              </button>
              <button 
                className={`pill ${bookingView === 'my' ? 'active' : ''}`}
                onClick={() => setBookingView('my')}
                data-testid="my-bookings-tab"
              >
                <User size={16} />
                My Bookings
                {myBookings.length > 0 && <span className="pill-badge">{myBookings.length}</span>}
              </button>
            </div>

            {/* Car Selection */}
            <div className="car-selector">
              <p className="selector-label">Select a car to view slots:</p>
              <div className="car-chips">
                <button 
                  className={`car-chip ${!selectedVehicle ? 'active' : ''}`}
                  onClick={() => setSelectedVehicle(null)}
                >
                  <Calendar size={14} />
                  All Cars
                </button>
                {vehicles.map(v => (
                  <button 
                    key={v.id}
                    className={`car-chip ${selectedVehicle?.id === v.id ? 'active' : ''}`}
                    onClick={() => setSelectedVehicle(v)}
                  >
                    <Car size={14} />
                    {v.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Navigation */}
            <div className="date-navigator">
              <button 
                className="nav-arrow"
                onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() - 1)))}
              >
                <ChevronLeft size={20} />
              </button>
              <span className="date-display">
                <Calendar size={16} />
                {formatDate(selectedDate)}
              </span>
              <button 
                className="nav-arrow"
                onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() + 1)))}
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Time Slots for Selected Vehicle(s) */}
            {(selectedVehicle ? [selectedVehicle] : vehicles.slice(0, 2)).map(vehicle => (
              <div key={vehicle.id} className="vehicle-schedule-card">
                <div className="schedule-header">
                  <Car size={20} />
                  <div className="schedule-info">
                    <span className="schedule-name">{vehicle.name}</span>
                    <span className="schedule-reg">{vehicle.registration}</span>
                  </div>
                </div>

                <div className="time-slots-grid">
                  {generateTimeSlots().map(slot => {
                    const hour = parseInt(slot.split(':')[0]);
                    const isBooked = isSlotBooked(vehicle.id, hour);
                    return (
                      <button 
                        key={slot}
                        className={`time-slot ${isBooked ? 'booked' : 'free'}`}
                        onClick={() => !isBooked && handleBookSlot(vehicle.id, hour)}
                        disabled={isBooked}
                        data-testid={`slot-${vehicle.id}-${hour}`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>

                <div className="slot-legend">
                  <span><span className="dot green"></span> Free</span>
                  <span><span className="dot red"></span> Booked</span>
                </div>
              </div>
            ))}

            {/* My Bookings List */}
            {bookingView === 'my' && myBookings.length > 0 && (
              <div className="bookings-list">
                <h3>My Upcoming Bookings</h3>
                {myBookings.map(b => (
                  <div key={b.id} className="booking-item">
                    <div className="booking-item-header">
                      <strong>{getVehicleName(b.car_id)}</strong>
                      <span className={`status-badge ${b.status || 'pending'}`}>
                        {b.status || 'Pending'}
                      </span>
                    </div>
                    <p className="booking-item-time">
                      {formatDate(new Date(b.start_time))} | {formatTime(b.start_time)} - {formatTime(b.end_time)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BOOKING FORM */}
        {activeTab === 'bookings' && showBookingForm && (
          <div className="tab-page form-page" data-testid="booking-form">
            <div className="page-header">
              <h1 className="page-title">New Booking</h1>
              <button className="close-btn" onClick={() => setShowBookingForm(false)}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmitBooking} className="booking-form">
              <div className="form-field">
                <label>Select Car *</label>
                <select 
                  value={bookingForm.car_id}
                  onChange={e => setBookingForm({...bookingForm, car_id: e.target.value})}
                  required
                  data-testid="car-select"
                >
                  <option value="">Choose a car...</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.registration})</option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Booked By</label>
                <input type="text" value={user?.name || ''} disabled className="disabled-input" />
                <span className="field-hint">Auto-filled from your account</span>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Start Time *</label>
                  <input 
                    type="datetime-local" 
                    value={bookingForm.start_time?.replace(':00Z', '').replace('Z', '')} 
                    onChange={e => setBookingForm({...bookingForm, start_time: e.target.value})}
                    required
                    data-testid="start-time"
                  />
                </div>
                <div className="form-field">
                  <label>End Time *</label>
                  <input 
                    type="datetime-local" 
                    value={bookingForm.end_time?.replace(':00Z', '').replace('Z', '')} 
                    onChange={e => setBookingForm({...bookingForm, end_time: e.target.value})}
                    required
                    data-testid="end-time"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Start Eircode</label>
                  <input 
                    type="text" 
                    value={bookingForm.start_eircode}
                    onChange={e => setBookingForm({...bookingForm, start_eircode: e.target.value})}
                    placeholder="e.g. V92 H6TP"
                  />
                </div>
                <div className="form-field">
                  <label>End Eircode</label>
                  <input 
                    type="text" 
                    value={bookingForm.end_eircode}
                    onChange={e => setBookingForm({...bookingForm, end_eircode: e.target.value})}
                    placeholder="e.g. V23 KV29"
                  />
                </div>
              </div>

              <div className="form-field">
                <label>Purpose / Notes</label>
                <input 
                  type="text" 
                  value={bookingForm.purpose}
                  onChange={e => setBookingForm({...bookingForm, purpose: e.target.value})}
                  placeholder="e.g. Client visit"
                />
              </div>

              <div className="checkbox-card highlight">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={bookingForm.is_double_up_call}
                    onChange={e => setBookingForm({...bookingForm, is_double_up_call: e.target.checked})}
                  />
                  <Users size={18} />
                  Double up call?
                </label>
                <span className="checkbox-hint">Check if this is a shared visit</span>
              </div>

              <div className="checkbox-card">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={bookingForm.is_recurring}
                    onChange={e => setBookingForm({...bookingForm, is_recurring: e.target.checked})}
                  />
                  <RefreshCw size={18} />
                  Make recurring
                </label>
              </div>

              <div className="form-actions">
                <button type="submit" className="primary-btn" disabled={isSubmittingBooking} data-testid="submit-booking">
                  {isSubmittingBooking ? 'Creating...' : 'Create Booking'}
                </button>
                <button type="button" className="secondary-btn" onClick={() => setShowBookingForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* REQUEST LIFT TAB */}
        {activeTab === 'lift' && (
          <div className="tab-page" data-testid="lift-tab">
            {liftSuccess ? (
              <div className="success-state">
                <CheckCircle size={64} />
                <h2>Request Sent!</h2>
                <p>Staff members have been notified</p>
              </div>
            ) : (
              <>
                <div className="page-header">
                  <h1 className="page-title">Request a Lift</h1>
                  <p className="page-subtitle">Ask a colleague for a ride</p>
                </div>

                <form onSubmit={handleSubmitLiftRequest} className="lift-form">
                  <div className="form-field">
                    <label><User size={14} /> Your Name</label>
                    <input 
                      type="text" 
                      value={liftForm.name}
                      onChange={e => setLiftForm({...liftForm, name: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label><Phone size={14} /> Phone Number *</label>
                    <input 
                      type="tel" 
                      value={liftForm.phone}
                      onChange={e => setLiftForm({...liftForm, phone: e.target.value})}
                      placeholder="Your contact number"
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label><MapPin size={14} className="icon-green" /> Where are you? *</label>
                    <input 
                      type="text" 
                      value={liftForm.from_location}
                      onChange={e => setLiftForm({...liftForm, from_location: e.target.value})}
                      placeholder="Current location"
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label><MapPin size={14} className="icon-red" /> Where to? *</label>
                    <input 
                      type="text" 
                      value={liftForm.to_location}
                      onChange={e => setLiftForm({...liftForm, to_location: e.target.value})}
                      placeholder="Destination"
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-field">
                      <label><Calendar size={14} /> Date *</label>
                      <input 
                        type="date" 
                        value={liftForm.date}
                        onChange={e => setLiftForm({...liftForm, date: e.target.value})}
                        min={today}
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label><Clock size={14} /> Time *</label>
                      <input 
                        type="time" 
                        value={liftForm.time}
                        onChange={e => setLiftForm({...liftForm, time: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" className="primary-btn full-width" disabled={isSubmittingLift} data-testid="submit-lift">
                    {isSubmittingLift ? 'Sending...' : <><Send size={18} /> Send Request</>}
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div className="tab-page" data-testid="documents-tab">
            <div className="page-header">
              <h1 className="page-title">Documents</h1>
              <p className="page-subtitle">Submit fuel logs, checks and reports</p>
            </div>
            <CustomDocumentsStaff />
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav" data-testid="bottom-nav">
        <button 
          onClick={() => setActiveTab('home')} 
          className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
          data-testid="nav-home"
        >
          <Home size={22} />
          <span>Home</span>
        </button>
        <button 
          onClick={() => { setActiveTab('bookings'); setShowBookingForm(false); }} 
          className={`nav-item ${activeTab === 'bookings' ? 'active' : ''}`}
          data-testid="nav-bookings"
        >
          <Calendar size={22} />
          <span>Bookings</span>
        </button>
        <button 
          onClick={() => setActiveTab('documents')} 
          className={`nav-item ${activeTab === 'documents' ? 'active' : ''}`}
          data-testid="nav-documents"
        >
          <FileText size={22} />
          <span>Docs</span>
        </button>
        <button 
          onClick={() => setActiveTab('lift')} 
          className={`nav-item ${activeTab === 'lift' ? 'active' : ''}`}
          data-testid="nav-lift"
        >
          <Navigation size={22} />
          <span>Lift</span>
        </button>
      </nav>

      <style>{styles}</style>
    </div>
  );
};

const styles = `
  /* Reset & Base */
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  .staff-app {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: #F8F9FA;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
    height: 100dvh;
    width: 100vw;
  }
  
  /* Loading */
  .loading-screen {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: #6B7280;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #007BFF;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinning { animation: spin 1s linear infinite; }
  
  /* Header */
  .app-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    padding-top: max(12px, env(safe-area-inset-top));
    background: #FFFFFF;
    border-bottom: 1px solid #E5E7EB;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  
  .header-brand { display: flex; align-items: center; gap: 8px; }
  
  .logo-text {
    font-size: 20px;
    font-weight: 700;
    color: #007BFF;
  }
  
  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .icon-btn {
    background: none;
    border: none;
    color: #6B7280;
    padding: 6px;
    cursor: pointer;
    border-radius: 8px;
    transition: background 0.2s;
  }
  
  .icon-btn:hover { background: #F3F4F6; }
  .icon-btn.logout { color: #DC2626; }
  
  .user-badge {
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    background: #F3F4F6;
    padding: 4px 10px;
    border-radius: 12px;
  }
  
  /* Main Content */
  .app-content {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  .tab-page {
    padding: 16px;
    padding-bottom: 100px;
  }
  
  .form-page { background: #FFFFFF; }
  
  /* Page Header */
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  
  .page-title {
    font-size: 24px;
    font-weight: 700;
    color: #111827;
  }
  
  .page-subtitle {
    font-size: 13px;
    color: #6B7280;
  }
  
  .current-time {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    color: #6B7280;
  }
  
  .close-btn {
    background: none;
    border: none;
    color: #6B7280;
    padding: 4px;
    cursor: pointer;
  }
  
  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
  }
  
  .stat-card {
    background: #FFFFFF;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  
  .stat-card.available .stat-icon { background: #DCFCE7; color: #22C55E; }
  .stat-card.in-use .stat-icon { background: #FEE2E2; color: #EF4444; }
  
  .stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .stat-info { display: flex; flex-direction: column; }
  .stat-value { font-size: 28px; font-weight: 700; color: #111827; }
  .stat-label { font-size: 13px; color: #6B7280; }
  
  /* Refresh Button */
  .refresh-btn {
    width: 100%;
    padding: 14px;
    background: #007BFF;
    color: #FFFFFF;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    margin-bottom: 20px;
    transition: background 0.2s;
  }
  
  .refresh-btn:hover { background: #0056b3; }
  .refresh-btn:disabled { opacity: 0.7; cursor: not-allowed; }
  
  /* Section */
  .section { margin-bottom: 20px; }
  
  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
  
  .section-header h2 {
    font-size: 16px;
    font-weight: 600;
    color: #111827;
  }
  
  .live-indicator {
    width: 10px;
    height: 10px;
    background: #22C55E;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  .update-info {
    font-size: 12px;
    color: #9CA3AF;
    margin-left: auto;
  }
  
  /* Vehicle Grid - 2 Column */
  .vehicle-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .vehicle-card {
    background: #FFFFFF;
    border-radius: 12px;
    padding: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    border: 1px solid #E5E7EB;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  
  .vehicle-card:active { transform: scale(0.98); }
  
  .vehicle-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  
  .vehicle-name {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 70%;
  }
  
  /* Toggle Switch Style */
  .status-toggle {
    width: 36px;
    height: 20px;
    border-radius: 10px;
    position: relative;
    transition: background 0.2s;
  }
  
  .status-toggle.available { background: #22C55E; }
  .status-toggle.in-use { background: #EF4444; }
  .status-toggle.blocked { background: #9CA3AF; }
  
  .toggle-knob {
    position: absolute;
    width: 16px;
    height: 16px;
    background: #FFFFFF;
    border-radius: 50%;
    top: 2px;
    transition: left 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }
  
  .status-toggle.available .toggle-knob { left: 18px; }
  .status-toggle.in-use .toggle-knob,
  .status-toggle.blocked .toggle-knob { left: 2px; }
  
  .vehicle-reg {
    font-size: 12px;
    color: #6B7280;
    margin-bottom: 8px;
  }
  
  .vehicle-booking {
    padding-top: 8px;
    border-top: 1px solid #F3F4F6;
  }
  
  .booking-user, .booking-time {
    font-size: 12px;
    color: #6B7280;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .booking-user { color: #DC2626; margin-bottom: 2px; }
  
  .available-text {
    font-size: 12px;
    font-weight: 500;
    color: #22C55E;
    padding-top: 8px;
  }
  
  .blocked-text {
    font-size: 12px;
    font-weight: 500;
    color: #9CA3AF;
    padding-top: 8px;
  }
  
  /* Primary Button */
  .primary-btn {
    padding: 14px 24px;
    background: #007BFF;
    color: #FFFFFF;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .primary-btn:hover { background: #0056b3; }
  .primary-btn:disabled { opacity: 0.7; cursor: not-allowed; }
  .primary-btn.full-width { width: 100%; margin-bottom: 16px; }
  
  .secondary-btn {
    padding: 14px 24px;
    background: #FFFFFF;
    color: #374151;
    border: 1px solid #D1D5DB;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .secondary-btn:hover { background: #F9FAFB; }
  
  /* Tab Pills */
  .tab-pills {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }
  
  .pill {
    flex: 1;
    padding: 10px 12px;
    background: #FFFFFF;
    border: 2px solid #E5E7EB;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 500;
    color: #007BFF;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .pill.active {
    background: #007BFF;
    border-color: #007BFF;
    color: #FFFFFF;
  }
  
  .pill-badge {
    background: rgba(255,255,255,0.3);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
  }
  
  .pill:not(.active) .pill-badge {
    background: #E5E7EB;
    color: #374151;
  }
  
  /* Car Selector */
  .car-selector { margin-bottom: 16px; }
  
  .selector-label {
    font-size: 13px;
    color: #6B7280;
    margin-bottom: 8px;
  }
  
  .car-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .car-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    background: #FFFFFF;
    border: 1px solid #E5E7EB;
    border-radius: 20px;
    font-size: 13px;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .car-chip.active {
    background: #FEF3C7;
    border-color: #FCD34D;
    color: #92400E;
    font-weight: 600;
  }
  
  /* Date Navigator */
  .date-navigator {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #FFFFFF;
    border-radius: 12px;
    padding: 12px;
    margin-bottom: 16px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  
  .nav-arrow {
    background: none;
    border: none;
    color: #6B7280;
    padding: 4px;
    cursor: pointer;
    border-radius: 8px;
    transition: background 0.2s;
  }
  
  .nav-arrow:hover { background: #F3F4F6; }
  
  .date-display {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 500;
    color: #111827;
  }
  
  /* Vehicle Schedule Card */
  .vehicle-schedule-card {
    background: #FEF9C3;
    border: 2px solid #FCD34D;
    border-radius: 12px;
    padding: 14px;
    margin-bottom: 12px;
  }
  
  .schedule-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    color: #92400E;
  }
  
  .schedule-info { flex: 1; }
  .schedule-name { font-weight: 600; color: #111827; display: block; }
  .schedule-reg { font-size: 12px; color: #6B7280; }
  
  /* Time Slots Grid */
  .time-slots-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-bottom: 12px;
  }
  
  .time-slot {
    padding: 10px 4px;
    border: 1px solid #E5E7EB;
    border-radius: 8px;
    background: #FFFFFF;
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .time-slot.free:hover {
    background: #DCFCE7;
    border-color: #22C55E;
    color: #16A34A;
  }
  
  .time-slot.booked {
    background: #FEE2E2;
    color: #DC2626;
    cursor: not-allowed;
  }
  
  /* Slot Legend */
  .slot-legend {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: #6B7280;
  }
  
  .slot-legend span {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  
  .dot.green { background: #22C55E; }
  .dot.red { background: #EF4444; }
  
  /* Bookings List */
  .bookings-list {
    margin-top: 20px;
  }
  
  .bookings-list h3 {
    font-size: 16px;
    font-weight: 600;
    color: #111827;
    margin-bottom: 12px;
  }
  
  .booking-item {
    background: #FFFFFF;
    border-radius: 12px;
    padding: 14px;
    margin-bottom: 10px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    border: 1px solid #E5E7EB;
  }
  
  .booking-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  
  .booking-item-header strong { color: #111827; }
  
  .status-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 10px;
    text-transform: capitalize;
  }
  
  .status-badge.approved, .status-badge.confirmed { background: #DCFCE7; color: #16A34A; }
  .status-badge.pending { background: #FEF3C7; color: #D97706; }
  .status-badge.rejected { background: #FEE2E2; color: #DC2626; }
  
  .booking-item-time { font-size: 13px; color: #6B7280; }
  
  /* Form Styles */
  .booking-form, .lift-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .form-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .form-field label {
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .form-field input, .form-field select {
    padding: 14px;
    border: 1px solid #D1D5DB;
    border-radius: 10px;
    font-size: 16px;
    background: #FFFFFF;
    transition: border-color 0.2s;
  }
  
  .form-field input:focus, .form-field select:focus {
    outline: none;
    border-color: #007BFF;
  }
  
  .disabled-input {
    background: #F3F4F6 !important;
    color: #6B7280 !important;
  }
  
  .field-hint {
    font-size: 12px;
    color: #9CA3AF;
  }
  
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  
  /* Checkbox Card */
  .checkbox-card {
    background: #FFFFFF;
    border: 1px solid #E5E7EB;
    border-radius: 10px;
    padding: 14px;
  }
  
  .checkbox-card.highlight {
    background: #FEF9C3;
    border-color: #FCD34D;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
  }
  
  .checkbox-card.highlight .checkbox-label { color: #92400E; }
  
  .checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: #007BFF;
  }
  
  .checkbox-hint {
    display: block;
    font-size: 12px;
    color: #B45309;
    margin-top: 4px;
    margin-left: 28px;
  }
  
  /* Form Actions */
  .form-actions {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }
  
  .form-actions .primary-btn,
  .form-actions .secondary-btn { flex: 1; }
  
  /* Icons */
  .icon-green { color: #22C55E; }
  .icon-red { color: #DC2626; }
  
  /* Success State */
  .success-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 80px 20px;
    color: #22C55E;
  }
  
  .success-state h2 {
    margin: 20px 0 8px;
    color: #111827;
    font-size: 24px;
  }
  
  .success-state p { color: #6B7280; }
  
  /* Bottom Navigation */
  .bottom-nav {
    flex-shrink: 0;
    display: flex;
    background: #FFFFFF;
    border-top: 1px solid #E5E7EB;
    padding: 8px 0;
    padding-bottom: max(8px, env(safe-area-inset-bottom));
    box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
  }
  
  .nav-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background: none;
    border: none;
    padding: 10px 8px;
    color: #9CA3AF;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.2s;
  }
  
  .nav-item.active {
    color: #007BFF;
  }
  
  .nav-item.active::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 32px;
    height: 3px;
    background: #007BFF;
    border-radius: 0 0 3px 3px;
  }
`;

export default StaffMobileView;
