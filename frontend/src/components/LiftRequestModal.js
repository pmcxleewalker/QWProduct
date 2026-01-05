import React, { useState } from 'react';
import { X, MapPin, Clock, Calendar, User, MessageSquare } from 'lucide-react';
import { liftRequestAPI } from '../api/api';

const LiftRequestModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    requester_name: '',
    from_location: '',
    to_location: '',
    lift_date: '',
    lift_time: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await liftRequestAPI.create(formData);
      setFormData({
        requester_name: '',
        from_location: '',
        to_location: '',
        lift_date: '',
        lift_time: '',
        notes: ''
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create lift request');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Get today's date in YYYY-MM-DD format for min date
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-xl">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🙋‍♂️</span>
            <h2 className="text-xl font-bold text-white">Request a Lift</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Who needs the lift */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User size={16} className="inline mr-1" />
              Who needs the lift?
            </label>
            <input
              type="text"
              name="requester_name"
              value={formData.requester_name}
              onChange={handleChange}
              placeholder="Enter your name"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* From location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin size={16} className="inline mr-1 text-green-600" />
              From where?
            </label>
            <input
              type="text"
              name="from_location"
              value={formData.from_location}
              onChange={handleChange}
              placeholder="Pickup location"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* To location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin size={16} className="inline mr-1 text-red-600" />
              To where?
            </label>
            <input
              type="text"
              name="to_location"
              value={formData.to_location}
              onChange={handleChange}
              placeholder="Drop-off location"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar size={16} className="inline mr-1" />
                Date
              </label>
              <input
                type="date"
                name="lift_date"
                value={formData.lift_date}
                onChange={handleChange}
                min={today}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Clock size={16} className="inline mr-1" />
                Time
              </label>
              <input
                type="time"
                name="lift_time"
                value={formData.lift_time}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MessageSquare size={16} className="inline mr-1" />
              Additional Notes (optional)
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any additional information..."
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <span>🙋‍♂️</span>
                <span>Request Lift</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LiftRequestModal;
