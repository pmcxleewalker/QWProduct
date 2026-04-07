import React, { useState, useEffect, useCallback } from 'react';
import { 
  Car, Calendar, Clock, MapPin, User, Phone,
  RefreshCw, X, ChevronRight, Send, CheckCircle,
  AlertCircle, Navigation, Plus, ChevronLeft
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { liftRequestAPI } from '../api/api';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StaffMobileView = ({ tenantSlug }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('status');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  
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

  // Lock the viewport and body for mobile app mode
  useEffect(() => {
    // Set viewport
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
    }
    
    // Lock body
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
      
      // Filter bookings for current user
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
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (user?.name) setLiftForm(prev => ({ ...prev, name: user.name }));
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' });
  };

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
      await axios.post(`${API}/bookings`, {
        car_id: selectedVehicle.id,
        start_time: `${bookingForm.date}T${bookingForm.startTime}:00`,
        end_time: `${bookingForm.date}T${bookingForm.endTime}:00`,
        purpose: bookingForm.purpose,
        user_name: user?.name || 'Staff',
        status: 'pending'
      }, { headers: { Authorization: `Bearer ${token}` } });

      toast.success('Booking submitted!');
      setShowBookingForm(false);
      setSelectedVehicle(null);
      setBookingForm({ date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '17:00', purpose: '' });
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

  // Calculations
  const today = new Date().toISOString().split('T')[0];
  const todaysBookings = myBookings.filter(b => (b.start_time?.split('T')[0] === today) || (b.date === today));
  const upcomingBookings = myBookings
    .filter(b => new Date(b.start_time || b.date) >= new Date())
    .sort((a, b) => new Date(a.start_time || a.date) - new Date(b.start_time || b.date))
    .slice(0, 10);
  const availableVehicles = vehicles.filter(v => getVehicleStatus(v) === 'available');

  const getBookingsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return myBookings.filter(b => (b.start_time?.split('T')[0] === dateStr) || (b.date === dateStr));
  };

  const generateCalendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  };

  if (loading) {
    return (
      <div className="staff-app">
        <div className="staff-app-loading">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="staff-app" data-testid="staff-mobile-view">
      {/* Fixed Header */}
      <header className="staff-header">
        <div className="header-content">
          <img src="/quick-wing-logo.png" alt="Quick Wing" className="header-logo" onError={(e) => e.target.style.display = 'none'} />
          <div className="header-text">
            <h1>Quick Wing</h1>
            <p>Hi, {user?.name || 'Staff'}</p>
          </div>
          <button onClick={() => fetchData(true)} disabled={refreshing} className="refresh-btn">
            <RefreshCw size={20} className={refreshing ? 'spin' : ''} />
          </button>
        </div>
      </header>

      {/* Scrollable Content Area */}
      <main className="staff-content">
        {/* TAB 1: Live Status */}
        {activeTab === 'status' && (
          <div className="tab-content">
            {/* Today's Reminder */}
            {todaysBookings.length > 0 && (
              <div className="alert-box">
                <div className="alert-header">
                  <Car size={18} />
                  <span>You have {todaysBookings.length} booking{todaysBookings.length > 1 ? 's' : ''} today</span>
                </div>
                {todaysBookings.map(b => (
                  <div key={b.id} className="alert-item">
                    <strong>{getVehicleName(b.car_id)}</strong>
                    <span>{formatTime(b.start_time)} - {formatTime(b.end_time)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Live Fleet Status */}
            <div className="section-card">
              <div className="section-header">
                <h2><Car size={18} /> Live Fleet Status</h2>
                <span className="live-badge">LIVE</span>
              </div>
              <div className="vehicle-list">
                {vehicles.map(vehicle => {
                  const status = getVehicleStatus(vehicle);
                  const currentBooking = bookings.find(b => 
                    b.car_id === vehicle.id && 
                    new Date(b.start_time) <= new Date() && 
                    new Date(b.end_time) >= new Date()
                  );
                  return (
                    <div key={vehicle.id} className={`vehicle-item vehicle-${status}`}>
                      <div className="vehicle-icon">
                        <Car size={24} />
                      </div>
                      <div className="vehicle-info">
                        <p className="vehicle-name">{vehicle.name}</p>
                        <p className="vehicle-reg">{vehicle.registration}</p>
                        {currentBooking && <p className="vehicle-user">{currentBooking.user_name}</p>}
                      </div>
                      <span className={`status-badge status-${status}`}>
                        {status === 'available' ? 'FREE' : status === 'in-use' ? 'IN USE' : 'BLOCKED'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Bookings */}
        {activeTab === 'bookings' && (
          <div className="tab-content">
            {/* Book a Car */}
            <div className="section-card">
              <div className="section-header purple">
                <h2><Plus size={18} /> Book a Car</h2>
              </div>
              {availableVehicles.length === 0 ? (
                <div className="empty-state">
                  <Car size={32} />
                  <p>No cars available right now</p>
                </div>
              ) : (
                <div className="book-list">
                  {availableVehicles.map(vehicle => (
                    <button key={vehicle.id} onClick={() => { setSelectedVehicle(vehicle); setShowBookingForm(true); }} className="book-item">
                      <div className="book-icon"><Car size={22} /></div>
                      <div className="book-info">
                        <p className="book-name">{vehicle.name}</p>
                        <p className="book-reg">{vehicle.registration}</p>
                      </div>
                      <ChevronRight size={20} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* My Calendar */}
            <div className="section-card">
              <div className="section-header">
                <h2><Calendar size={18} /> My Calendar</h2>
                <div className="calendar-nav">
                  <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}><ChevronLeft size={18} /></button>
                  <span>{calendarMonth.toLocaleDateString('en-IE', { month: 'short', year: 'numeric' })}</span>
                  <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}><ChevronRight size={18} /></button>
                </div>
              </div>
              <div className="calendar-grid">
                {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} className="cal-header">{d}</div>)}
                {generateCalendarDays().map((date, idx) => {
                  if (!date) return <div key={`e-${idx}`} className="cal-day empty"></div>;
                  const isToday = date.toDateString() === new Date().toDateString();
                  const hasBooking = getBookingsForDate(date).length > 0;
                  return (
                    <div key={date.toISOString()} className={`cal-day ${isToday ? 'today' : ''} ${hasBooking ? 'has-booking' : ''}`}>
                      {date.getDate()}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* My Bookings */}
            <div className="section-card">
              <div className="section-header">
                <h2>My Bookings ({myBookings.length})</h2>
              </div>
              {myBookings.length === 0 ? (
                <div className="empty-state small">
                  <p>No bookings yet</p>
                </div>
              ) : (
                <div className="booking-list">
                  {myBookings.sort((a,b) => new Date(b.start_time || b.date) - new Date(a.start_time || a.date)).slice(0, 5).map(b => (
                    <div key={b.id} className="booking-item">
                      <div className="booking-main">
                        <strong>{getVehicleName(b.car_id)}</strong>
                        <span className={`booking-status ${b.status}`}>{b.status}</span>
                      </div>
                      <p>{formatDate(b.start_time)} | {formatTime(b.start_time)} - {formatTime(b.end_time)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Request Lift */}
        {activeTab === 'lift' && (
          <div className="tab-content">
            {liftSuccess ? (
              <div className="success-card">
                <CheckCircle size={48} />
                <h2>Request Sent!</h2>
                <p>Staff members have been notified</p>
              </div>
            ) : (
              <div className="section-card">
                <div className="section-header orange">
                  <h2><Navigation size={18} /> Request a Lift</h2>
                </div>
                <form onSubmit={handleSubmitLiftRequest} className="lift-form">
                  <div className="form-group">
                    <label><User size={14} /> Your Name</label>
                    <input type="text" value={liftForm.name} onChange={e => setLiftForm({...liftForm, name: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label><Phone size={14} /> Phone Number</label>
                    <input type="tel" value={liftForm.phone} onChange={e => setLiftForm({...liftForm, phone: e.target.value})} placeholder="Your number" required />
                  </div>
                  <div className="form-group">
                    <label><MapPin size={14} className="green" /> Where are you?</label>
                    <input type="text" value={liftForm.from_location} onChange={e => setLiftForm({...liftForm, from_location: e.target.value})} placeholder="Current location" required />
                  </div>
                  <div className="form-group">
                    <label><MapPin size={14} className="red" /> Where to?</label>
                    <input type="text" value={liftForm.to_location} onChange={e => setLiftForm({...liftForm, to_location: e.target.value})} placeholder="Destination" required />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label><Calendar size={14} /> Date</label>
                      <input type="date" value={liftForm.date} onChange={e => setLiftForm({...liftForm, date: e.target.value})} min={today} required />
                    </div>
                    <div className="form-group">
                      <label><Clock size={14} /> Time</label>
                      <input type="time" value={liftForm.time} onChange={e => setLiftForm({...liftForm, time: e.target.value})} required />
                    </div>
                  </div>
                  <button type="submit" className="submit-btn" disabled={isSubmittingLift}>
                    {isSubmittingLift ? 'Sending...' : <><Send size={18} /> Send Request</>}
                  </button>
                </form>
                <div className="info-box">
                  <AlertCircle size={16} />
                  <p>Your request will notify all available staff members</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Fixed Bottom Navigation - 3 Tabs */}
      <nav className="staff-nav">
        <button onClick={() => setActiveTab('status')} className={activeTab === 'status' ? 'active' : ''} data-testid="tab-status">
          <Car size={24} />
          <span>Live Status</span>
        </button>
        <button onClick={() => setActiveTab('bookings')} className={activeTab === 'bookings' ? 'active' : ''} data-testid="tab-bookings">
          <Calendar size={24} />
          <span>Bookings</span>
        </button>
        <button onClick={() => setActiveTab('lift')} className={activeTab === 'lift' ? 'active' : ''} data-testid="tab-lift">
          <Navigation size={24} />
          <span>Request Lift</span>
        </button>
      </nav>

      {/* Booking Modal */}
      {showBookingForm && selectedVehicle && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Book {selectedVehicle.name}</h3>
              <button onClick={() => { setShowBookingForm(false); setSelectedVehicle(null); }}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={bookingForm.date} onChange={e => setBookingForm({...bookingForm, date: e.target.value})} min={today} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Start</label>
                  <input type="time" value={bookingForm.startTime} onChange={e => setBookingForm({...bookingForm, startTime: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>End</label>
                  <input type="time" value={bookingForm.endTime} onChange={e => setBookingForm({...bookingForm, endTime: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Purpose</label>
                <input type="text" value={bookingForm.purpose} onChange={e => setBookingForm({...bookingForm, purpose: e.target.value})} placeholder="e.g., Client meeting" />
              </div>
              <button onClick={handleSubmitBooking} className="submit-btn" disabled={isSubmittingBooking || !bookingForm.purpose}>
                {isSubmittingBooking ? 'Submitting...' : 'Request Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
};

const styles = `
  * { box-sizing: border-box; }
  
  .staff-app {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: #f5f5f5;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
    -webkit-overflow-scrolling: touch;
  }
  
  .staff-app-loading {
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
    border: 4px solid #7c3aed;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { animation: spin 1s linear infinite; }
  
  /* Header */
  .staff-header {
    flex-shrink: 0;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: white;
    padding: 48px 16px 16px;
    padding-top: max(48px, env(safe-area-inset-top) + 12px);
  }
  
  .header-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .header-logo {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: rgba(255,255,255,0.1);
    padding: 4px;
    object-fit: contain;
  }
  
  .header-text {
    flex: 1;
  }
  
  .header-text h1 {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
  }
  
  .header-text p {
    font-size: 13px;
    margin: 0;
    opacity: 0.8;
  }
  
  .refresh-btn {
    background: rgba(255,255,255,0.2);
    border: none;
    padding: 10px;
    border-radius: 50%;
    color: white;
    cursor: pointer;
  }
  
  /* Content Area */
  .staff-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    padding: 16px;
    padding-bottom: 100px;
  }
  
  .tab-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  /* Alert Box */
  .alert-box {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 1px solid #f59e0b;
    border-radius: 12px;
    padding: 12px;
  }
  
  .alert-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: #92400e;
    margin-bottom: 8px;
  }
  
  .alert-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
    padding: 8px 12px;
    border-radius: 8px;
    margin-top: 8px;
    font-size: 14px;
  }
  
  /* Section Card */
  .section-card {
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .section-header.purple {
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: white;
  }
  
  .section-header.orange {
    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
    color: white;
  }
  
  .section-header h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    margin: 0;
  }
  
  .live-badge {
    font-size: 10px;
    font-weight: 700;
    background: #22c55e;
    color: white;
    padding: 3px 8px;
    border-radius: 10px;
  }
  
  /* Vehicle List */
  .vehicle-list {
    padding: 8px;
  }
  
  .vehicle-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 12px;
    margin-bottom: 8px;
  }
  
  .vehicle-item:last-child { margin-bottom: 0; }
  
  .vehicle-available { background: #f0fdf4; }
  .vehicle-in-use { background: #fff7ed; }
  .vehicle-blocked { background: #fef2f2; }
  
  .vehicle-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  
  .vehicle-available .vehicle-icon { background: #dcfce7; color: #16a34a; }
  .vehicle-in-use .vehicle-icon { background: #fed7aa; color: #ea580c; }
  .vehicle-blocked .vehicle-icon { background: #fecaca; color: #dc2626; }
  
  .vehicle-info {
    flex: 1;
    min-width: 0;
  }
  
  .vehicle-name {
    font-weight: 600;
    font-size: 15px;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .vehicle-reg {
    font-size: 12px;
    color: #6b7280;
    margin: 2px 0 0;
  }
  
  .vehicle-user {
    font-size: 11px;
    color: #ea580c;
    margin: 2px 0 0;
  }
  
  .status-badge {
    font-size: 11px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 20px;
    flex-shrink: 0;
  }
  
  .status-available { background: #dcfce7; color: #16a34a; }
  .status-in-use { background: #fed7aa; color: #ea580c; }
  .status-blocked { background: #fecaca; color: #dc2626; }
  
  /* Book List */
  .book-list {
    padding: 8px;
  }
  
  .book-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 14px;
    background: #f0fdf4;
    border: none;
    border-radius: 12px;
    margin-bottom: 8px;
    cursor: pointer;
    text-align: left;
  }
  
  .book-item:active { background: #dcfce7; }
  
  .book-icon {
    width: 44px;
    height: 44px;
    background: #dcfce7;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #16a34a;
    flex-shrink: 0;
  }
  
  .book-info { flex: 1; }
  .book-name { font-weight: 600; font-size: 15px; margin: 0; color: #111; }
  .book-reg { font-size: 12px; color: #6b7280; margin: 2px 0 0; }
  
  /* Calendar */
  .calendar-nav {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 500;
  }
  
  .calendar-nav button {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
  }
  
  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    padding: 12px;
  }
  
  .cal-header {
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    color: #9ca3af;
    padding: 4px;
  }
  
  .cal-day {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    border-radius: 8px;
  }
  
  .cal-day.empty { background: transparent; }
  .cal-day.today { background: #7c3aed; color: white; font-weight: 700; }
  .cal-day.has-booking { background: #ede9fe; color: #7c3aed; }
  
  /* Booking List */
  .booking-list {
    padding: 12px;
  }
  
  .booking-item {
    padding: 10px 0;
    border-bottom: 1px solid #f3f4f6;
  }
  
  .booking-item:last-child { border: none; }
  
  .booking-main {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }
  
  .booking-status {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
  }
  
  .booking-status.approved, .booking-status.confirmed { background: #dcfce7; color: #16a34a; }
  .booking-status.pending { background: #fef3c7; color: #d97706; }
  
  .booking-item p {
    font-size: 12px;
    color: #6b7280;
    margin: 0;
  }
  
  /* Lift Form */
  .lift-form {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .form-group label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #374151;
  }
  
  .form-group label .green { color: #16a34a; }
  .form-group label .red { color: #dc2626; }
  
  .form-group input {
    padding: 14px;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    font-size: 16px;
    outline: none;
    transition: border-color 0.2s;
  }
  
  .form-group input:focus {
    border-color: #7c3aed;
  }
  
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  
  .submit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: white;
    border: none;
    padding: 16px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
  }
  
  .submit-btn:disabled {
    opacity: 0.6;
  }
  
  .info-box {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: #ede9fe;
    padding: 12px;
    margin: 0 16px 16px;
    border-radius: 10px;
    color: #6d28d9;
  }
  
  .info-box p {
    font-size: 13px;
    margin: 0;
  }
  
  /* Success Card */
  .success-card {
    background: white;
    border-radius: 16px;
    padding: 48px 24px;
    text-align: center;
    color: #16a34a;
  }
  
  .success-card h2 {
    margin: 16px 0 8px;
    color: #111;
  }
  
  .success-card p {
    margin: 0;
    color: #6b7280;
  }
  
  /* Empty State */
  .empty-state {
    padding: 32px 16px;
    text-align: center;
    color: #9ca3af;
  }
  
  .empty-state.small { padding: 16px; }
  .empty-state p { margin: 8px 0 0; font-size: 14px; }
  
  /* Bottom Nav */
  .staff-nav {
    flex-shrink: 0;
    display: flex;
    background: white;
    border-top: 1px solid #e5e7eb;
    padding: 8px 0;
    padding-bottom: max(8px, env(safe-area-inset-bottom));
  }
  
  .staff-nav button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background: none;
    border: none;
    padding: 8px;
    color: #9ca3af;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.2s;
  }
  
  .staff-nav button.active {
    color: #7c3aed;
  }
  
  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: flex-end;
    z-index: 100;
  }
  
  .modal-content {
    background: white;
    width: 100%;
    max-height: 90vh;
    border-radius: 24px 24px 0 0;
    overflow: hidden;
    animation: slideUp 0.3s ease-out;
  }
  
  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .modal-header h3 {
    font-size: 18px;
    margin: 0;
  }
  
  .modal-header button {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: #6b7280;
  }
  
  .modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
`;

export default StaffMobileView;
