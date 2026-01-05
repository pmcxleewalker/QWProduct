import React from 'react';
import { X, MapPin, Calendar, Clock, MessageCircle, CheckCircle } from 'lucide-react';

const LiftAcceptedNotification = ({ notification, onDismiss }) => {
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-bounce-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 px-4 py-4 text-center">
          <div className="flex justify-center mb-2">
            <div className="bg-white rounded-full p-3">
              <CheckCircle size={32} className="text-green-600" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white">Great News! 🎉</h2>
          <p className="text-green-100 text-sm mt-1">Your lift request has been accepted!</p>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Acceptor Info */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-gray-600">Accepted by:</p>
            <p className="text-lg font-bold text-green-700">{notification.accepted_by_name}</p>
            <p className="text-xs text-gray-500">{notification.accepted_by_email}</p>
          </div>

          {/* Lift Details */}
          <div className="space-y-2 text-sm mb-4">
            <div className="flex items-center space-x-2">
              <MapPin size={16} className="text-green-500" />
              <span className="text-gray-600">From:</span>
              <span className="font-medium">{notification.from_location}</span>
            </div>
            <div className="flex items-center space-x-2">
              <MapPin size={16} className="text-red-500" />
              <span className="text-gray-600">To:</span>
              <span className="font-medium">{notification.to_location}</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1 text-gray-600">
                <Calendar size={14} />
                <span>{formatDate(notification.lift_date)}</span>
              </div>
              <div className="flex items-center space-x-1 text-gray-600">
                <Clock size={14} />
                <span>{formatTime(notification.lift_time)}</span>
              </div>
            </div>
          </div>

          {/* Message from acceptor */}
          {notification.message && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-center space-x-2 mb-1">
                <MessageCircle size={14} className="text-blue-600" />
                <span className="text-xs font-medium text-blue-700">Message from {notification.accepted_by_name.split(' ')[0]}:</span>
              </div>
              <p className="text-sm text-gray-700 italic">&ldquo;{notification.message}&rdquo;</p>
            </div>
          )}

          {/* Dismiss Button */}
          <button
            onClick={() => onDismiss(notification.id)}
            className="w-full py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
          >
            Got it, thanks!
          </button>
        </div>
      </div>

      {/* Animation style */}
      <style>{`
        @keyframes bounce-in {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounce-in {
          animation: bounce-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default LiftAcceptedNotification;
