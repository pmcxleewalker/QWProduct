import React from 'react';
import { MapPin, Clock, Calendar, User, Check, X, Car } from 'lucide-react';

const LiftRequestsPanel = ({ requests, onAccept, onCancel, currentUserEmail, isAdmin }) => {
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

  if (!requests || requests.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
      <div className="flex items-center mb-3">
        <Car className="text-blue-600 mr-2" size={24} />
        <h2 className="text-lg font-bold text-blue-800">
          🙋‍♂️ Active Lift Requests ({requests.length})
        </h2>
      </div>

      <div className="space-y-3">
        {requests.map((request) => {
          const isOwnRequest = request.requester_email === currentUserEmail;
          const canCancel = isOwnRequest || isAdmin;

          return (
            <div
              key={request.id}
              className={`bg-white rounded-lg p-4 border ${
                isOwnRequest ? 'border-blue-400 bg-blue-50' : 'border-blue-200'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex-1">
                  {/* Requester Info */}
                  <div className="flex items-center space-x-2 mb-2">
                    <User size={16} className="text-blue-600" />
                    <span className="font-bold text-gray-900">{request.requester_name}</span>
                    {isOwnRequest && (
                      <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded">
                        Your request
                      </span>
                    )}
                  </div>

                  {/* Locations */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center space-x-1">
                      <MapPin size={14} className="text-green-500" />
                      <span className="text-gray-600">From:</span>
                      <span className="font-medium text-gray-800">{request.from_location}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <MapPin size={14} className="text-red-500" />
                      <span className="text-gray-600">To:</span>
                      <span className="font-medium text-gray-800">{request.to_location}</span>
                    </div>
                  </div>

                  {/* Date/Time */}
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Calendar size={14} />
                      <span>{formatDate(request.lift_date)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock size={14} />
                      <span>{formatTime(request.lift_time)}</span>
                    </div>
                  </div>

                  {/* Notes */}
                  {request.notes && (
                    <p className="mt-2 text-sm text-gray-500 italic">"{request.notes}"</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex space-x-2">
                  {!isOwnRequest && (
                    <button
                      onClick={() => onAccept(request.id)}
                      className="flex items-center space-x-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
                    >
                      <Check size={16} />
                      <span>I can help!</span>
                    </button>
                  )}
                  {canCancel && (
                    <button
                      onClick={() => onCancel(request.id)}
                      className="flex items-center space-x-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm font-medium transition-colors"
                    >
                      <X size={16} />
                      <span>{isOwnRequest ? 'Cancel' : 'Remove'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiftRequestsPanel;
