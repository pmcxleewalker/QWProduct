import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Car, Calendar, Clock, MapPin, User, Phone,
  RefreshCw, X, ChevronRight, ChevronLeft, Send, CheckCircle,
  LogOut, Navigation, Plus, Users, Home, FileText, Lock, Unlock
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { liftRequestAPI } from '../api/api';
import CustomDocumentsStaff from './CustomDocumentsStaff';
import DriverLicenceCard from './DriverLicenceCard';
import Greeting from './Greeting';
import PushNotificationPrompt from './PushNotificationPrompt';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const dateKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatTime = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
};

const formatDayLabel = (d) =>
  d.toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' });

/* ---- Month calendar of the staff member's own bookings ---- */
const MyBookingsCalendar = ({ myBookings, selectedDay, onSelectDay }) => {
  const [viewMonth, setViewMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const bookingDays = useMemo(() => {
    const set = new Set();
    myBookings.forEach(b => {
      if (b.start_time) set.add(b.start_time.split('T')[0]);
    });
    return set;
  }, [myBookings]);

  const cells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday start
    const arr = [];
    for (let i = 0; i < startOffset; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(year, month, d));
    return arr;
  }, [viewMonth]);

  const todayKey = dateKey(new Date());
  const selectedKey = selectedDay ? dateKey(selectedDay) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4" data-testid="my-bookings-calendar">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
          className="p-2 rounded-lg border border-slate-200 text-slate-600 active:bg-slate-100"
          data-testid="calendar-prev-month"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-bold text-slate-800" data-testid="calendar-month-label">
          {viewMonth.toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
          className="p-2 rounded-lg border border-slate-200 text-slate-600 active:bg-slate-100"
          data-testid="calendar-next-month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
          <div key={d} className="text-center text-[11px] font-semibold text-slate-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`e-${i}`} />;
          const k = dateKey(d);
          const hasBooking = bookingDays.has(k);
          const isSelected = k === selectedKey;
          const isToday = k === todayKey;
          return (
            <button
              key={k}
              onClick={() => onSelectDay(d)}
              data-testid={`calendar-day-${k}`}
              className={`relative mx-auto flex flex-col items-center justify-center w-9 h-9 rounded-full text-sm transition-colors
                ${isSelected ? 'bg-blue-600 text-white font-bold' :
                  isToday ? 'border border-blue-500 text-blue-700 font-semibold' :
                  'text-slate-700 active:bg-slate-100'}`}
            >
              {d.getDate()}
              {hasBooking && (
                <span
                  className={`absolute bottom-0.5 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`}
                  data-testid={`calendar-dot-${k}`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const StaffMobileView = ({ tenantSlug }) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [profile, setProfile] = useState(user || null);
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [myBookings, setMyBookings] = useState([]);

  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState(new Date());
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
  const [screenLocked, setScreenLocked] = useState(() => {
    return localStorage.getItem('staff_screen_locked') !== '0';
  });

  // Lock viewport for mobile app experience. When unlocked, pinch-to-zoom
  // is allowed so staff can zoom in on small screens.
  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute(
        'content',
        screenLocked
          ? 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
          : 'width=device-width, initial-scale=1, viewport-fit=cover'
      );
    }
    localStorage.setItem('staff_screen_locked', screenLocked ? '1' : '0');
  }, [screenLocked]);

  // Prevent page-level scroll bleed while the staff app is mounted.
  useEffect(() => {
    const originalStyle = document.body.style.cssText;
    document.body.style.cssText = 'overflow: hidden; position: fixed; width: 100%; height: 100%; margin: 0; padding: 0; overscroll-behavior: none;';
    document.documentElement.style.cssText = 'overflow: hidden; height: 100%; overscroll-behavior: none;';
    return () => {
      document.body.style.cssText = originalStyle;
      document.documentElement.style.cssText = '';
    };
  }, []);

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

  const refreshProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.user) setProfile(res.data.user);
    } catch (err) {
      // Non-fatal
    }
  }, []);

  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  useEffect(() => {
    if (user?.name) {
      setLiftForm(prev => ({ ...prev, name: user.name }));
      setBookingForm(prev => ({ ...prev, user_name: user.name }));
    }
  }, [user]);

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

  const getVehicleName = (carId) => {
    const vehicle = vehicles.find(v => v.id === carId);
    return vehicle?.name || 'Vehicle';
  };

  const getVehicleReg = (carId) => {
    const vehicle = vehicles.find(v => v.id === carId);
    return vehicle?.registration || '';
  };

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

  const selectedDayKey = dateKey(selectedDay);
  const selectedDayBookings = myBookings
    .filter(b => b.start_time?.split('T')[0] === selectedDayKey)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  const inputCls = 'w-full px-4 py-3 border border-slate-300 rounded-lg text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
  const labelCls = 'flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5';

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-gray-50" data-testid="staff-mobile-loading" style={{ height: '100dvh' }}>
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex flex-col bg-gray-50 w-full mx-auto"
      style={{ height: '100dvh', maxWidth: '640px', left: '50%', transform: 'translateX(-50%)', overscrollBehavior: 'none' }}
      data-testid="staff-mobile-view"
    >
      <PushNotificationPrompt user={profile || user} />

      {/* Header — admin-style gradient */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 text-white shadow-md"
        style={{
          paddingTop: 'max(10px, env(safe-area-inset-top))',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%)'
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <Car size={16} className="text-white" />
          </div>
          <span className="text-base font-bold tracking-tight truncate">Quick Wing</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[11px] font-semibold bg-white/15 backdrop-blur-sm px-2.5 py-1 rounded-full" data-testid="staff-user-badge">
            {user?.name?.split(' ')[0] || 'Staff'}
          </span>
          <button
            onClick={() => {
              const next = !screenLocked;
              setScreenLocked(next);
              toast.success(next ? 'Screen locked' : 'Zoom unlocked');
            }}
            className="p-1.5 rounded-lg bg-white/10 active:bg-white/25 text-white"
            data-testid="screen-lock-btn"
            title={screenLocked ? 'Unlock zoom' : 'Lock screen'}
          >
            {screenLocked ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
          <button onClick={logout} className="p-1.5 rounded-lg bg-white/10 active:bg-white/25 text-white" data-testid="logout-btn">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div className="p-4 pb-28" data-testid="home-tab">
            <div className="flex items-start justify-between mb-4">
              <Greeting
                user={profile || user}
                className="text-xl font-bold text-slate-900"
                subtitleClassName="text-sm text-slate-500"
                testid="staff-greeting"
              />
              <p className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                <Clock size={14} />
                {new Date().toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Car size={22} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 leading-none" data-testid="stat-available">{availableVehicles.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Available</p>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Car size={22} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 leading-none" data-testid="stat-in-use">{inUseVehicles.length}</p>
                  <p className="text-xs text-slate-500 mt-1">In Use</p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <DriverLicenceCard user={profile} onUpdated={refreshProfile} />
            </div>

            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl active:bg-blue-700 disabled:opacity-60 mb-5 shadow-sm"
              data-testid="refresh-btn"
            >
              <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>

            {/* Live Fleet Status */}
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
              <h2 className="text-base font-semibold text-slate-900">Live Fleet Status</h2>
              <span className="ml-auto text-[11px] text-slate-400">Auto-updates every 15s</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {vehicles.map(vehicle => {
                const status = getVehicleStatus(vehicle);
                const currentBooking = bookings.find(b =>
                  b.car_id === vehicle.id &&
                  new Date(b.start_time) <= new Date() &&
                  new Date(b.end_time) >= new Date()
                );
                const borderCls = status === 'available' ? 'border-l-emerald-500' : status === 'in-use' ? 'border-l-rose-500' : 'border-l-slate-400';
                return (
                  <div
                    key={vehicle.id}
                    className={`bg-white border border-slate-200 border-l-4 ${borderCls} rounded-xl shadow-sm p-3.5`}
                    data-testid={`vehicle-card-${vehicle.id}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-900 truncate">{vehicle.name}</span>
                      <span className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${status === 'available' ? 'bg-emerald-500' : status === 'in-use' ? 'bg-rose-500' : 'bg-slate-400'}`} />
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{vehicle.registration}</p>
                    {currentBooking ? (
                      <div className="pt-2 border-t border-slate-100 space-y-0.5">
                        <p className="flex items-center gap-1 text-xs text-rose-600 font-medium truncate">
                          <User size={11} className="flex-shrink-0" />{currentBooking.user_name}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock size={11} className="flex-shrink-0" />Until {formatTime(currentBooking.end_time)}
                        </p>
                      </div>
                    ) : status === 'blocked' ? (
                      <p className="text-xs font-medium text-slate-400 pt-1.5">Blocked</p>
                    ) : (
                      <p className="text-xs font-medium text-emerald-600 pt-1.5">Available Now</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* BOOKINGS TAB */}
        {activeTab === 'bookings' && !showBookingForm && (
          <div className="p-4 pb-28" data-testid="bookings-tab">
            <div className="mb-4">
              <h1 className="text-xl font-bold text-slate-900">My Bookings</h1>
              <p className="text-sm text-slate-500">Bookings made by you or your admin</p>
            </div>

            <button
              onClick={() => setShowBookingForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-blue-600 text-white text-sm font-semibold rounded-xl active:bg-blue-700 shadow-sm mb-4"
              data-testid="new-booking-btn"
            >
              <Plus size={18} />
              New Booking
            </button>

            {/* Month calendar of my bookings */}
            <MyBookingsCalendar
              myBookings={myBookings}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />

            {/* Selected day bookings */}
            <div className="mt-4" data-testid="selected-day-bookings">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">{formatDayLabel(selectedDay)}</h3>
              {selectedDayBookings.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-400" data-testid="no-bookings-day">
                  No bookings on this day
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectedDayBookings.map(b => (
                    <div
                      key={b.id}
                      className="bg-white border border-slate-200 border-l-4 border-l-blue-500 rounded-xl shadow-sm p-3.5"
                      data-testid={`my-booking-${b.id}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {getVehicleName(b.car_id)}
                        </span>
                        <span className={`flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                          (b.status === 'approved' || b.status === 'confirmed') ? 'bg-emerald-50 text-emerald-700' :
                          b.status === 'rejected' ? 'bg-rose-50 text-rose-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {b.status || 'Pending'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-1.5">{getVehicleReg(b.car_id)}</p>
                      <p className="flex items-center gap-1.5 text-sm text-slate-600">
                        <Clock size={13} className="text-blue-500" />
                        {formatTime(b.start_time)} – {formatTime(b.end_time)}
                      </p>
                      {b.purpose && (
                        <p className="text-xs text-slate-500 mt-1 truncate">{b.purpose}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* BOOKING FORM */}
        {activeTab === 'bookings' && showBookingForm && (
          <div className="p-4 pb-28 bg-white min-h-full" data-testid="booking-form">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-slate-900">New Booking</h1>
              <button
                className="p-2 rounded-lg text-slate-500 active:bg-slate-100"
                onClick={() => setShowBookingForm(false)}
                data-testid="close-booking-form"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSubmitBooking} className="space-y-4">
              <div>
                <label className={labelCls}>Select Car *</label>
                <select
                  value={bookingForm.car_id}
                  onChange={e => setBookingForm({ ...bookingForm, car_id: e.target.value })}
                  required
                  className={inputCls}
                  data-testid="car-select"
                >
                  <option value="">Choose a car...</option>
                  {vehicles.filter(v => !v.is_blocked).map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.registration})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Booked By</label>
                <input type="text" value={user?.name || ''} disabled className={`${inputCls} bg-slate-100 text-slate-500`} />
                <span className="text-xs text-slate-400 mt-1 block">Auto-filled from your account</span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className={labelCls}>Start Time *</label>
                  <input
                    type="datetime-local"
                    value={bookingForm.start_time?.replace(':00Z', '').replace('Z', '')}
                    onChange={e => setBookingForm({ ...bookingForm, start_time: e.target.value })}
                    required
                    className={inputCls}
                    data-testid="start-time"
                  />
                </div>
                <div>
                  <label className={labelCls}>End Time *</label>
                  <input
                    type="datetime-local"
                    value={bookingForm.end_time?.replace(':00Z', '').replace('Z', '')}
                    onChange={e => setBookingForm({ ...bookingForm, end_time: e.target.value })}
                    required
                    className={inputCls}
                    data-testid="end-time"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Start Eircode</label>
                  <input
                    type="text"
                    value={bookingForm.start_eircode}
                    onChange={e => setBookingForm({ ...bookingForm, start_eircode: e.target.value })}
                    placeholder="e.g. V92 H6TP"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>End Eircode</label>
                  <input
                    type="text"
                    value={bookingForm.end_eircode}
                    onChange={e => setBookingForm({ ...bookingForm, end_eircode: e.target.value })}
                    placeholder="e.g. V23 KV29"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Purpose / Notes</label>
                <input
                  type="text"
                  value={bookingForm.purpose}
                  onChange={e => setBookingForm({ ...bookingForm, purpose: e.target.value })}
                  placeholder="e.g. Client visit"
                  className={inputCls}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
                <label className="flex items-center gap-2.5 text-sm font-medium text-blue-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bookingForm.is_double_up_call}
                    onChange={e => setBookingForm({ ...bookingForm, is_double_up_call: e.target.checked })}
                    className="w-4.5 h-4.5 accent-blue-600"
                    style={{ width: 18, height: 18 }}
                  />
                  <Users size={17} />
                  Double up call?
                </label>
                <span className="block text-xs text-blue-700 mt-1 ml-8">Check if this is a shared visit</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3.5">
                <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bookingForm.is_recurring}
                    onChange={e => setBookingForm({ ...bookingForm, is_recurring: e.target.checked })}
                    style={{ width: 18, height: 18 }}
                    className="accent-blue-600"
                  />
                  <RefreshCw size={17} />
                  Make recurring
                </label>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={isSubmittingBooking}
                  className="flex-1 px-4 py-3.5 bg-blue-600 text-white text-sm font-semibold rounded-xl active:bg-blue-700 disabled:opacity-60 shadow-sm"
                  data-testid="submit-booking"
                >
                  {isSubmittingBooking ? 'Creating...' : 'Create Booking'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBookingForm(false)}
                  className="flex-1 px-4 py-3.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-xl active:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* LIFT TAB */}
        {activeTab === 'lift' && (
          <div className="p-4 pb-28" data-testid="lift-tab">
            {liftSuccess ? (
              <div className="flex flex-col items-center justify-center text-center py-20 text-emerald-500">
                <CheckCircle size={64} />
                <h2 className="mt-5 mb-2 text-xl font-bold text-slate-900">Request Sent!</h2>
                <p className="text-slate-500">Staff members have been notified</p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <h1 className="text-xl font-bold text-slate-900">Request a Lift</h1>
                  <p className="text-sm text-slate-500">Ask a colleague for a ride</p>
                </div>

                <form onSubmit={handleSubmitLiftRequest} className="space-y-4">
                  <div>
                    <label className={labelCls}><User size={14} /> Your Name</label>
                    <input
                      type="text"
                      value={liftForm.name}
                      onChange={e => setLiftForm({ ...liftForm, name: e.target.value })}
                      required
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}><Phone size={14} /> Phone Number *</label>
                    <input
                      type="tel"
                      value={liftForm.phone}
                      onChange={e => setLiftForm({ ...liftForm, phone: e.target.value })}
                      placeholder="Your contact number"
                      required
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}><MapPin size={14} className="text-emerald-500" /> Where are you? *</label>
                    <input
                      type="text"
                      value={liftForm.from_location}
                      onChange={e => setLiftForm({ ...liftForm, from_location: e.target.value })}
                      placeholder="Current location"
                      required
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}><MapPin size={14} className="text-rose-500" /> Where to? *</label>
                    <input
                      type="text"
                      value={liftForm.to_location}
                      onChange={e => setLiftForm({ ...liftForm, to_location: e.target.value })}
                      placeholder="Destination"
                      required
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}><Calendar size={14} /> Date *</label>
                      <input
                        type="date"
                        value={liftForm.date}
                        onChange={e => setLiftForm({ ...liftForm, date: e.target.value })}
                        min={today}
                        required
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}><Clock size={14} /> Time *</label>
                      <input
                        type="time"
                        value={liftForm.time}
                        onChange={e => setLiftForm({ ...liftForm, time: e.target.value })}
                        required
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmittingLift}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-blue-600 text-white text-sm font-semibold rounded-xl active:bg-blue-700 disabled:opacity-60 shadow-sm"
                    data-testid="submit-lift"
                  >
                    {isSubmittingLift ? 'Sending...' : <><Send size={17} /> Send Request</>}
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div className="p-4 pb-28" data-testid="documents-tab">
            <div className="mb-4">
              <h1 className="text-xl font-bold text-slate-900">Documents</h1>
              <p className="text-sm text-slate-500">Submit inspections, checks and reports</p>
            </div>
            <CustomDocumentsStaff />
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav
        className="flex-shrink-0 flex bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))', paddingTop: 6 }}
        data-testid="bottom-nav"
      >
        {[
          { key: 'home', icon: Home, label: 'Home', testid: 'nav-home' },
          { key: 'bookings', icon: Calendar, label: 'Bookings', testid: 'nav-bookings' },
          { key: 'documents', icon: FileText, label: 'Docs', testid: 'nav-documents' },
          { key: 'lift', icon: Navigation, label: 'Lift', testid: 'nav-lift' }
        ].map(({ key, icon: Icon, label, testid }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => { setActiveTab(key); if (key === 'bookings') setShowBookingForm(false); }}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors ${active ? 'text-blue-600' : 'text-slate-400'}`}
              data-testid={testid}
            >
              {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-b" />}
              <Icon size={22} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default StaffMobileView;
