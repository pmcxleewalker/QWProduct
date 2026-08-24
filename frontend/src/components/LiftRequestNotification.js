import React from 'react';
import { X, Check, MapPin, Clock, Calendar, User } from 'lucide-react';

const LiftRequestNotification = ({ request, onAccept, onClose, currentUserEmail }) => {
  const isOwnRequest = request.requester_email === currentUserEmail;

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
    <div className="fixed top-20 right-4 z-50 animate-slide-in">
      <div className="bg-white rounded-xl shadow-2xl border-2 border-blue-500 w-80 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl"></span>
            <span className="text-white font-bold">Lift Request!</span>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <div className="flex items-center space-x-2 text-gray-700">
            <User size={16} className="text-blue-500" />
            <span className="font-medium">{request.requester_name}</span>
            {isOwnRequest && (
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded">
                Your request
              </span>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-start space-x-2">
              <MapPin size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-gray-500">From:</span>
                <span className="ml-1 text-gray-800">{request.from_location}</span>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <MapPin size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-gray-500">To:</span>
                <span className="ml-1 text-gray-800">{request.to_location}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center space-x-1">
              <Calendar size={14} />
              <span>{formatDate(request.lift_date)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock size={14} />
              <span>{formatTime(request.lift_time)}</span>
            </div>
          </div>

          {request.notes && (
            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
              <em>&ldquo;{request.notes}&rdquo;</em>
            </div>
          )}
        </div>

        {/* Actions */}
        {!isOwnRequest && (
          <div className="px-4 pb-4">
            <button
              onClick={() => onAccept(request.id)}
              className="w-full py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
            >
              <Check size={18} />
              <span>I can help!</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiftRequestNotification;
