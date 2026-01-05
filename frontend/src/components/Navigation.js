import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, PhoneCall, Settings, LogOut, FileSpreadsheet, Bell, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { liftRequestAPI } from '../api/api';
import LiftRequestModal from './LiftRequestModal';
import LiftRequestNotification from './LiftRequestNotification';

const Navigation = () => {
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const [liftRequestCount, setLiftRequestCount] = useState(0);
  const [showLiftModal, setShowLiftModal] = useState(false);
  const [newRequest, setNewRequest] = useState(null);
  const [lastSeenRequestIds, setLastSeenRequestIds] = useState(new Set());
  
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

  const fetchLiftRequestCount = useCallback(async () => {
    try {
      const [countRes, requestsRes] = await Promise.all([
        liftRequestAPI.getCount(),
        liftRequestAPI.getActive()
      ]);
      
      setLiftRequestCount(countRes.data.count);
      
      // Check for new requests (for notification popup)
      const currentRequests = requestsRes.data;
      const currentIds = new Set(currentRequests.map(r => r.id));
      
      // Find new requests that we haven't seen before
      for (const request of currentRequests) {
        if (!lastSeenRequestIds.has(request.id) && request.requester_email !== user?.email) {
          setNewRequest(request);
          break;
        }
      }
      
      setLastSeenRequestIds(currentIds);
    } catch (error) {
      console.error('Error fetching lift request count:', error);
    }
  }, [lastSeenRequestIds, user?.email]);

  useEffect(() => {
    if (user) {
      fetchLiftRequestCount();
      // Poll for new lift requests every 15 seconds
      const interval = setInterval(fetchLiftRequestCount, 15000);
      return () => clearInterval(interval);
    }
  }, [user, fetchLiftRequestCount]);

  const handleAcceptLift = async (requestId) => {
    try {
      await liftRequestAPI.accept(requestId);
      setNewRequest(null);
      fetchLiftRequestCount();
    } catch (error) {
      console.error('Error accepting lift request:', error);
      alert(error.response?.data?.detail || 'Failed to accept lift request');
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleLiftRequestSuccess = () => {
    fetchLiftRequestCount();
  };

  return (
    <>
      {/* Mobile Top Header */}
      <nav className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
        <div className="flex justify-between items-center h-14 px-4">
          <h1 className="text-xl font-bold text-blue-600">Quick Wing</h1>
          <div className="flex items-center space-x-2">
            {/* Request Lift Button - Mobile */}
            <button
              onClick={() => setShowLiftModal(true)}
              className="flex items-center p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              title="Request a Lift"
            >
              <Plus size={20} />
            </button>
            
            {/* Notification Bell - Mobile */}
            <button
              onClick={() => window.location.href = '/#lift-requests'}
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
            
            <span className="text-xs text-gray-600">{user?.email?.split('@')[0]}</span>
            {isAdmin() && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                Admin
              </span>
            )}
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
              
              {/* Request Lift Button */}
              <button
                onClick={() => setShowLiftModal(true)}
                className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title="Request a Lift"
              >
                <span>🙋‍♂️</span>
                <span className="hidden lg:inline">Request Lift</span>
              </button>
              
              {/* Notification Bell */}
              <button
                onClick={() => window.location.href = '/#lift-requests'}
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
              
              <div className="flex items-center space-x-3 pl-4 border-l border-gray-200">
                <span className="text-sm text-gray-700">{user?.email}</span>
                {isAdmin() && (
                  <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                    Admin
                  </span>
                )}
                <button
                  onClick={handleLogout}
                  data-testid="logout-button"
                  className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Lift Request Modal */}
      <LiftRequestModal
        isOpen={showLiftModal}
        onClose={() => setShowLiftModal(false)}
        onSuccess={handleLiftRequestSuccess}
      />

      {/* New Lift Request Notification Popup */}
      {newRequest && (
        <LiftRequestNotification
          request={newRequest}
          onAccept={handleAcceptLift}
          onClose={() => setNewRequest(null)}
          currentUserEmail={user?.email}
        />
      )}

      {/* CSS for animation */}
      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default Navigation;
