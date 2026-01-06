import React, { useState } from 'react';
import { X, XCircle, MessageSquare, AlertTriangle } from 'lucide-react';

const RejectBookingModal = ({ isOpen, onClose, onReject, booking }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reason is required
    if (!reason.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      await onReject(booking.group_id, reason);
      setReason('');
      onClose();
    } catch (error) {
      console.error('Error rejecting booking:', error);
      setError('Failed to reject booking');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !booking) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <XCircle size={20} className="text-white" />
            <h2 className="text-lg font-bold text-white">Reject Booking</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Booking Info */}
        <div className="p-4 bg-red-50 border-b">
          <p className="text-sm text-gray-700">
            Rejecting <span className="font-bold capitalize">{booking.recurrence_type}</span> booking for <span className="font-bold">{booking.user_name}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {booking.bookings?.length || 1} booking(s) will be removed
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center">
              <AlertTriangle size={16} className="mr-2" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MessageSquare size={14} className="inline mr-1" />
              Reason for Rejection <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
              placeholder="e.g., Vehicle already booked for maintenance, conflicting schedules..."
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              This reason will be sent to the staff member who made the request.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !reason.trim()}
              className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Reject Booking'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RejectBookingModal;
