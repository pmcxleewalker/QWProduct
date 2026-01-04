import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { carAPI, statusAPI } from '../api/api';
import { CheckCircle, AlertCircle } from 'lucide-react';

const StatusUpdate = () => {
  const [searchParams] = useSearchParams();
  const carId = searchParams.get('car');
  
  const [car, setCar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    status: 'Free',
    notes: '',
    user_name: '',
    location: '',
  });

  useEffect(() => {
    if (carId) {
      fetchCar();
    } else {
      setLoading(false);
      setError('No car ID provided. Please scan a valid QR code.');
    }
  }, [carId]);

  const fetchCar = async () => {
    try {
      const response = await carAPI.getById(carId);
      setCar(response.data);
      setFormData({ ...formData, status: response.data.current_status });
    } catch (err) {
      setError('Car not found. Please check the QR code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess(false);

    try {
      await statusAPI.create({
        car_id: carId,
        status: formData.status,
        notes: formData.notes,
        user_name: formData.user_name || 'Anonymous',
        location: formData.location,
      });
      setSuccess(true);
      setFormData({ status: formData.status, notes: '', user_name: '', location: '' });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update status');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !car) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="mx-auto text-red-500" size={48} />
          <h2 className="text-xl font-bold text-red-900 mt-4">Error</h2>
          <p className="text-red-700 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2" data-testid="status-update-title">
          Update Car Status
        </h1>
        
        {car && (
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-bold text-blue-900">{car.name}</h2>
            <p className="text-sm text-blue-700">{car.registration}</p>
            <p className="text-xs text-blue-600 mt-1">Current: {car.current_status}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center" data-testid="success-message">
            <CheckCircle className="text-green-500 mr-3" size={24} />
            <div>
              <h3 className="font-semibold text-green-900">Status Updated!</h3>
              <p className="text-sm text-green-700">The car status has been updated successfully.</p>
            </div>
          </div>
        )}

        {error && car && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6" data-testid="error-message">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Status Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status *
            </label>
            <select
              data-testid="status-select"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="Free">Free</option>
              <option value="In Use">In Use</option>
              <option value="Needs Cleaning">Needs Cleaning</option>
              <option value="Needs Repair">Needs Repair</option>
            </select>
          </div>

          {/* User Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Name (Optional)
            </label>
            <input
              type="text"
              data-testid="user-name-input"
              value={formData.user_name}
              onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your name"
            />
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              data-testid="notes-textarea"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="3"
              placeholder="Any additional notes..."
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            data-testid="submit-status-button"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {submitting ? 'Updating...' : 'Update Status'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default StatusUpdate;