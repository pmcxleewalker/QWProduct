import React, { useState, useEffect, useCallback } from 'react';
import { 
  Car, Calendar, Clock, MapPin, User, Phone,
  RefreshCw, X, ChevronRight, ChevronLeft, Send, CheckCircle,
  Bell, LogOut, Navigation, Plus, Users
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { liftRequestAPI } from '../api/api';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StaffMobileView = ({ tenantSlug }) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  
  // Booking states
  const [bookingView, setBookingView] = useState('all'); // 'all' or 'my'
  const [showAvailableCars, setShowAvailableCars] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('day');
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

  // Lock viewport
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
    return date.toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'short' });
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
  const today = new Date().toISOString().split('T')[0];

  if (loading) {
    return (
      <div className="staff-app">
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
        <span className="logo">Quick Wing</span>
        <div className="header-actions">
          <Bell size={20} />
          <span className="user-name">{user?.name?.split(' ')[0] || 'staff'}</span>
          <button onClick={logout} className="logout-btn"><LogOut size={18} /></button>
        </div>
      </header>

      {/* Content */}
      <main className="app-content">
        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div className="tab-page">
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle"><Clock size={14} /> {new Date().toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}</p>

            {/* Stats Cards */}
            <div className="stats-row">
              <div className="stat-card blue">
                <span className="stat-label">Available</span>
                <span className="stat-value">{availableVehicles.length}</span>
              </div>
              <div className="stat-card green">
                <span className="stat-label">My Bookings</span>
                <span className="stat-value">{myBookings.length}</span>
              </div>
            </div>

            {/* Refresh Button */}
            <button onClick={() => fetchData(true)} className="refresh-btn-full" disabled={refreshing}>
              <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
              Refresh
            </button>

            {/* Live Fleet Status */}
            <div className="section-header">
              <span className="live-dot"></span>
              <span>Live Fleet Status</span>
              <span className="update-text">(updates every 15s)</span>
            </div>

            {/* Vehicle Grid */}
            <div className="vehicle-grid">
              {vehicles.map(vehicle => {
                const status = getVehicleStatus(vehicle);
                const currentBooking = bookings.find(b => 
                  b.car_id === vehicle.id && 
                  new Date(b.start_time) <= new Date() && 
                  new Date(b.end_time) >= new Date()
                );
                return (
                  <div key={vehicle.id} className="vehicle-card">
                    <div className="vehicle-card-header">
                      <span className="vehicle-name">{vehicle.name}</span>
                      <span className={`status-toggle ${status}`}></span>
                    </div>
                    <p className="vehicle-reg">{vehicle.registration}</p>
                    {currentBooking && (
                      <>
                        <p className="vehicle-location"><MapPin size={12} /> {currentBooking.user_name}</p>
                        <p className="vehicle-time">{formatTime(currentBooking.end_time)}</p>
                      </>
                    )}
                    {!currentBooking && status === 'available' && (
                      <p className="vehicle-available">Available</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* BOOKINGS TAB */}
        {activeTab === 'bookings' && !showBookingForm && (
          <div className="tab-page">
            <h1 className="page-title">Car Bookings</h1>
            <p className="page-subtitle">Auto-updates every 15 seconds</p>

            {/* New Booking Button */}
            <button onClick={() => setShowBookingForm(true)} className="new-booking-btn">
              <Plus size={18} />
              New Booking
            </button>

            {/* Tabs */}
            <div className="booking-tabs">
              <button 
                className={`tab-btn ${bookingView === 'all' ? 'active' : ''}`}
                onClick={() => setBookingView('all')}
              >
                <Users size={16} /> All Bookings
              </button>
              <button 
                className={`tab-btn ${bookingView === 'my' ? 'active' : ''}`}
                onClick={() => setBookingView('my')}
              >
                <User size={16} /> My Bookings <span className="badge">{myBookings.length}</span>
              </button>
            </div>

            {/* Available Cars Section */}
            <div className={`available-section ${showAvailableCars ? 'expanded' : ''}`}>
              <button className="available-header" onClick={() => setShowAvailableCars(!showAvailableCars)}>
                <span>Available Cars & Time Slots</span>
                <span className="car-count">{availableVehicles.length} cars</span>
                <ChevronRight size={18} className={showAvailableCars ? 'rotated' : ''} />
              </button>

              {showAvailableCars && (
                <div className="available-content">
                  <p className="help-text">Click on any available hour to book</p>
                  
                  {/* Car Selection Pills */}
                  <div className="car-pills">
                    <button 
                      className={`car-pill ${!selectedVehicle ? 'active' : ''}`}
                      onClick={() => setSelectedVehicle(null)}
                    >
                      <Calendar size={14} /> All Cars
                    </button>
                    {vehicles.map(v => (
                      <button 
                        key={v.id}
                        className={`car-pill ${selectedVehicle?.id === v.id ? 'active' : ''}`}
                        onClick={() => setSelectedVehicle(v)}
                      >
                        <Car size={14} /> {v.name}
                      </button>
                    ))}
                  </div>

                  {/* Vehicle Time Slots */}
                  {(selectedVehicle ? [selectedVehicle] : vehicles.slice(0, 3)).map(vehicle => (
                    <div key={vehicle.id} className="vehicle-schedule">
                      <div className="schedule-header">
                        <Car size={18} />
                        <div className="schedule-info">
                          <span className="schedule-name">{vehicle.name}</span>
                          <span className="schedule-reg">{vehicle.registration}</span>
                        </div>
                        <div className="view-toggle">
                          {['Day', 'Week', 'Month'].map(v => (
                            <button 
                              key={v}
                              className={viewMode === v.toLowerCase() ? 'active' : ''}
                              onClick={() => setViewMode(v.toLowerCase())}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Date Navigation */}
                      <div className="date-nav">
                        <button onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() - 1)))}>
                          <ChevronLeft size={18} />
                        </button>
                        <span><Calendar size={14} /> {formatDate(selectedDate)}</span>
                        <button onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() + 1)))}>
                          <ChevronRight size={18} />
                        </button>
                      </div>

                      {/* Time Slots Grid */}
                      <div className="time-slots">
                        {generateTimeSlots().map(slot => {
                          const hour = parseInt(slot.split(':')[0]);
                          const isBooked = isSlotBooked(vehicle.id, hour);
                          return (
                            <button 
                              key={slot}
                              className={`time-slot ${isBooked ? 'booked' : 'free'}`}
                              onClick={() => !isBooked && handleBookSlot(vehicle.id, hour)}
                              disabled={isBooked}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>

                      {/* Legend */}
                      <div className="legend">
                        <span><span className="dot green"></span> Free</span>
                        <span><span className="dot red"></span> Booked</span>
                        <span><span className="dot purple"></span> Recurring</span>
                        <button className="book-btn-small" onClick={() => {
                          setBookingForm({...bookingForm, car_id: vehicle.id});
                          setShowBookingForm(true);
                        }}>Book</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* My Bookings List */}
            {bookingView === 'my' && myBookings.length > 0 && (
              <div className="my-bookings-list">
                {myBookings.map(b => (
                  <div key={b.id} className="booking-card">
                    <div className="booking-card-header">
                      <strong>{getVehicleName(b.car_id)}</strong>
                      <span className={`status-badge ${b.status}`}>{b.status}</span>
                    </div>
                    <p>{formatDate(new Date(b.start_time))} | {formatTime(b.start_time)} - {formatTime(b.end_time)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BOOKING FORM */}
        {activeTab === 'bookings' && showBookingForm && (
          <div className="tab-page booking-form-page">
            <h1 className="page-title">Create New Booking</h1>

            <form onSubmit={handleSubmitBooking} className="booking-form">
              <div className="form-group">
                <label>Select Car *</label>
                <select 
                  value={bookingForm.car_id}
                  onChange={e => setBookingForm({...bookingForm, car_id: e.target.value})}
                  required
                >
                  <option value="">Choose a car</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.registration})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Booked By</label>
                <input type="text" value={user?.name || ''} disabled className="disabled" />
                <span className="help">Auto-filled from your account</span>
              </div>

              <div className="form-group">
                <label>Start Time *</label>
                <input 
                  type="datetime-local" 
                  value={bookingForm.start_time?.replace(':00Z', '').replace('Z', '')} 
                  onChange={e => setBookingForm({...bookingForm, start_time: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>End Time *</label>
                <input 
                  type="datetime-local" 
                  value={bookingForm.end_time?.replace(':00Z', '').replace('Z', '')} 
                  onChange={e => setBookingForm({...bookingForm, end_time: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Starting Eircode <span className="required">*</span></label>
                <input 
                  type="text" 
                  value={bookingForm.start_eircode}
                  onChange={e => setBookingForm({...bookingForm, start_eircode: e.target.value})}
                  placeholder="e.g. V92 H6TP"
                />
                <span className="help">Where the journey starts</span>
              </div>

              <div className="form-group">
                <label>Destination Eircode <span className="required">*</span></label>
                <input 
                  type="text" 
                  value={bookingForm.end_eircode}
                  onChange={e => setBookingForm({...bookingForm, end_eircode: e.target.value})}
                  placeholder="e.g. V23 KV29"
                />
                <span className="help">Where the journey ends</span>
              </div>

              <div className="form-group">
                <label>Purpose / Notes</label>
                <input 
                  type="text" 
                  value={bookingForm.purpose}
                  onChange={e => setBookingForm({...bookingForm, purpose: e.target.value})}
                  placeholder="e.g. Client visit, Home care, etc."
                />
              </div>

              <div className="checkbox-highlight">
                <label>
                  <input 
                    type="checkbox" 
                    checked={bookingForm.is_double_up_call}
                    onChange={e => setBookingForm({...bookingForm, is_double_up_call: e.target.checked})}
                  />
                  <Users size={16} /> Double up call?
                </label>
                <span className="hint">(Check if this is a shared/double up visit)</span>
              </div>

              <div className="checkbox-group">
                <label>
                  <input 
                    type="checkbox" 
                    checked={bookingForm.is_recurring}
                    onChange={e => setBookingForm({...bookingForm, is_recurring: e.target.checked})}
                  />
                  <RefreshCw size={16} /> Make this a recurring booking
                </label>
              </div>

              <div className="form-actions">
                <button type="submit" className="submit-btn" disabled={isSubmittingBooking}>
                  {isSubmittingBooking ? 'Creating...' : 'Create Booking'}
                </button>
                <button type="button" className="cancel-btn" onClick={() => setShowBookingForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* REQUEST LIFT TAB */}
        {activeTab === 'lift' && (
          <div className="tab-page">
            {liftSuccess ? (
              <div className="success-screen">
                <CheckCircle size={64} />
                <h2>Request Sent!</h2>
                <p>Staff members have been notified</p>
              </div>
            ) : (
              <>
                <h1 className="page-title">Request a Lift</h1>
                <p className="page-subtitle">Ask a colleague for a ride</p>

                <form onSubmit={handleSubmitLiftRequest} className="lift-form">
                  <div className="form-group">
                    <label><User size={14} /> Your Name</label>
                    <input 
                      type="text" 
                      value={liftForm.name}
                      onChange={e => setLiftForm({...liftForm, name: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label><Phone size={14} /> Phone Number *</label>
                    <input 
                      type="tel" 
                      value={liftForm.phone}
                      onChange={e => setLiftForm({...liftForm, phone: e.target.value})}
                      placeholder="Your number"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label><MapPin size={14} className="green" /> Where are you? *</label>
                    <input 
                      type="text" 
                      value={liftForm.from_location}
                      onChange={e => setLiftForm({...liftForm, from_location: e.target.value})}
                      placeholder="Current location"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label><MapPin size={14} className="red" /> Where to? *</label>
                    <input 
                      type="text" 
                      value={liftForm.to_location}
                      onChange={e => setLiftForm({...liftForm, to_location: e.target.value})}
                      placeholder="Destination"
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label><Calendar size={14} /> Date *</label>
                      <input 
                        type="date" 
                        value={liftForm.date}
                        onChange={e => setLiftForm({...liftForm, date: e.target.value})}
                        min={today}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label><Clock size={14} /> Time *</label>
                      <input 
                        type="time" 
                        value={liftForm.time}
                        onChange={e => setLiftForm({...liftForm, time: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" className="submit-btn" disabled={isSubmittingLift}>
                    {isSubmittingLift ? 'Sending...' : <><Send size={18} /> Send Request</>}
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button onClick={() => setActiveTab('home')} className={activeTab === 'home' ? 'active' : ''}>
          <span className="nav-icon">88</span>
          <span>Home</span>
        </button>
        <button onClick={() => { setActiveTab('bookings'); setShowBookingForm(false); }} className={activeTab === 'bookings' ? 'active' : ''}>
          <Calendar size={22} />
          <span>Bookings</span>
        </button>
        <button onClick={() => setActiveTab('lift')} className={activeTab === 'lift' ? 'active' : ''}>
          <Navigation size={22} />
          <span>Lift</span>
        </button>
      </nav>

      <style>{styles}</style>
    </div>
  );
};

const styles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  .staff-app {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: #f5f5f5;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
  }
  
  .loading-screen {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #2563eb;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { animation: spin 1s linear infinite; }
  
  /* Header */
  .app-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    padding-top: max(12px, env(safe-area-inset-top));
    background: white;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .logo {
    font-size: 20px;
    font-weight: 700;
    color: #2563eb;
  }
  
  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    color: #6b7280;
  }
  
  .user-name {
    font-size: 14px;
    color: #374151;
  }
  
  .logout-btn {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 4px;
  }
  
  /* Content */
  .app-content {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  .tab-page {
    padding: 16px;
    padding-bottom: 100px;
  }
  
  .page-title {
    font-size: 24px;
    font-weight: 700;
    color: #111827;
    margin-bottom: 4px;
  }
  
  .page-subtitle {
    font-size: 13px;
    color: #6b7280;
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 16px;
  }
  
  /* Stats Row */
  .stats-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
  }
  
  .stat-card {
    padding: 16px;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
  }
  
  .stat-card.blue { background: #dbeafe; }
  .stat-card.green { background: #dcfce7; }
  
  .stat-label {
    font-size: 13px;
    color: #374151;
    margin-bottom: 4px;
  }
  
  .stat-value {
    font-size: 28px;
    font-weight: 700;
    color: #111827;
  }
  
  /* Refresh Button */
  .refresh-btn-full {
    width: 100%;
    padding: 14px;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 20px;
    cursor: pointer;
  }
  
  .refresh-btn-full:disabled { opacity: 0.7; }
  
  /* Section Header */
  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 15px;
    font-weight: 600;
    color: #111827;
  }
  
  .live-dot {
    width: 10px;
    height: 10px;
    background: #22c55e;
    border-radius: 50%;
  }
  
  .update-text {
    font-size: 12px;
    font-weight: 400;
    color: #9ca3af;
  }
  
  /* Vehicle Grid */
  .vehicle-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  
  .vehicle-card {
    background: white;
    border-radius: 12px;
    padding: 12px;
    border: 1px solid #e5e7eb;
  }
  
  .vehicle-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  
  .vehicle-name {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 80%;
  }
  
  .status-toggle {
    width: 32px;
    height: 18px;
    border-radius: 9px;
    position: relative;
  }
  
  .status-toggle::after {
    content: '';
    position: absolute;
    width: 14px;
    height: 14px;
    background: white;
    border-radius: 50%;
    top: 2px;
    transition: left 0.2s;
  }
  
  .status-toggle.available { background: #22c55e; }
  .status-toggle.available::after { left: 16px; }
  .status-toggle.in-use { background: #ef4444; }
  .status-toggle.in-use::after { left: 2px; }
  .status-toggle.blocked { background: #9ca3af; }
  .status-toggle.blocked::after { left: 2px; }
  
  .vehicle-reg {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 4px;
  }
  
  .vehicle-location {
    font-size: 12px;
    color: #ef4444;
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 2px;
  }
  
  .vehicle-time {
    font-size: 12px;
    color: #6b7280;
  }
  
  .vehicle-available {
    font-size: 12px;
    color: #22c55e;
    font-weight: 500;
  }
  
  /* Bookings Tab */
  .new-booking-btn {
    width: 100%;
    padding: 12px;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 16px;
    cursor: pointer;
  }
  
  .booking-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }
  
  .tab-btn {
    flex: 1;
    padding: 10px;
    background: white;
    border: 2px solid #e5e7eb;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 500;
    color: #2563eb;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
  }
  
  .tab-btn.active {
    background: #2563eb;
    border-color: #2563eb;
    color: white;
  }
  
  .badge {
    background: #e5e7eb;
    color: #374151;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
  }
  
  .tab-btn.active .badge {
    background: rgba(255,255,255,0.3);
    color: white;
  }
  
  /* Available Section */
  .available-section {
    background: #fef9c3;
    border-radius: 12px;
    margin-bottom: 16px;
    overflow: hidden;
  }
  
  .available-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 15px;
    font-weight: 600;
    color: #92400e;
  }
  
  .car-count {
    background: #fcd34d;
    color: #92400e;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 13px;
  }
  
  .available-header svg {
    transition: transform 0.2s;
    color: #f59e0b;
  }
  
  .available-header svg.rotated {
    transform: rotate(90deg);
  }
  
  .available-content {
    padding: 0 16px 16px;
  }
  
  .help-text {
    font-size: 13px;
    color: #b45309;
    margin-bottom: 12px;
  }
  
  /* Car Pills */
  .car-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }
  
  .car-pill {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 20px;
    font-size: 13px;
    color: #374151;
    cursor: pointer;
  }
  
  .car-pill.active {
    background: #fef08a;
    border-color: #fcd34d;
    color: #2563eb;
    font-weight: 600;
  }
  
  /* Vehicle Schedule */
  .vehicle-schedule {
    background: #fef9c3;
    border: 2px solid #fcd34d;
    border-radius: 12px;
    padding: 12px;
    margin-bottom: 12px;
  }
  
  .schedule-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    color: #b45309;
  }
  
  .schedule-info {
    flex: 1;
  }
  
  .schedule-name {
    font-weight: 600;
    color: #111827;
    display: block;
  }
  
  .schedule-reg {
    font-size: 12px;
    color: #6b7280;
  }
  
  .view-toggle {
    display: flex;
    background: white;
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
  }
  
  .view-toggle button {
    padding: 6px 12px;
    background: transparent;
    border: none;
    font-size: 12px;
    font-weight: 500;
    color: #6b7280;
    cursor: pointer;
  }
  
  .view-toggle button.active {
    background: #fcd34d;
    color: #92400e;
  }
  
  .date-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  
  .date-nav button {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 4px;
  }
  
  .date-nav span {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    color: #374151;
  }
  
  /* Time Slots */
  .time-slots {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-bottom: 12px;
  }
  
  .time-slot {
    padding: 10px 4px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: white;
    font-size: 13px;
    color: #374151;
    cursor: pointer;
  }
  
  .time-slot.free:hover {
    background: #dcfce7;
    border-color: #22c55e;
  }
  
  .time-slot.booked {
    background: #fee2e2;
    color: #dc2626;
    cursor: not-allowed;
  }
  
  /* Legend */
  .legend {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
    color: #6b7280;
  }
  
  .legend span {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  
  .dot.green { background: #22c55e; }
  .dot.red { background: #ef4444; }
  .dot.purple { background: #a855f7; }
  
  .book-btn-small {
    margin-left: auto;
    padding: 6px 16px;
    background: #fcd34d;
    border: none;
    border-radius: 6px;
    color: #92400e;
    font-weight: 600;
    cursor: pointer;
  }
  
  /* My Bookings List */
  .my-bookings-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .booking-card {
    background: white;
    border-radius: 12px;
    padding: 12px;
    border: 1px solid #e5e7eb;
  }
  
  .booking-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }
  
  .status-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 10px;
    text-transform: capitalize;
  }
  
  .status-badge.approved, .status-badge.confirmed { background: #dcfce7; color: #16a34a; }
  .status-badge.pending { background: #fef3c7; color: #d97706; }
  .status-badge.rejected { background: #fee2e2; color: #dc2626; }
  
  .booking-card p {
    font-size: 13px;
    color: #6b7280;
  }
  
  /* Booking Form */
  .booking-form-page {
    background: #f3f4f6;
  }
  
  .booking-form, .lift-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .form-group label {
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .form-group label .green { color: #16a34a; }
  .form-group label .red { color: #dc2626; }
  .required { color: #dc2626; }
  
  .form-group input, .form-group select {
    padding: 14px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 16px;
    background: white;
  }
  
  .form-group input.disabled {
    background: #f3f4f6;
    color: #6b7280;
  }
  
  .form-group .help {
    font-size: 12px;
    color: #9ca3af;
  }
  
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  
  .checkbox-highlight {
    background: #fef9c3;
    border: 1px solid #fcd34d;
    border-radius: 8px;
    padding: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .checkbox-highlight label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    color: #92400e;
  }
  
  .checkbox-highlight .hint {
    font-size: 12px;
    color: #b45309;
  }
  
  .checkbox-group {
    display: flex;
    align-items: center;
  }
  
  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #374151;
  }
  
  .form-actions {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }
  
  .submit-btn {
    flex: 1;
    padding: 16px;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
  }
  
  .submit-btn:disabled { opacity: 0.7; }
  
  .cancel-btn {
    flex: 1;
    padding: 16px;
    background: white;
    color: #374151;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
  }
  
  /* Success Screen */
  .success-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 60px 20px;
    color: #16a34a;
  }
  
  .success-screen h2 {
    margin: 16px 0 8px;
    color: #111827;
  }
  
  .success-screen p {
    color: #6b7280;
  }
  
  /* Bottom Nav */
  .bottom-nav {
    flex-shrink: 0;
    display: flex;
    background: white;
    border-top: 1px solid #e5e7eb;
    padding: 8px 0;
    padding-bottom: max(8px, env(safe-area-inset-bottom));
  }
  
  .bottom-nav button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: none;
    border: none;
    padding: 8px;
    color: #9ca3af;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
  }
  
  .bottom-nav button.active {
    color: #2563eb;
  }
  
  .nav-icon {
    font-size: 20px;
    font-weight: 700;
  }
`;

export default StaffMobileView;
