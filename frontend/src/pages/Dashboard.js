import React, { useState, useEffect, useCallback } from 'react';
import { statusAPI, complianceAPI, bookingAPI, carAPI, liftRequestAPI, liftNotificationAPI, bookingNotificationAPI, todoAPI } from '../api/api';
import StatusBadge from '../components/StatusBadge';
import LiftRequestsPanel from '../components/LiftRequestsPanel';
import LiftRequestModal from '../components/LiftRequestModal';
import AcceptLiftModal from '../components/AcceptLiftModal';
import LiftAcceptedNotification from '../components/LiftAcceptedNotification';
import RejectBookingModal from '../components/RejectBookingModal';
import BookingNotificationModal from '../components/BookingNotificationModal';
import { RefreshCw, Clock, AlertTriangle, Check, X, Plus, ListTodo, Edit2, Cloud, Sun, CloudRain, CloudSnow, Wind } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Helper function to get username from email (removes @domain.com)
const getUsername = (email) => {
  if (!email) return '';
  return email.split('@')[0];
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [liveStatus, setLiveStatus] = useState([]);
  const [complianceAlerts, setComplianceAlerts] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [liftRequests, setLiftRequests] = useState([]);
  const [liftNotifications, setLiftNotifications] = useState([]);
  const [bookingNotifications, setBookingNotifications] = useState([]);
  const [todos, setTodos] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showLiftModal, setShowLiftModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedBookingGroup, setSelectedBookingGroup] = useState(null);
  
  // Status Edit Modal State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);
  const [statusForm, setStatusForm] = useState({
    status: '',
    notes: '',
    location: ''
  });

  // Weather State
  const [weather, setWeather] = useState({
    kerry: null,
    westCork: null,
    loading: true
  });

  // Fetch weather data from backend proxy
  const fetchWeather = useCallback(async () => {
    try {
      const response = await statusAPI.getWeather();
      const data = response.data;
      
      setWeather({
        kerry: data.kerry,
        westCork: data.westCork,
        loading: false
      });
    } catch (error) {
      console.error('Error fetching weather:', error);
      setWeather(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // Get weather icon based on weather code
  const getWeatherIcon = (code) => {
    const codeNum = parseInt(code);
    if (codeNum === 113) return <Sun className="text-yellow-500" size={24} />;
    if ([116, 119, 122].includes(codeNum)) return <Cloud className="text-gray-500" size={24} />;
    if ([176, 263, 266, 293, 296, 299, 302, 305, 308, 311, 314, 353, 356, 359].includes(codeNum)) return <CloudRain className="text-blue-500" size={24} />;
    if ([179, 182, 185, 227, 230, 323, 326, 329, 332, 335, 338, 350, 362, 365, 368, 371, 374, 377].includes(codeNum)) return <CloudSnow className="text-blue-300" size={24} />;
    return <Cloud className="text-gray-400" size={24} />;
  };

  const fetchTodos = useCallback(async () => {
    if (user?.role === 'admin') {
      try {
        const response = await todoAPI.getAll();
        setTodos(response.data);
      } catch (error) {
        console.error('Error fetching todos:', error);
      }
    }
  }, [user?.role]);

  const fetchLiveStatus = async () => {
    try {
      setLoading(true);
      const response = await statusAPI.getLive();
      setLiveStatus(response.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching live status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComplianceAlerts = async () => {
    if (user?.role === 'admin') {
      try {
        const response = await complianceAPI.getAlerts();
        setComplianceAlerts(response.data);
      } catch (error) {
        console.error('Error fetching compliance alerts:', error);
      }
    }
  };

  const fetchPendingBookings = async () => {
    if (user?.role === 'admin') {
      try {
        const [pendingRes, carsRes] = await Promise.all([
          bookingAPI.getPending(),
          carAPI.getAll(),
        ]);
        setPendingBookings(pendingRes.data);
        setCars(carsRes.data);
      } catch (error) {
        console.error('Error fetching pending bookings:', error);
      }
    }
  };

  const fetchLiftRequests = useCallback(async () => {
    try {
      const response = await liftRequestAPI.getActive();
      setLiftRequests(response.data);
    } catch (error) {
      console.error('Error fetching lift requests:', error);
    }
  }, []);

  const fetchLiftNotifications = useCallback(async () => {
    try {
      const response = await liftNotificationAPI.get();
      setLiftNotifications(response.data);
    } catch (error) {
      console.error('Error fetching lift notifications:', error);
    }
  }, []);

  const fetchBookingNotifications = useCallback(async () => {
    try {
      const response = await bookingNotificationAPI.get();
      setBookingNotifications(response.data);
    } catch (error) {
      console.error('Error fetching booking notifications:', error);
    }
  }, []);

  useEffect(() => {
    fetchLiveStatus();
    fetchComplianceAlerts();
    fetchPendingBookings();
    fetchLiftRequests();
    fetchLiftNotifications();
    fetchBookingNotifications();
    fetchTodos();
    fetchWeather(); // Fetch weather on load
    // Auto-refresh every 10 seconds for faster notifications
    const interval = setInterval(() => {
      fetchLiveStatus();
      fetchComplianceAlerts();
      fetchPendingBookings();
      fetchLiftRequests();
      fetchLiftNotifications();
      fetchBookingNotifications();
      fetchTodos();
    }, 10000);
    // Refresh weather every 30 minutes
    const weatherInterval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => {
      clearInterval(interval);
      clearInterval(weatherInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const getCarName = (carId) => {
    const car = cars.find(c => c.id === carId);
    return car ? car.name : 'Unknown';
  };

  const handleApproveBooking = async (groupId) => {
    try {
      await bookingAPI.approve(groupId);
      fetchPendingBookings();
      fetchLiveStatus();
    } catch (err) {
      console.error('Failed to approve booking:', err);
    }
  };

  const handleRejectClick = (group) => {
    setSelectedBookingGroup(group);
    setShowRejectModal(true);
  };

  const handleRejectBooking = async (groupId, reason) => {
    await bookingAPI.reject(groupId, reason);
    fetchPendingBookings();
  };

  const handleDismissBookingNotification = async (notificationId) => {
    try {
      await bookingNotificationAPI.markRead(notificationId);
      setBookingNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error dismissing booking notification:', error);
    }
  };

  // Status Edit Functions
  const handleOpenStatusModal = (car) => {
    setSelectedCar(car);
    setStatusForm({
      status: car.current_status || 'Free',
      notes: '',
      location: car.location || ''
    });
    setShowStatusModal(true);
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    try {
      await carAPI.updateStatus(selectedCar.car_id, statusForm);
      setShowStatusModal(false);
      setSelectedCar(null);
      fetchLiveStatus();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleAcceptLiftClick = (request) => {
    setSelectedRequest(request);
    setShowAcceptModal(true);
  };

  const handleAcceptLift = async (requestId, message) => {
    try {
      await liftRequestAPI.accept(requestId, message);
      setShowAcceptModal(false);
      setSelectedRequest(null);
      fetchLiftRequests();
    } catch (error) {
      console.error('Error accepting lift request:', error);
      alert(error.response?.data?.detail || 'Failed to accept lift request');
    }
  };

  const handleDismissLift = async (requestId) => {
    try {
      await liftRequestAPI.dismiss(requestId);
      fetchLiftRequests();
    } catch (error) {
      console.error('Error dismissing lift request:', error);
      alert(error.response?.data?.detail || 'Failed to dismiss lift request');
    }
  };

  const handleDeleteLift = async (requestId) => {
    if (!window.confirm('Are you sure you want to permanently delete this lift request? This action cannot be undone.')) return;
    try {
      await liftRequestAPI.delete(requestId);
      fetchLiftRequests();
    } catch (error) {
      console.error('Error deleting lift request:', error);
      alert(error.response?.data?.detail || 'Failed to delete lift request');
    }
  };

  const handleDismissNotification = async (notificationId) => {
    try {
      await liftNotificationAPI.markRead(notificationId);
      setLiftNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  };

  const handleLiftRequestSuccess = () => {
    fetchLiftRequests();
  };

  const formatTime = (date) => {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="max-w-7xl mx-auto px-3 py-4 sm:px-6 lg:px-8">
      {/* Lift Accepted Notifications - Show as modal */}
      {liftNotifications.length > 0 && (
        <LiftAcceptedNotification
          notification={liftNotifications[0]}
          onDismiss={handleDismissNotification}
        />
      )}

      {/* Lift Requests Section - Visible to all users */}
      <div id="lift-requests">
        <LiftRequestsPanel
          requests={liftRequests}
          onAccept={handleAcceptLiftClick}
          onDismiss={handleDismissLift}
          onDelete={handleDeleteLift}
          currentUserEmail={user?.email}
          isAdmin={user?.role === 'admin'}
        />
      </div>

      {/* Compliance Alerts Section - Admin Only */}
      {user?.role === 'admin' && complianceAlerts.length > 0 && (
        <div className="mb-4 bg-red-50 border-2 border-red-300 rounded-lg p-3 sm:p-4">
          <div className="flex items-center mb-2 sm:mb-3">
            <AlertTriangle className="text-red-600 mr-2" size={20} />
            <h2 className="text-base sm:text-lg font-bold text-red-800">Compliance Alerts</h2>
          </div>
          <div className="space-y-3">
            {complianceAlerts.map((car) => (
              <div key={car.car_id} className="bg-white rounded-lg p-3 border border-red-200">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-gray-900">{car.car_name}</span>
                    <span className="text-gray-500 ml-2">({car.registration})</span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {car.alerts.map((alert, idx) => (
                    <span 
                      key={idx}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        alert.is_overdue 
                          ? 'bg-red-600 text-white' 
                          : alert.days_until <= 7 
                            ? 'bg-red-500 text-white'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {alert.type}: {alert.is_overdue 
                        ? `OVERDUE by ${Math.abs(alert.days_until)} days` 
                        : `${alert.days_until} days left`
                      } ({formatDate(alert.due_date)})
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Booking Approvals - Admin Only */}
      {user?.role === 'admin' && pendingBookings.length > 0 && (
        <div className="mb-6 bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <Clock className="text-orange-600 mr-2" size={24} />
            <h2 className="text-lg font-bold text-orange-800">
              Pending Booking Approvals ({pendingBookings.length})
            </h2>
          </div>
          <div className="space-y-3">
            {pendingBookings.map((group) => (
              <div key={group.group_id} className="bg-white rounded-lg p-4 border border-orange-200">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-gray-900">{getCarName(group.car_id)}</span>
                      <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded">
                        {group.recurrence_type} × {group.bookings.length}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Requested by <span className="font-medium">{getUsername(group.created_by_email)}</span> for {group.user_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Starts: {new Date(group.first_booking.start_time).toLocaleDateString('en-US', { 
                        weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleApproveBooking(group.group_id)}
                      className="flex items-center space-x-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                    >
                      <Check size={16} />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => handleRejectClick(group)}
                      className="flex items-center space-x-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                    >
                      <X size={16} />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4 sm:mb-6">
        <div className="flex-1">
          {/* Special greetings for specific users */}
          {(() => {
            const email = user?.email?.toLowerCase() || '';
            const username = email.split('@')[0];
            
            // Check for personalized greetings
            const personalizedUsers = ['carecoordinatorkwc', 'kevanfewtrell', 'pmcxleewalker'];
            const isPersonalized = personalizedUsers.includes(username);
            const isCarly = email === 'carlyodonovan@bluebirdcare.ie';
            const isStaff = user?.role !== 'admin';
            
            if (isCarly) {
              return (
                <>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center" data-testid="dashboard-title">
                    <span className="mr-2">🐾</span>
                    Welcome, Carly!
                    <span className="ml-2">🐾</span>
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 flex items-center mt-1">
                    <Clock size={12} className="mr-1" />
                    Updated: {lastUpdated ? formatTime(lastUpdated) : 'Loading...'}
                  </p>
                </>
              );
            } else if (isPersonalized) {
              // Get display name from username
              const displayName = username.charAt(0).toUpperCase() + username.slice(1);
              return (
                <>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900" data-testid="dashboard-title">
                    Hey {displayName}!
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 flex items-center mt-1">
                    <Clock size={12} className="mr-1" />
                    Updated: {lastUpdated ? formatTime(lastUpdated) : 'Loading...'}
                  </p>
                </>
              );
            } else if (isStaff) {
              // Cleaner staff dashboard header
              return (
                <>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900" data-testid="dashboard-title">
                    Dashboard
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 flex items-center mt-1">
                    <Clock size={12} className="mr-1" />
                    {lastUpdated ? formatTime(lastUpdated) : 'Loading...'}
                  </p>
                </>
              );
            } else {
              return (
                <>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900" data-testid="dashboard-title">Fleet Status</h1>
                  <p className="text-xs sm:text-sm text-gray-500 flex items-center mt-1">
                    <Clock size={12} className="mr-1" />
                    Updated: {lastUpdated ? formatTime(lastUpdated) : 'Loading...'}
                  </p>
                </>
              );
            }
          })()}
        </div>
        
        {/* Weather Widget - Only for Staff */}
        {user?.role !== 'admin' && (
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {/* Kerry Weather */}
            <div className="bg-gradient-to-br from-blue-50 to-sky-100 rounded-lg px-3 py-2 shadow-sm border border-blue-200 min-w-[140px]">
              {weather.loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-pulse bg-blue-200 h-6 w-6 rounded-full"></div>
                  <div className="animate-pulse bg-blue-200 h-4 w-16 rounded"></div>
                </div>
              ) : weather.kerry ? (
                <div className="flex items-center space-x-2">
                  {getWeatherIcon(weather.kerry.code)}
                  <div>
                    <p className="text-xs font-semibold text-blue-800">Kerry</p>
                    <p className="text-lg font-bold text-gray-900">{weather.kerry.temp}°C</p>
                    <p className="text-xs text-gray-600 truncate max-w-[80px]">{weather.kerry.desc}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">Weather unavailable</p>
              )}
            </div>
            
            {/* West Cork Weather */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg px-3 py-2 shadow-sm border border-green-200 min-w-[140px]">
              {weather.loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-pulse bg-green-200 h-6 w-6 rounded-full"></div>
                  <div className="animate-pulse bg-green-200 h-4 w-16 rounded"></div>
                </div>
              ) : weather.westCork ? (
                <div className="flex items-center space-x-2">
                  {getWeatherIcon(weather.westCork.code)}
                  <div>
                    <p className="text-xs font-semibold text-green-800">West Cork</p>
                    <p className="text-lg font-bold text-gray-900">{weather.westCork.temp}°C</p>
                    <p className="text-xs text-gray-600 truncate max-w-[80px]">{weather.westCork.desc}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">Weather unavailable</p>
              )}
            </div>
          </div>
        )}
        
        <button
          onClick={() => { fetchLiveStatus(); fetchComplianceAlerts(); fetchPendingBookings(); fetchLiftRequests(); fetchLiftNotifications(); fetchBookingNotifications(); fetchTodos(); fetchWeather(); }}
          data-testid="refresh-button"
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
        >
          <RefreshCw size={18} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Admin To-Do Alert Banner */}
      {user?.role === 'admin' && todos.filter(t => !t.is_completed).length > 0 && (
        <div className="mb-4 sm:mb-6 bg-teal-50 border-2 border-teal-400 rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="bg-teal-500 rounded-full p-2">
              <ListTodo size={24} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-teal-800">📋 To-Do List Reminder</h3>
              <p className="text-sm text-teal-700">
                You have <span className="font-bold">{todos.filter(t => !t.is_completed).length}</span> pending task(s)
                {todos.filter(t => !t.is_completed && t.is_mandatory).length > 0 && (
                  <span className="text-amber-600 font-medium"> ({todos.filter(t => !t.is_completed && t.is_mandatory).length} mandatory)</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/admin?tab=todos')}
            className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            View Tasks
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && liveStatus.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading fleet status...</p>
        </div>
      ) : liveStatus.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No cars in the fleet. Add cars from the Admin panel.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
          {liveStatus.map((item) => (
            <div
              key={item.car.id}
              data-testid={`car-card-${item.car.id}`}
              className={`bg-white rounded-lg shadow hover:shadow-md transition-shadow p-3 ${
                item.car.is_blocked ? 'border-l-4 border-purple-400' : ''
              } ${item.car.current_status === 'Booked' ? 'border-l-4 border-yellow-400' : ''}`}
            >
              {/* Header: Name + Status */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 pr-1">
                  <h3 className="text-sm font-semibold text-gray-900 truncate" data-testid={`car-name-${item.car.id}`}>
                    {item.car.name}
                  </h3>
                  <p className="text-xs text-gray-400">{item.car.registration}</p>
                </div>
                <StatusBadge 
                  status={item.car.current_status} 
                  isBlocked={item.car.is_blocked}
                  blockReason={item.car.block_reason}
                  compact={true}
                />
              </div>

              {/* Show who booked the car if status is Booked */}
              {item.car.current_status === 'Booked' && item.latest_status?.booked_by && (
                <div className="bg-yellow-50 rounded px-2 py-1 mb-2">
                  <p className="text-xs text-yellow-800 truncate">👤 {item.latest_status.booked_by}</p>
                </div>
              )}

              {/* Location - compact */}
              {item.latest_status?.location && item.car.current_status !== 'Booked' && (
                <div className="bg-blue-50 rounded px-2 py-1 mb-2">
                  <p className="text-xs text-blue-800 truncate">📍 {item.latest_status.location}</p>
                </div>
              )}

              {/* Footer: Time + Edit */}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{item.latest_status?.timestamp ? formatTime(item.latest_status.timestamp) : 'No update'}</span>
                {user?.role === 'admin' && (
                  <button
                    onClick={() => handleOpenStatusModal({...item.car, car_id: item.car.id, location: item.latest_status?.location})}
                    className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                    title="Edit Status"
                  >
                    <Edit2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Request a Lift Button - Footer */}
      <div className="mt-8 mb-20 md:mb-8">
        <button
          onClick={() => setShowLiftModal(true)}
          className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center space-x-3"
        >
          <span className="text-2xl">🙋‍♂️</span>
          <span className="text-lg">Request a Lift</span>
          <Plus size={20} />
        </button>
      </div>

      {/* Lift Request Modal */}
      <LiftRequestModal
        isOpen={showLiftModal}
        onClose={() => setShowLiftModal(false)}
        onSuccess={handleLiftRequestSuccess}
      />

      {/* Accept Lift Modal */}
      <AcceptLiftModal
        isOpen={showAcceptModal}
        onClose={() => { setShowAcceptModal(false); setSelectedRequest(null); }}
        onAccept={handleAcceptLift}
        request={selectedRequest}
      />

      {/* Reject Booking Modal */}
      <RejectBookingModal
        isOpen={showRejectModal}
        onClose={() => { setShowRejectModal(false); setSelectedBookingGroup(null); }}
        onReject={handleRejectBooking}
        booking={selectedBookingGroup}
      />

      {/* Booking Notification Modal - Shows approval/rejection to staff */}
      {bookingNotifications.length > 0 && (
        <BookingNotificationModal
          notification={bookingNotifications[0]}
          onDismiss={handleDismissBookingNotification}
        />
      )}

      {/* Status Edit Modal - Admin Only */}
      {showStatusModal && selectedCar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold">Update Car Status</h3>
              <button
                onClick={() => { setShowStatusModal(false); setSelectedCar(null); }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateStatus} className="p-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium text-gray-900">{selectedCar.name}</p>
                <p className="text-sm text-gray-500">{selectedCar.registration}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({...statusForm, status: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="Free">🟢 Free</option>
                  <option value="In Use">🔵 In Use</option>
                  <option value="Booked">🟡 Booked</option>
                  <option value="Maintenance">🔧 Maintenance</option>
                  <option value="Out of Service">🔴 Out of Service</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  value={statusForm.location}
                  onChange={(e) => setStatusForm({...statusForm, location: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Main Office, Dublin City"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={statusForm.notes}
                  onChange={(e) => setStatusForm({...statusForm, notes: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Add any notes about this status change..."
                />
              </div>
              
              <div className="flex space-x-4 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Update Status
                </button>
                <button
                  type="button"
                  onClick={() => { setShowStatusModal(false); setSelectedCar(null); }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
