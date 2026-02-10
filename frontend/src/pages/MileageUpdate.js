import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { carAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { Car, Gauge, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';

const MileageUpdate = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const carId = searchParams.get('car');

  const [car, setCar] = useState(null);
  const [mileage, setMileage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (carId) {
      fetchCarDetails();
    } else {
      setError('No car specified');
      setLoading(false);
    }
  }, [carId]);

  const fetchCarDetails = async () => {
    try {
      const response = await carAPI.getDetails(carId);
      setCar(response.data);
      if (response.data.current_mileage) {
        setMileage(response.data.current_mileage.toString());
      }
    } catch (err) {
      setError('Car not found');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const mileageValue = parseInt(mileage, 10);
    if (isNaN(mileageValue) || mileageValue < 0) {
      setError('Please enter a valid mileage');
      setSubmitting(false);
      return;
    }

    try {
      const response = await carAPI.updateMileage(carId, mileageValue);
      setSuccess(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update mileage');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Car Not Found</h2>
          <p className="text-gray-600">{error || 'The car you scanned could not be found.'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Mileage Updated!</h2>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-lg font-semibold text-gray-900">{success.car_name}</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{success.current_mileage.toLocaleString()} km</p>
          </div>
          
          {success.service_warning && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <AlertTriangle className="inline mr-2 text-orange-600" size={20} />
              <span className="text-orange-800 font-medium">{success.service_warning}</span>
            </div>
          )}
          
          <div className="space-y-3 mt-6">
            <button
              onClick={() => navigate(`/bookings?car=${carId}`)}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <span>Book This Car</span>
              <ArrowRight size={18} />
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Car className="text-blue-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{car.name}</h1>
          <p className="text-gray-500">{car.registration}</p>
        </div>

        {car.current_mileage && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-center">
            <p className="text-sm text-gray-500">Last Recorded Mileage</p>
            <p className="text-2xl font-bold text-gray-900">{car.current_mileage.toLocaleString()} km</p>
            {car.last_mileage_update && (
              <p className="text-xs text-gray-400 mt-1">
                Updated: {new Date(car.last_mileage_update).toLocaleString('en-IE')}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Gauge className="inline mr-2" size={18} />
              Current Mileage (km)
            </label>
            <input
              type="number"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="Enter current odometer reading"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
              min="0"
              required
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !mileage}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg"
          >
            {submitting ? 'Updating...' : 'Update Mileage'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Logged in as: {user?.email}
        </p>
      </div>
    </div>
  );
};

export default MileageUpdate;
