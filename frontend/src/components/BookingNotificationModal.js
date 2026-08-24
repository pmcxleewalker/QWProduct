import React from 'react';
import { CheckCircle, XCircle, Calendar, Clock, Car, MessageSquare } from 'lucide-react';

const BookingNotificationModal = ({ notification, onDismiss }) => {
  const isApproved = notification.type === 'booking_approved';
  
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-bounce-in">
        {/* Header */}
        <div className={`px-4 py-4 text-center ${isApproved ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-red-600'}`}>
          <div className="flex justify-center mb-2">
            <div className="bg-white rounded-full p-3">
              {isApproved ? (
                <CheckCircle size={32} className="text-green-600" />
              ) : (
                <XCircle size={32} className="text-red-600" />
              )}
            </div>
          </div>
          <h2 className="text-xl font-bold text-white">
            {isApproved ? 'Booking Approved!' : 'Booking Rejected'}
          </h2>
          <p className={`text-sm mt-1 ${isApproved ? 'text-green-100' : 'text-red-100'}`}>
            {isApproved 
              ? 'Your booking request has been approved!' 
              : 'Unfortunately, your booking request was rejected.'}
          </p>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Booking Details */}
          <div className={`rounded-lg p-3 mb-4 ${isApproved ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <Car size={16} className="text-gray-500" />
                <span className="text-gray-600">Booked for:</span>
                <span className="font-medium">{notification.user_name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar size={16} className="text-gray-500" />
                <span className="text-gray-600">Starting:</span>
                <span className="font-medium">{formatDateTime(notification.start_time)}</span>
              </div>
              {notification.recurrence_type && (
                <div className="flex items-center space-x-2">
                  <Clock size={16} className="text-gray-500" />
                  <span className="text-gray-600">Recurrence:</span>
                  <span className="font-medium capitalize">{notification.recurrence_type} × {notification.booking_count} bookings</span>
                </div>
              )}
            </div>
          </div>

          {/* Admin Info */}
          <div className="text-sm text-gray-600 mb-4">
            <p>
              {isApproved ? 'Approved' : 'Rejected'} by: <span className="font-medium">{notification.approved_by || notification.rejected_by}</span>
            </p>
          </div>

          {/* Rejection Reason - Highlighted */}
          {!isApproved && notification.rejection_reason && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <MessageSquare size={16} className="text-red-600" />
                <span className="text-sm font-bold text-red-700">Reason for Rejection:</span>
              </div>
              <p className="text-sm text-gray-800 italic">&ldquo;{notification.rejection_reason}&rdquo;</p>
            </div>
          )}

          {/* Dismiss Button */}
          <button
            onClick={() => onDismiss(notification.id)}
            className={`w-full py-3 text-white font-semibold rounded-lg transition-colors ${
              isApproved 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            {isApproved ? 'Great, thanks!' : 'I understand'}
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

export default BookingNotificationModal;
