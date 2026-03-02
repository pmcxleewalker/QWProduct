import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Calendar, PhoneCall, Settings, LogOut, FileSpreadsheet, Bell, X, Check, MapPin, Clock, Calendar as CalendarIcon, User, Key, Fish, BellRing, BellOff, Megaphone, Crown, Building2, Eye, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { liftRequestAPI } from '../api/api';
import ChangePasswordModal from './ChangePasswordModal';
import usePushNotifications from '../hooks/usePushNotifications';

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isTenantAdmin, isPlatformAdmin, isImpersonating, stopImpersonation, activeTenant } = useAuth();
  const [liftRequestCount, setLiftRequestCount] = useState(0);
  const [liftRequests, setLiftRequests] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showPushSettings, setShowPushSettings] = useState(false);
  const [showDeploymentUpdates, setShowDeploymentUpdates] = useState(false);
  const notificationRef = useRef(null);
  const deploymentRef = useRef(null);
  const seenRequestIds = useRef(new Set());
  
  // Deployment updates for admins
  const deploymentUpdates = [
    {
      date: '2 Mar 2026',
      title: 'Multi-Tenant SaaS Platform',
      changes: [
        '🏢 Multi-franchise support with tenant isolation',
        '👑 Super Admin & Master Admin roles',
        '🔐 Strict data isolation per franchise',
        '📊 Platform Command Centre for management',
        '⏸️ Tenant suspension for payment management'
      ]
    },
    {
      date: '16 Feb 2026',
      title: 'Master Admin & Reports Update',
      changes: [
        '👑 Master Admin role for Carly O\'Donovan',
        '📊 Enhanced reports with date filtering',
        '📈 Charts view in Booking Details Report'
      ]
    }
  ];
  
  // Push notification hook
  const { isSupported, isSubscribed, permission, subscribe, unsubscribe } = usePushNotifications(user);
  
  const isActive = (path) => location.pathname === path;
  
  // Helper functions for admin checks
  const isAdmin = () => isTenantAdmin || isPlatformAdmin;
  const isMasterAdmin = isPlatformAdmin;
  
  // Check if user is pmcxleewalker (show fish icon instead of "Live Sheet")
  const isPmcxUser = user?.email?.toLowerCase().split('@')[0] === 'pmcxleewalker';
  
  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/live-sheet', icon: isPmcxUser ? Fish : FileSpreadsheet, label: isPmcxUser ? '' : 'Live Sheet', isFishIcon: isPmcxUser },
    { path: '/bookings', icon: Calendar, label: 'Bookings' },
    { path: '/assistance', icon: PhoneCall, label: 'Assistance' },
  ];

  // Handle push notification toggle
  const handlePushToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
    setShowPushSettings(false);
  };

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
      if (deploymentRef.current && !deploymentRef.current.contains(event.target)) {
        setShowDeploymentUpdates(false);
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
          <h1 className="text-xl font-bold text-blue-600">{process.env.REACT_APP_COMPANY_NAME || 'Quick Wing'}</h1>
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
            
            {/* Push Notifications Toggle - Mobile (Staff only) */}
            {isSupported && !isAdmin() && (
              <button
                onClick={handlePushToggle}
                className={`flex items-center p-2 rounded-md transition-colors ${
                  isSubscribed 
                    ? 'text-green-600 hover:bg-green-50' 
                    : 'text-gray-400 hover:bg-gray-100'
                }`}
                title={isSubscribed ? 'Push notifications enabled' : 'Enable push notifications'}
              >
                {isSubscribed ? <BellRing size={18} /> : <BellOff size={18} />}
              </button>
            )}
            
            {/* Deployment Updates - Admin only (Mobile) */}
            {isAdmin() && (
              <div className="relative" ref={deploymentRef}>
                <button
                  onClick={() => setShowDeploymentUpdates(!showDeploymentUpdates)}
                  className="flex items-center p-2 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                  title="Deployment Updates"
                >
                  <Megaphone size={18} />
                </button>
                {showDeploymentUpdates && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
                    <div className="p-3 border-b bg-indigo-50">
                      <h3 className="font-semibold text-indigo-900 flex items-center">
                        <Megaphone size={16} className="mr-2" />
                        Deployment Updates
                      </h3>
                      <p className="text-xs text-indigo-600 mt-1">What's new in {process.env.REACT_APP_COMPANY_NAME || 'Quick Wing'}</p>
                    </div>
                    <div className="divide-y">
                      {deploymentUpdates.map((update, idx) => (
                        <div key={idx} className="p-3">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium text-gray-900 text-sm">{update.title}</span>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{update.date}</span>
                          </div>
                          <ul className="space-y-1">
                            {update.changes.map((change, cIdx) => (
                              <li key={cIdx} className="text-xs text-gray-600">{change}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex items-center space-x-1">
              {isMasterAdmin && (
                <Crown size={16} className="text-yellow-500" title="Master Admin" />
              )}
              <span className="text-xs text-gray-600">{user?.email?.split('@')[0]}</span>
            </div>
            {isAdmin() && (
              <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                isMasterAdmin 
                  ? 'bg-gradient-to-r from-yellow-100 to-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-purple-100 text-purple-800'
              }`}>
                {isMasterAdmin ? '👑 Master Admin' : 'Admin'}
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
                data-testid={item.isFishIcon ? 'nav-fish' : `nav-${item.label.toLowerCase()}`}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive(item.path)
                    ? 'text-blue-600'
                    : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                <Icon size={item.isFishIcon ? 28 : 24} className={item.isFishIcon ? 'text-blue-500' : ''} />
                {item.label && <span className="text-xs mt-1">{item.label}</span>}
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
              <h1 className="text-2xl font-bold text-blue-600">{process.env.REACT_APP_COMPANY_NAME || 'Quick Wing'}</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex space-x-8">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  // For admin: show icons only for Bookings, Assistance, Admin (not Dashboard, Live Sheet)
                  const isIconOnlyForAdmin = isAdmin() && ['Bookings', 'Assistance', 'Admin'].includes(item.label);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      data-testid={item.isFishIcon ? 'nav-fish-desktop' : `nav-${item.label.toLowerCase()}`}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                        isActive(item.path)
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                      }`}
                      title={item.isFishIcon ? 'Live Sheet' : item.label}
                    >
                      <Icon size={item.isFishIcon ? 24 : 20} className={item.isFishIcon ? 'text-blue-500' : ''} />
                      {item.label && !isIconOnlyForAdmin && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
              
              {/* Notification Bell - Desktop (Staff only) */}
              {!isAdmin() && (
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
              )}
              
              {/* Push Notifications Toggle - Desktop (Staff only) */}
              {isSupported && !isAdmin() && (
                <button
                  onClick={handlePushToggle}
                  className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                    isSubscribed 
                      ? 'text-green-600 bg-green-50 hover:bg-green-100' 
                      : 'text-gray-500 bg-gray-100 hover:bg-gray-200'
                  }`}
                  title={isSubscribed ? 'Push notifications enabled - Click to disable' : 'Enable push notifications'}
                >
                  {isSubscribed ? <BellRing size={16} /> : <BellOff size={16} />}
                  <span className="hidden lg:inline">{isSubscribed ? 'Push On' : 'Push Off'}</span>
                </button>
              )}
              
              {/* Deployment Updates - Admin only (Desktop) */}
              {isAdmin() && (
                <div className="relative">
                  <button
                    onClick={() => setShowDeploymentUpdates(!showDeploymentUpdates)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg transition-colors text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                    title="Deployment Updates"
                  >
                    <Megaphone size={16} />
                    <span className="hidden lg:inline">Updates</span>
                  </button>
                  {showDeploymentUpdates && (
                    <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[500px] overflow-y-auto">
                      <div className="p-4 border-b bg-indigo-50 sticky top-0">
                        <h3 className="font-semibold text-indigo-900 flex items-center">
                          <Megaphone size={18} className="mr-2" />
                          Deployment Updates
                        </h3>
                        <p className="text-xs text-indigo-600 mt-1">What's new in {process.env.REACT_APP_COMPANY_NAME || 'Quick Wing'}</p>
                      </div>
                      <div className="divide-y">
                        {deploymentUpdates.map((update, idx) => (
                          <div key={idx} className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-medium text-gray-900">{update.title}</span>
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{update.date}</span>
                            </div>
                            <ul className="space-y-1.5">
                              {update.changes.map((change, cIdx) => (
                                <li key={cIdx} className="text-sm text-gray-600">{change}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex items-center space-x-3 pl-4 border-l border-gray-200">
                {/* Show email only for staff */}
                {!isAdmin() && <span className="text-sm text-gray-700">{user?.email}</span>}
                {isAdmin() && (
                  <div className="flex items-center space-x-2">
                    {isMasterAdmin && (
                      <Crown size={20} className="text-yellow-500" title="Master Admin" />
                    )}
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      isMasterAdmin 
                        ? 'bg-gradient-to-r from-yellow-100 to-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {isMasterAdmin ? '👑 Master Admin' : 'Admin'}
                    </span>
                  </div>
                )}
                {/* Show change password only for staff */}
                {!isAdmin() && (
                  <button
                    onClick={() => setShowChangePassword(true)}
                    className="flex items-center p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    title="Change Password"
                  >
                    <Key size={18} />
                  </button>
                )}
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
