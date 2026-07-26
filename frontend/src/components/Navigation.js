import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Calendar, PhoneCall, Settings, LogOut, FileSpreadsheet, Bell, X, Check, MapPin, Clock, Calendar as CalendarIcon, User, Key, Fish, BellRing, BellOff, Crown, Building2, Eye, Shield, BarChart3, Scale, AlertTriangle, ShieldAlert } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { liftRequestAPI, trackerAPI } from '../api/api';
import ChangePasswordModal from './ChangePasswordModal';
import usePushNotifications from '../hooks/usePushNotifications';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Navigation = ({ tenantSlug }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isTenantAdmin, isPlatformAdmin, isImpersonating, stopImpersonation, activeTenant } = useAuth();
  const [liftRequestCount, setLiftRequestCount] = useState(0);
  const [liftRequests, setLiftRequests] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showPushSettings, setShowPushSettings] = useState(false);
  // Per-tenant logo (BUMBLEance, etc.). When set we replace the "Quick Wing"
  // wordmark in the navbar with the client's own brand. Cached per tenant so
  // switching back-and-forth doesn't re-flicker.
  const [tenantLogo, setTenantLogo] = useState(null);
  // GPS alerts nav badge (Phase 5). Only shown when the tenant has GPS
  // enabled AND the user is a tenant admin. Polls every 60 s.
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [alertCounts, setAlertCounts] = useState({ total: 0, critical: 0 });
  const notificationRef = useRef(null);
  const seenRequestIds = useRef(new Set());

  // Fetch tenant logo whenever the active tenant changes.
  useEffect(() => {
    let cancelled = false;
    const tenantId = activeTenant?.tenant_id;
    if (!tenantId) {
      setTenantLogo(null);
      return;
    }
    axios
      .get(`${API}/tenant/settings`)
      .then((res) => {
        if (cancelled) return;
        const url = res?.data?.branding?.logo_url || null;
        setTenantLogo(url);
        setGpsEnabled(!!res?.data?.gps?.enabled);
      })
      .catch(() => {
        if (!cancelled) setTenantLogo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenant?.tenant_id]);

  // GPS alerts count poller — only fires when tenant has GPS enabled
  // and the current user is a tenant admin.
  useEffect(() => {
    if (!gpsEnabled || !isTenantAdmin()) {
      setAlertCounts({ total: 0, critical: 0 });
      return;
    }
    let cancelled = false;
    const fetchCounts = async () => {
      try {
        const { data } = await trackerAPI.alertsCount();
        if (!cancelled) setAlertCounts(data || { total: 0, critical: 0 });
      } catch {
        /* silent — API may be unreachable during login flip */
      }
    };
    fetchCounts();
    const t = setInterval(fetchCounts, 60000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [gpsEnabled, isTenantAdmin, activeTenant?.tenant_id]);

  // Get the base path for tenant-scoped navigation
  // Use tenantSlug prop first, then activeTenant, then fallback
  const basePath = tenantSlug ? `/${tenantSlug}` : (activeTenant?.tenant_slug ? `/${activeTenant.tenant_slug}` : '');
  
  // Helper function to build tenant-scoped paths
  const getTenantPath = (path) => {
    if (path === '/') return basePath || '/';
    return `${basePath}${path}`;
  };
  
  // Push notification hook
  const { isSupported, isSubscribed, permission, subscribe, unsubscribe } = usePushNotifications(user);
  
  // Check if path is active (accounting for tenant prefix)
  const isActive = (path) => {
    const fullPath = getTenantPath(path);
    return location.pathname === fullPath || location.pathname === path;
  };
  
  // Check if user is pmcxleewalker (show fish icon instead of "Live Sheet")
  const isPmcxUser = user?.email?.toLowerCase().split('@')[0] === 'pmcxleewalker';
  
  // Navigation items with tenant-scoped paths
  const navItems = [
    { path: getTenantPath('/'), icon: Home, label: 'Dashboard' },
    { path: getTenantPath('/live-sheet'), icon: isPmcxUser ? Fish : FileSpreadsheet, label: isPmcxUser ? '' : 'Live Sheet', isFishIcon: isPmcxUser },
    { path: getTenantPath('/bookings'), icon: Calendar, label: 'Bookings' },
    { path: getTenantPath('/assistance'), icon: PhoneCall, label: 'Assistance' },
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
  if (isTenantAdmin()) {
    navItems.push({ path: getTenantPath('/admin'), icon: Settings, label: 'Admin' });
  }

  // Show GPS Alerts nav item to tenant admins on GPS-enabled tenants.
  // Rendered with a red badge showing unacknowledged alert count (Phase 5).
  if (isTenantAdmin() && gpsEnabled) {
    navItems.splice(navItems.length - 1, 0, {
      path: getTenantPath('/alerts'),
      icon: AlertTriangle,
      label: 'Alerts',
      badge: alertCounts.total || 0,
      badgeCritical: alertCounts.critical || 0,
    });
    // Driver Behaviour dashboard — sits next to Alerts. No badge; the
    // feed is browsed on demand.
    navItems.splice(navItems.length - 1, 0, {
      path: getTenantPath('/behaviour'),
      icon: ShieldAlert,
      label: 'Behaviour',
    });
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

  // Fetch lift requests for notifications
  useEffect(() => {
    const fetchLiftRequests = async () => {
      // Skip for platform admins without tenant context
      if (!activeTenant?.tenant_id) return;
      
      if (isTenantAdmin()) {
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
      }
    };

    fetchLiftRequests();
    // Poll for new lift requests every 15 seconds
    const interval = setInterval(fetchLiftRequests, 15000);
    return () => clearInterval(interval);
  }, [user, activeTenant]);

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
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-xl font-bold text-blue-600 whitespace-nowrap">{process.env.REACT_APP_COMPANY_NAME || 'Quick Wing'}</h1>
            {tenantLogo && (
              <>
                <span className="text-gray-300 text-xs">·</span>
                <img
                  src={tenantLogo}
                  alt={activeTenant?.tenant_name || 'Tenant logo'}
                  className="h-6 w-auto max-w-[80px] object-contain opacity-80"
                  data-testid="navbar-tenant-badge"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    setTenantLogo(null);
                  }}
                />
              </>
            )}
          </div>
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
            {isSupported && !isTenantAdmin() && (
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
            
            <div className="flex items-center space-x-1">
              {isPlatformAdmin() && (
                <Crown size={16} className="text-yellow-500" title="Master Admin" />
              )}
              <span className="text-xs text-gray-600">{user?.email?.split('@')[0]}</span>
            </div>
            {isTenantAdmin() && (
              <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                isPlatformAdmin() 
                  ? 'bg-gradient-to-r from-yellow-100 to-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-purple-100 text-purple-800'
              }`}>
                {isPlatformAdmin() ? '👑 Master Admin' : 'Admin'}
              </span>
            )}
            {/* Command Centre Button for Super Admin */}
            {user?.role === 'super_admin' && (
              <Link
                to="/platform"
                className="flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-medium rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all shadow-sm"
                title="Tenant Command Centre"
              >
                <Building2 size={14} />
                <span className="hidden sm:inline">Command Centre</span>
              </Link>
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
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors relative ${
                  isActive(item.path)
                    ? 'text-blue-600'
                    : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                <Icon size={item.isFishIcon ? 28 : 24} className={item.isFishIcon ? 'text-blue-500' : ''} />
                {item.label && <span className="text-xs mt-1">{item.label}</span>}
                {item.badge > 0 && (
                  <span
                    className={`absolute top-1 right-1/3 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center ${
                      item.badgeCritical > 0 ? 'bg-red-600 animate-pulse' : 'bg-amber-500'
                    }`}
                    data-testid={`nav-alerts-badge-mobile`}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Header Navigation — purple branded bar */}
      <nav
        className="hidden md:block sticky top-0 z-50 border-b border-violet-950/40 shadow-md"
        style={{
          background: 'linear-gradient(90deg, #2e1065 0%, #4c1d95 35%, #6d28d9 65%, #4c1d95 100%)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <h1
                className="text-2xl font-bold text-white"
                style={{ textShadow: '0 0 12px rgba(216,180,254,0.45)' }}
              >
                {process.env.REACT_APP_COMPANY_NAME || 'Quick Wing'}
              </h1>
              {tenantLogo && (
                <>
                  <span className="h-6 w-px bg-white/30"></span>
                  <img
                    src={tenantLogo}
                    alt={activeTenant?.tenant_name || 'Tenant logo'}
                    className="h-8 w-auto max-w-[120px] object-contain opacity-90 drop-shadow-[0_0_6px_rgba(255,255,255,0.2)]"
                    data-testid="navbar-tenant-logo"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      setTenantLogo(null);
                    }}
                  />
                </>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex space-x-2 lg:space-x-4">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  // For admin: show icons only for Bookings, Assistance, Admin (not Dashboard, Live Sheet)
                  const isIconOnlyForAdmin = isTenantAdmin() && ['Bookings', 'Assistance', 'Admin'].includes(item.label);
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      data-testid={item.isFishIcon ? 'nav-fish-desktop' : `nav-${item.label.toLowerCase()}`}
                      className={`relative flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                        active
                          ? 'text-white bg-white/20 ring-1 ring-white/30 shadow-[0_0_18px_rgba(216,180,254,0.45)]'
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                      title={item.isFishIcon ? 'Live Sheet' : item.label}
                    >
                      <Icon size={item.isFishIcon ? 24 : 20} className={item.isFishIcon ? 'text-white' : ''} />
                      {item.label && !isIconOnlyForAdmin && <span>{item.label}</span>}
                      {item.badge > 0 && (
                        <span
                          className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-purple-900 ${
                            item.badgeCritical > 0 ? 'bg-red-600 animate-pulse' : 'bg-amber-500'
                          }`}
                          data-testid={`nav-alerts-badge-desktop`}
                          title={`${item.badge} unacknowledged alert${item.badge === 1 ? '' : 's'}${item.badgeCritical > 0 ? ` (${item.badgeCritical} critical)` : ''}`}
                        >
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Push Notifications Toggle - Desktop (Staff only) */}
              {isSupported && !isTenantAdmin() && (
                <button
                  onClick={handlePushToggle}
                  className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                    isSubscribed
                      ? 'text-emerald-200 bg-emerald-500/20 hover:bg-emerald-500/30'
                      : 'text-white/70 bg-white/10 hover:bg-white/20'
                  }`}
                  title={isSubscribed ? 'Push notifications enabled - Click to disable' : 'Enable push notifications'}
                >
                  {isSubscribed ? <BellRing size={16} /> : <BellOff size={16} />}
                  <span className="hidden lg:inline">{isSubscribed ? 'Push On' : 'Push Off'}</span>
                </button>
              )}

              <div className="flex items-center space-x-3 pl-4 border-l border-white/25">
                {/* Show email only for staff */}
                {!isTenantAdmin() && <span className="text-sm text-white/85">{user?.email}</span>}
                {isTenantAdmin() && (
                  <div className="flex items-center space-x-2">
                    {isPlatformAdmin() && (
                      <Crown size={20} className="text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.7)]" title="Master Admin" />
                    )}
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${
                      isPlatformAdmin()
                        ? 'bg-gradient-to-r from-amber-300 to-yellow-200 text-amber-900 border border-amber-200 shadow-[0_0_10px_rgba(252,211,77,0.45)]'
                        : 'bg-white/20 text-white border border-white/30'
                    }`}>
                      {isPlatformAdmin() ? '👑 Master Admin' : 'Admin'}
                    </span>
                  </div>
                )}
                {/* Command Centre Button for Super Admin - Desktop */}
                {user?.role === 'super_admin' && (
                  <Link
                    to="/platform"
                    className="flex items-center space-x-2 px-3 py-1.5 bg-white/20 text-white text-sm font-medium rounded-lg hover:bg-white/30 transition-all border border-white/30"
                    title="Tenant Command Centre"
                  >
                    <Building2 size={16} />
                    <span>Command Centre</span>
                  </Link>
                )}
                {/* Show change password only for staff */}
                {!isTenantAdmin() && (
                  <button
                    onClick={() => setShowChangePassword(true)}
                    className="flex items-center p-2 text-white/85 hover:text-white hover:bg-white/15 rounded-md transition-colors"
                    title="Change Password"
                  >
                    <Key size={18} />
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  data-testid="logout-button"
                  className="flex items-center p-2 text-white/85 hover:text-rose-200 hover:bg-rose-500/20 rounded-md transition-colors"
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
