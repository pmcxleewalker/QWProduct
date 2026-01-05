import React, { useState } from 'react';
import { X, Send, MapPin, Calendar, Clock, User } from 'lucide-react';

const AcceptLiftModal = ({ isOpen, onClose, onAccept, request }) => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onAccept(request.id, message);
      setMessage('');
      onClose();
    } catch (error) {
      console.error('Error accepting lift:', error);
    } finally {
      setLoading(false);
    }
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

  if (!isOpen || !request) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🚗</span>
            <h2 className="text-lg font-bold text-white">Accept Lift Request</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Request Details */}
        <div className="p-4 bg-gray-50 border-b">
          <div className="flex items-center space-x-2 mb-2">
            <User size={16} className="text-blue-600" />
            <span className="font-bold text-gray-900">{request.requester_name}</span>
            <span className="text-gray-500 text-sm">needs a lift</span>
          </div>
          
          <div className="space-y-1 text-sm">
            <div className="flex items-center space-x-2">
              <MapPin size={14} className="text-green-500" />
              <span className="text-gray-600">From:</span>
              <span className="font-medium">{request.from_location}</span>
            </div>
            <div className="flex items-center space-x-2">
              <MapPin size={14} className="text-red-500" />
              <span className="text-gray-600">To:</span>
              <span className="font-medium">{request.to_location}</span>
            </div>
            <div className="flex items-center space-x-4 mt-2">
              <div className="flex items-center space-x-1 text-gray-600">
                <Calendar size={14} />
                <span>{formatDate(request.lift_date)}</span>
              </div>
              <div className="flex items-center space-x-1 text-gray-600">
                <Clock size={14} />
                <span>{formatTime(request.lift_time)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Message Form */}
        <form onSubmit={handleSubmit} className="p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Send a message to {request.requester_name.split(' ')[0]}:
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g., I'll pick you up at the front entrance. My car is a blue Toyota."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none text-sm"
          />
          
          <div className="flex space-x-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <Send size={16} />
                  <span>Accept & Send</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AcceptLiftModal;
