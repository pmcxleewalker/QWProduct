import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, PhoneCall, Settings, LogOut, FileSpreadsheet, Bell, X, Check, MapPin, Clock, Calendar as CalendarIcon, User, Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { liftRequestAPI } from '../api/api';
import ChangePasswordModal from './ChangePasswordModal';

const Navigation = () => {
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const [liftRequestCount, setLiftRequestCount] = useState(0);
  const [liftRequests, setLiftRequests] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const notificationRef = useRef(null);
  const seenRequestIds = useRef(new Set());
  
  const isActive = (path) => location.pathname === path;
  
  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/live-sheet', icon: FileSpreadsheet, label: 'Live Sheet' },
    { path: '/bookings', icon: Calendar, label: 'Bookings' },
    { path: '/assistance', icon: PhoneCall, label: 'Assistance' },
  ];

  // Only show Admin for admin users
  if (isAdmin()) {
    navItems.push({ path: '/admin', icon: Settings, label: 'Admin' });
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchLiftRequests = async () => {
      try {
        const [countRes, requestsRes] = await Promise.all([
          liftRequestAPI.getCount(),
          liftRequestAPI.getActive()
        ]);
        
        setLiftRequestCount(countRes.data.count);
        setLiftRequests(requestsRes.data);
        
        // Update seen IDs
        seenRequestIds.current = new Set(requestsRes.data.map(r => r.id));
      } catch (error) {
        console.error('Error fetching lift requests:', error);
      }
    };

    fetchLiftRequests();
    // Poll for new lift requests every 15 seconds
    const interval = setInterval(fetchLiftRequests, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const handleAcceptLift = async (requestId) => {
    // For navigation dropdown, we'll just accept without message modal
    // The full modal experience is on the Dashboard
    try {
      await liftRequestAPI.accept(requestId, '');
      // Refresh
      const [countRes, requestsRes] = await Promise.all([
        liftRequestAPI.getCount(),
        liftRequestAPI.getActive()
      ]);
      setLiftRequestCount(countRes.data.count);
      setLiftRequests(requestsRes.data);
    } catch (error) {
      console.error('Error accepting lift request:', error);
      alert(error.response?.data?.detail || 'Failed to accept lift request');
    }
  };

  const handleDismissRequest = async (requestId) => {
    try {
      await liftRequestAPI.dismiss(requestId);
      // Refresh
      const [countRes, requestsRes] = await Promise.all([
        liftRequestAPI.getCount(),
        liftRequestAPI.getActive()
      ]);
      setLiftRequestCount(countRes.data.count);
      setLiftRequests(requestsRes.data);
    } catch (error) {
      console.error('Error dismissing lift request:', error);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Notification Dropdown Component
  const NotificationDropdown = () => (
    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-96 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xl">🙋‍♂️</span>
          <span className="text-white font-bold">Lift Requests ({liftRequestCount})</span>
        </div>
        <button
          onClick={() => setShowNotifications(false)}
          className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto max-h-72">
        {liftRequests.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Bell size={32} className="mx-auto mb-2 text-gray-300" />
            <p>No active lift requests</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {liftRequests.map((request) => {
              const isOwnRequest = request.requester_email === user?.email;
              
              return (
                <div key={request.id} className="p-3 hover:bg-gray-50">
                  {/* Requester */}
                  <div className="flex items-center space-x-2 mb-2">
                    <User size={14} className="text-blue-500" />
                    <span className="font-medium text-gray-900 text-sm">{request.requester_name}</span>
                    {isOwnRequest && (
                      <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded">
                        You
                      </span>
                    )}
                  </div>

                  {/* Locations */}
                  <div className="space-y-1 text-xs text-gray-600 mb-2">
                    <div className="flex items-center space-x-1">
                      <MapPin size={12} className="text-green-500" />
                      <span>{request.from_location}</span>
                      <span className="text-gray-400">→</span>
                      <MapPin size={12} className="text-red-500" />
                      <span>{request.to_location}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1">
                        <CalendarIcon size={12} />
                        <span>{formatDate(request.lift_date)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock size={12} />
                        <span>{formatTime(request.lift_time)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2">
                    {!isOwnRequest && (
                      <button
                        onClick={() => handleAcceptLift(request.id)}
                        className="flex-1 flex items-center justify-center space-x-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium transition-colors"
                      >
                        <Check size={14} />
                        <span>I can help!</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleDismissRequest(request.id)}
                      className="flex-1 flex items-center justify-center space-x-1 px-3 py-1.5 bg-gray-400 text-white rounded-lg hover:bg-gray-500 text-xs font-medium transition-colors"
                      title="Hide from your view"
                    >
                      <X size={14} />
                      <span>Hide</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-4 py-2 bg-gray-50">
        <Link
          to="/"
          onClick={() => setShowNotifications(false)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          View all on Dashboard →
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Header */}
      <nav className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
        <div className="flex justify-between items-center h-14 px-4">
          <h1 className="text-xl font-bold text-blue-600">Quick Wing</h1>
          <div className="flex items-center space-x-2">
            {/* Notification Bell - Mobile */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={toggleNotifications}
                className="relative flex items-center p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                title="Lift Requests"
              >
                <Bell size={20} />
                {liftRequestCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold">
                    {liftRequestCount > 9 ? '9+' : liftRequestCount}
                  </span>
                )}
              </button>
              {showNotifications && <NotificationDropdown />}
            </div>
            
            <span className="text-xs text-gray-600">{user?.email?.split('@')[0]}</span>
            {isAdmin() && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                Admin
              </span>
            )}
            <button
              onClick={() => setShowChangePassword(true)}
              className="flex items-center p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              title="Change Password"
            >
              <Key size={18} />
            </button>
            <button
              onClick={handleLogout}
              data-testid="mobile-logout-button"
              className="flex items-center p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive(item.path)
                    ? 'text-blue-600'
                    : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                <Icon size={24} />
                <span className="text-xs mt-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Header Navigation */}
      <nav className="hidden md:block bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-blue-600">Quick Wing</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex space-x-8">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      data-testid={`nav-${item.label.toLowerCase()}`}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                        isActive(item.path)
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon size={20} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
              
              {/* Notification Bell - Desktop */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={toggleNotifications}
                  className="relative flex items-center p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  title="View Lift Requests"
                >
                  <Bell size={22} />
                  {liftRequestCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold animate-pulse">
                      {liftRequestCount > 9 ? '9+' : liftRequestCount}
                    </span>
                  )}
                </button>
                {showNotifications && <NotificationDropdown />}
              </div>
              
              <div className="flex items-center space-x-3 pl-4 border-l border-gray-200">
                <span className="text-sm text-gray-700">{user?.email}</span>
                {isAdmin() && (
                  <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                    Admin
                  </span>
                )}
                <button
                  onClick={() => setShowChangePassword(true)}
                  className="flex items-center p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Change Password"
                >
                  <Key size={18} />
                </button>
                <button
                  onClick={handleLogout}
                  data-testid="logout-button"
                  className="flex items-center p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </>
  );
};

export default Navigation;
