import React, { useState, useEffect, useCallback } from 'react';
import { statusAPI, complianceAPI, bookingAPI, carAPI, liftRequestAPI, liftNotificationAPI, bookingNotificationAPI, todoAPI } from '../api/api';
import StatusBadge from '../components/StatusBadge';
import LiftRequestsPanel from '../components/LiftRequestsPanel';
import LiftRequestModal from '../components/LiftRequestModal';
import AcceptLiftModal from '../components/AcceptLiftModal';
import LiftAcceptedNotification from '../components/LiftAcceptedNotification';
import RejectBookingModal from '../components/RejectBookingModal';
import BookingNotificationModal from '../components/BookingNotificationModal';
import { RefreshCw, Clock, AlertTriangle, Check, X, Plus, ListTodo, Edit2 } from 'lucide-react';
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
    return () => clearInterval(interval);
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
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
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
        <div className="mb-6 bg-red-50 border-2 border-red-300 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <AlertTriangle className="text-red-600 mr-2" size={24} />
            <h2 className="text-lg font-bold text-red-800">Compliance Alerts - Action Required</h2>
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
      <div className="flex justify-between items-center mb-6">
        <div>
          {/* Special greeting for Carly */}
          {user?.email?.toLowerCase() === 'carlyodonovan@bluebirdcare.ie' ? (
            <>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center" data-testid="dashboard-title">
                <span className="mr-2">🐾</span>
                Welcome, Carly!
                <span className="ml-2">🐾</span>
              </h1>
              <p className="text-sm text-gray-500 flex items-center mt-1">
                <Clock size={14} className="mr-1" />
                Last updated: {lastUpdated ? formatTime(lastUpdated) : 'Loading...'}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-900" data-testid="dashboard-title">Fleet Status</h1>
              <p className="text-sm text-gray-500 flex items-center mt-1">
                <Clock size={14} className="mr-1" />
                Last updated: {lastUpdated ? formatTime(lastUpdated) : 'Loading...'}
              </p>
            </>
          )}
        </div>
        <button
          onClick={() => { fetchLiveStatus(); fetchComplianceAlerts(); fetchPendingBookings(); fetchLiftRequests(); fetchLiftNotifications(); fetchBookingNotifications(); fetchTodos(); }}
          data-testid="refresh-button"
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw size={18} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Admin To-Do Alert Banner */}
      {user?.role === 'admin' && todos.filter(t => !t.is_completed).length > 0 && (
        <div className="mb-6 bg-teal-50 border-2 border-teal-400 rounded-lg p-4 flex items-center justify-between">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {liveStatus.map((item) => (
            <div
              key={item.car.id}
              data-testid={`car-card-${item.car.id}`}
              className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow ${
                item.car.is_blocked ? 'border-2 border-purple-400' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900" data-testid={`car-name-${item.car.id}`}>
                    {item.car.name}
                  </h3>
                  <p className="text-sm text-gray-500">{item.car.registration}</p>
                </div>
                <StatusBadge 
                  status={item.car.current_status} 
                  isBlocked={item.car.is_blocked}
                  blockReason={item.car.block_reason}
                />
              </div>

              {item.latest_status && (
                <div className="border-t pt-4 mt-4">
                  {item.latest_status.location && (
                    <div className="mb-3 bg-blue-50 rounded-lg p-3">
                      <p className="text-sm font-medium text-blue-900">📍 {item.latest_status.location}</p>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Last updated:</span>
                    <span className="font-medium text-gray-700">
                      {formatTime(item.latest_status.timestamp)}
                    </span>
                  </div>
                  {item.latest_status.user_name && (
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-gray-500">By:</span>
                      <span className="font-medium text-gray-700">
                        {item.latest_status.user_name}
                      </span>
                    </div>
                  )}
                  {item.latest_status.notes && (
                    <div className="mt-3">
                      <p className="text-sm text-gray-600 italic">&ldquo;{item.latest_status.notes}&rdquo;</p>
                    </div>
                  )}
                </div>
              )}
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
    </div>
  );
};

export default Dashboard;
