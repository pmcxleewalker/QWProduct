import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bell, X, AlertTriangle, Info, CheckCircle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AnnouncementBanner = ({ onDismiss }) => {
  const [pendingAnnouncements, setPendingAnnouncements] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [acknowledging, setAcknowledging] = useState(false);

  useEffect(() => {
    fetchPendingAnnouncements();
  }, []);

  const fetchPendingAnnouncements = async () => {
    try {
      const response = await axios.get(`${API}/announcements/pending`);
      setPendingAnnouncements(response.data || []);
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
    }
  };

  const handleAcknowledge = async (announcementId) => {
    setAcknowledging(true);
    try {
      await axios.post(`${API}/messages/${announcementId}/acknowledge`);
      
      // Move to next or close
      if (currentIndex < pendingAnnouncements.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setPendingAnnouncements([]);
        if (onDismiss) onDismiss();
      }
    } catch (err) {
      console.error('Failed to acknowledge:', err);
    } finally {
      setAcknowledging(false);
    }
  };

  if (pendingAnnouncements.length === 0) return null;

  const current = pendingAnnouncements[currentIndex];
  if (!current) return null;

  const getPriorityStyles = (priority) => {
    switch (priority) {
      case 'urgent':
        return {
          bg: 'bg-red-50 border-red-200',
          icon: <AlertTriangle className="text-red-500" size={20} />,
          badge: 'bg-red-100 text-red-700'
        };
      case 'high':
        return {
          bg: 'bg-orange-50 border-orange-200',
          icon: <AlertTriangle className="text-orange-500" size={20} />,
          badge: 'bg-orange-100 text-orange-700'
        };
      case 'low':
        return {
          bg: 'bg-gray-50 border-gray-200',
          icon: <Info className="text-gray-500" size={20} />,
          badge: 'bg-gray-100 text-gray-700'
        };
      default:
        return {
          bg: 'bg-blue-50 border-blue-200',
          icon: <Bell className="text-blue-500" size={20} />,
          badge: 'bg-blue-100 text-blue-700'
        };
    }
  };

  const styles = getPriorityStyles(current.priority);

  return (
    <div 
      className={`${styles.bg} border rounded-lg p-4 mb-4`}
      data-testid="announcement-banner"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {styles.icon}
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="font-semibold text-gray-900">{current.title}</h4>
              <span className={`text-xs px-2 py-0.5 rounded-full ${styles.badge}`}>
                {current.priority?.toUpperCase() || 'NORMAL'}
              </span>
              {pendingAnnouncements.length > 1 && (
                <span className="text-xs text-gray-500">
                  ({currentIndex + 1} of {pendingAnnouncements.length})
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700">{current.content}</p>
            <p className="text-xs text-gray-500 mt-2">
              Posted by {current.created_by?.split('@')[0]} • {' '}
              {new Date(current.created_at).toLocaleDateString('en-IE', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
        </div>
        
        {current.requires_acknowledgment && (
          <button
            onClick={() => handleAcknowledge(current.id)}
            disabled={acknowledging}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 ml-4"
            data-testid="acknowledge-btn"
          >
            <CheckCircle size={16} />
            <span>{acknowledging ? 'Saving...' : 'Acknowledge'}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default AnnouncementBanner;
