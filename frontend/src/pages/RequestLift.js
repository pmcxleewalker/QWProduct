import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Calendar, User, MessageSquare, Car, CheckCircle, ArrowLeft } from 'lucide-react';
import { liftRequestAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';

const RequestLift = () => {
  const navigate = useNavigate();
  const { user, activeTenant } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    from_location: '',
    to_location: '',
    date: new Date().toISOString().split('T')[0],
    time: '',
    seats_needed: 1,
    notes: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await liftRequestAPI.create(formData);
      setSuccess(true);
      
      // Reset form after 3 seconds and go back
      setTimeout(() => {
        navigate(`/${activeTenant?.tenant_slug || ''}`);
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-800 mb-2">Request Submitted!</h2>
          <p className="text-green-600 mb-4">
            Your lift request has been sent to all available drivers.
          </p>
          <p className="text-sm text-green-500">
            You'll receive a notification when someone accepts your request.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg mr-3"
          data-testid="back-button"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Request a Lift</h1>
          <p className="text-sm text-gray-500">Ask a colleague for a ride</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Pickup Location */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <MapPin size={16} className="mr-2 text-green-600" />
            Pickup Location *
          </label>
          <input
            type="text"
            value={formData.from_location}
            onChange={(e) => setFormData({ ...formData, from_location: e.target.value })}
            placeholder="e.g., Office, Home address, etc."
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
            data-testid="pickup-location"
          />
        </div>

        {/* Dropoff Location */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <MapPin size={16} className="mr-2 text-red-500" />
            Dropoff Location *
          </label>
          <input
            type="text"
            value={formData.to_location}
            onChange={(e) => setFormData({ ...formData, to_location: e.target.value })}
            placeholder="e.g., Client site, Station, etc."
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
            data-testid="dropoff-location"
          />
        </div>

        {/* Date and Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Calendar size={16} className="mr-2 text-blue-600" />
              Date *
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              data-testid="date-input"
            />
          </div>
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Clock size={16} className="mr-2 text-purple-600" />
              Time *
            </label>
            <input
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              data-testid="time-input"
            />
          </div>
        </div>

        {/* Passengers */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <User size={16} className="mr-2 text-orange-600" />
            Number of Passengers
          </label>
          <select
            value={formData.seats_needed}
            onChange={(e) => setFormData({ ...formData, seats_needed: parseInt(e.target.value) })}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            data-testid="passengers-select"
          >
            {[1, 2, 3, 4, 5, 6].map(n => (
              <option key={n} value={n}>{n} {n === 1 ? 'passenger' : 'passengers'}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <MessageSquare size={16} className="mr-2 text-gray-600" />
            Additional Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Any special requirements or information..."
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            data-testid="notes-input"
          />
        </div>

        {/* Requester Info */}
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-sm text-gray-500">Requesting as:</p>
          <p className="font-medium text-gray-900">{user?.name || user?.email}</p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:bg-blue-400 flex items-center justify-center space-x-2"
          data-testid="submit-lift-request"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <Car size={20} />
              <span>Submit Lift Request</span>
            </>
          )}
        </button>
      </form>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <h3 className="font-medium text-blue-800 mb-1">How it works</h3>
        <ul className="text-sm text-blue-600 space-y-1">
          <li>• Your request will be visible to all team members</li>
          <li>• Anyone with a vehicle can accept your request</li>
          <li>• You'll be notified when someone accepts</li>
        </ul>
      </div>
    </div>
  );
};

export default RequestLift;
