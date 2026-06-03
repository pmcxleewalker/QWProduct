import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, FileText, Save, Car, RefreshCw, AlertTriangle } from 'lucide-react';
import { bookingAPI, carAPI } from '../api/api';

const EditBookingModal = ({ isOpen, onClose, booking, onSuccess }) => {
  const [formData, setFormData] = useState({
    user_name: '',
    start_time: '',
    end_time: '',
    notes: '',
    car_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableCars, setAvailableCars] = useState([]);
  const [loadingCars, setLoadingCars] = useState(false);
  const [showCarSwap, setShowCarSwap] = useState(false);
  const [currentCarName, setCurrentCarName] = useState('');

  useEffect(() => {
    if (booking) {
      // Format dates for datetime-local input
      const formatForInput = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toISOString().slice(0, 16);
      };
      
      setFormData({
        user_name: booking.user_name || '',
        start_time: formatForInput(booking.start_time),
        end_time: formatForInput(booking.end_time),
        // Backend stores the field as `notes`; fall back to legacy
        // `destination_notes` for any old data, then default to ''.
        notes: booking.notes ?? booking.destination_notes ?? '',
        car_id: booking.car_id || '',
      });
      
      // Get current car name
      fetchCurrentCarName(booking.car_id);
    }
  }, [booking]);

  const fetchCurrentCarName = async (carId) => {
    try {
      const response = await carAPI.getAll();
      const car = response.data.find(c => c.id === carId);
      setCurrentCarName(car ? `${car.name} (${car.registration})` : 'Unknown Car');
    } catch (err) {
      console.error('Error fetching car name:', err);
    }
  };

  const fetchAvailableCars = async () => {
    if (!formData.start_time || !formData.end_time) {
      setError('Please set start and end times first');
      return;
    }
    
    setLoadingCars(true);
    setError('');
    
    try {
      const startISO = new Date(formData.start_time).toISOString();
      const endISO = new Date(formData.end_time).toISOString();
      
      const response = await bookingAPI.getAvailableCars(startISO, endISO, booking?.id);
      setAvailableCars(response.data || []);
      setShowCarSwap(true);
    } catch (err) {
      setError('Failed to load available cars');
      console.error('Error fetching available cars:', err);
    } finally {
      setLoadingCars(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const updateData = {
        user_name: formData.user_name,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
        notes: formData.notes,
      };
      
      // Include car_id if changed
      if (formData.car_id && formData.car_id !== booking.car_id) {
        updateData.car_id = formData.car_id;
      }
      
      await bookingAPI.update(booking.id, updateData);
      alert('Booking updated successfully!');
      onSuccess?.();
      onClose();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to update booking';
      setError(errorMsg);
      alert('Update failed: ' + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !booking) return null;

  const isRecurring = !!booking.recurring_group_id;
  const carChanged = formData.car_id && formData.car_id !== booking.car_id;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 flex items-center justify-between sticky top-0">
          <div className="flex items-center space-x-2">
            <Calendar size={20} className="text-white" />
            <h2 className="text-lg font-bold text-white">Edit Booking</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Recurring Warning */}
        {isRecurring && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
            <p className="text-sm text-yellow-800">
              ⚠️ This is part of a recurring series. Changes will only affect this individual booking.
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Current Car Display */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  <Car size={12} className="inline mr-1" />
                  Current Car
                </label>
                <p className="text-sm font-semibold text-gray-900">{currentCarName}</p>
              </div>
              <button
                type="button"
                onClick={fetchAvailableCars}
                disabled={loadingCars}
                className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg transition-colors disabled:opacity-50"
              >
                {loadingCars ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Car size={14} />
                )}
                <span>{showCarSwap ? 'Refresh Cars' : 'Swap Car'}</span>
              </button>
            </div>
          </div>

          {/* Car Swap Dropdown */}
          {showCarSwap && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <label className="block text-sm font-medium text-orange-800 mb-2">
                <AlertTriangle size={14} className="inline mr-1" />
                Swap to Available Car
              </label>
              {availableCars.length > 0 ? (
                <select
                  value={formData.car_id}
                  onChange={(e) => setFormData({ ...formData, car_id: e.target.value })}
                  className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white text-sm"
                >
                  <option value={booking.car_id}>Keep current: {currentCarName}</option>
                  {availableCars
                    .filter(car => car.id !== booking.car_id)
                    .map(car => (
                      <option key={car.id} value={car.id}>
                        {car.name} ({car.registration})
                      </option>
                    ))}
                </select>
              ) : (
                <p className="text-sm text-orange-700 italic">No other cars available for this time slot</p>
              )}
              {carChanged && (
                <p className="text-xs text-green-700 mt-2 font-medium">
                  ✓ Car will be changed when you save
                </p>
              )}
            </div>
          )}

          {/* User Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User size={14} className="inline mr-1" />
              Booked For
            </label>
            <input
              type="text"
              value={formData.user_name}
              onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock size={14} className="inline mr-1" />
              Start Time
            </label>
            <input
              type="datetime-local"
              value={formData.start_time}
              onChange={(e) => {
                setFormData({ ...formData, start_time: e.target.value });
                setShowCarSwap(false); // Reset car swap when times change
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* End Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock size={14} className="inline mr-1" />
              End Time
            </label>
            <input
              type="datetime-local"
              value={formData.end_time}
              onChange={(e) => {
                setFormData({ ...formData, end_time: e.target.value });
                setShowCarSwap(false); // Reset car swap when times change
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Destination Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FileText size={14} className="inline mr-1" />
              Destination / Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Optional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 px-4 py-2 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors ${
                carChanged 
                  ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              } disabled:opacity-50`}
            >
              {loading ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              <span>{carChanged ? 'Save & Swap Car' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditBookingModal;
