import React, { useState } from 'react';
import { MapPin, Clock, Calendar, User, Check, X, ChevronDown, ChevronUp, Car } from 'lucide-react';

const LiftRequestsPanel = ({ requests, onAccept, onCancel, currentUserEmail, isAdmin }) => {
  const [expandedId, setExpandedId] = useState(null);

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

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (!requests || requests.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
      <div className="flex items-center mb-2">
        <Car className="text-blue-600 mr-2" size={20} />
        <h2 className="text-base font-bold text-blue-800">
          🙋‍♂️ Lift Requests ({requests.length})
        </h2>
      </div>

      <div className="space-y-2">
        {requests.map((request) => {
          const isOwnRequest = request.requester_email === currentUserEmail;
          const isExpanded = expandedId === request.id;

          return (
            <div
              key={request.id}
              className={`bg-white rounded-lg border transition-all ${
                isOwnRequest ? 'border-blue-400' : 'border-blue-200'
              }`}
            >
              {/* Collapsed Banner View */}
              <div 
                className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleExpand(request.id)}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <User size={14} className="text-blue-600 flex-shrink-0" />
                  <span className="font-medium text-gray-900 text-sm truncate">{request.requester_name}</span>
                  {isOwnRequest && (
                    <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded flex-shrink-0">
                      You
                    </span>
                  )}
                  <span className="text-gray-400 text-xs hidden sm:inline">•</span>
                  <span className="text-xs text-gray-500 truncate hidden sm:inline">
                    {request.from_location} → {request.to_location}
                  </span>
                  <span className="text-gray-400 text-xs hidden md:inline">•</span>
                  <span className="text-xs text-gray-500 hidden md:inline">
                    {formatDate(request.lift_date)} {formatTime(request.lift_time)}
                  </span>
                </div>

                {/* Action Buttons - Always visible */}
                <div className="flex items-center space-x-2 ml-2">
                  {!isOwnRequest && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onAccept(request.id); }}
                      className="flex items-center space-x-1 px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors"
                    >
                      <Check size={12} />
                      <span className="hidden sm:inline">I can help!</span>
                    </button>
                  )}
                  {(isOwnRequest || isAdmin) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onCancel(request.id); }}
                      className="flex items-center space-x-1 px-2 py-1 bg-gray-500 text-white rounded text-xs font-medium hover:bg-gray-600 transition-colors"
                    >
                      <X size={12} />
                      <span className="hidden sm:inline">Dismiss</span>
                    </button>
                  )}
                  <button className="text-gray-400 hover:text-gray-600 p-1">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-gray-100 bg-gray-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <MapPin size={14} className="text-green-500" />
                      <span className="text-gray-600">From:</span>
                      <span className="font-medium text-gray-800">{request.from_location}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin size={14} className="text-red-500" />
                      <span className="text-gray-600">To:</span>
                      <span className="font-medium text-gray-800">{request.to_location}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar size={14} className="text-gray-400" />
                      <span className="text-gray-600">Date:</span>
                      <span className="font-medium text-gray-800">{formatDate(request.lift_date)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock size={14} className="text-gray-400" />
                      <span className="text-gray-600">Time:</span>
                      <span className="font-medium text-gray-800">{formatTime(request.lift_time)}</span>
                    </div>
                  </div>
                  {request.notes && (
                    <p className="mt-2 text-sm text-gray-500 italic bg-white p-2 rounded border border-gray-200">
                      &ldquo;{request.notes}&rdquo;
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiftRequestsPanel;
