import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Bell, X, AlertTriangle, Info, CheckCircle, Volume2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NotificationBell = ({ onAnnouncementClick }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingAnnouncements, setPendingAnnouncements] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState(null);
  const lastCheckRef = useRef(null);
  const dropdownRef = useRef(null);

  // Fetch pending announcements
  const fetchPending = useCallback(async () => {
    try {
      const [countRes, pendingRes] = await Promise.all([
        axios.get(`${API}/announcements/unread-count`),
        axios.get(`${API}/announcements/pending`)
      ]);
      
      const newCount = countRes.data.count || 0;
      const announcements = pendingRes.data || [];
      
      // Check for new announcements since last check
      if (lastCheckRef.current && announcements.length > 0) {
        const latestAnnouncement = announcements[0];
        const latestTime = new Date(latestAnnouncement.created_at).getTime();
        
        if (latestTime > lastCheckRef.current) {
          // New announcement detected - show toast
          setNewAnnouncement(latestAnnouncement);
          
          // Play notification sound
          playNotificationSound();
          
          // Auto-hide toast after 8 seconds
          setTimeout(() => setNewAnnouncement(null), 8000);
        }
      }
      
      lastCheckRef.current = Date.now();
      setUnreadCount(newCount);
      setPendingAnnouncements(announcements);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, []);

  // Play notification sound
  const playNotificationSound = () => {
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.15);
      
      // Second beep
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.frequency.value = 1000;
        osc2.type = 'sine';
        gain2.gain.value = 0.1;
        osc2.start();
        osc2.stop(audioContext.currentTime + 0.15);
      }, 150);
    } catch (e) {
      console.log('Audio not supported');
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchPending();
    
    // Poll every 30 seconds
    const interval = setInterval(fetchPending, 30000);
    
    return () => clearInterval(interval);
  }, [fetchPending]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAcknowledge = async (announcementId) => {
    try {
      await axios.post(`${API}/messages/${announcementId}/acknowledge`);
      fetchPending(); // Refresh
    } catch (err) {
      console.error('Failed to acknowledge:', err);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'low': return 'text-gray-500 bg-gray-50';
      default: return 'text-blue-600 bg-blue-50';
    }
  };

  return (
    <>
      {/* Notification Bell */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          data-testid="notification-bell"
        >
          <Bell size={22} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border z-50 overflow-hidden">
            <div className="p-3 border-b bg-gray-50">
              <h4 className="font-semibold text-gray-900">Notifications</h4>
              <p className="text-xs text-gray-500">
                {unreadCount > 0 ? `${unreadCount} unread announcement${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
              </p>
            </div>
            
            <div className="max-h-80 overflow-y-auto">
              {pendingAnnouncements.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
                  <p className="text-sm">No pending announcements</p>
                </div>
              ) : (
                pendingAnnouncements.map(announcement => (
                  <div 
                    key={announcement.id} 
                    className="p-3 border-b hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPriorityColor(announcement.priority)}`}>
                            {announcement.priority?.toUpperCase()}
                          </span>
                        </div>
                        <h5 className="font-medium text-gray-900 text-sm">{announcement.title}</h5>
                        <p className="text-xs text-gray-600 line-clamp-2 mt-1">{announcement.content}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(announcement.created_at).toLocaleDateString('en-IE', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                      {announcement.requires_acknowledgment && (
                        <button
                          onClick={() => handleAcknowledge(announcement.id)}
                          className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Ack
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {pendingAnnouncements.length > 0 && (
              <div className="p-2 border-t bg-gray-50">
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    if (onAnnouncementClick) onAnnouncementClick();
                  }}
                  className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  View All Announcements
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast Notification for New Announcements */}
      {newAnnouncement && (
        <div 
          className="fixed top-4 right-4 z-50 animate-slide-in-right"
          data-testid="announcement-toast"
        >
          <div className={`w-80 bg-white rounded-xl shadow-2xl border-l-4 ${
            newAnnouncement.priority === 'urgent' ? 'border-l-red-500' :
            newAnnouncement.priority === 'high' ? 'border-l-orange-500' :
            'border-l-blue-500'
          } overflow-hidden`}>
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <Volume2 size={18} className="text-blue-600" />
                  <span className="text-sm font-semibold text-gray-900">New Announcement</span>
                </div>
                <button 
                  onClick={() => setNewAnnouncement(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-2">
                <h5 className="font-medium text-gray-900">{newAnnouncement.title}</h5>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{newAnnouncement.content}</p>
              </div>
              {newAnnouncement.requires_acknowledgment && (
                <button
                  onClick={() => {
                    handleAcknowledge(newAnnouncement.id);
                    setNewAnnouncement(null);
                  }}
                  className="mt-3 w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  Acknowledge
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CSS for animation */}
      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default NotificationBell;
