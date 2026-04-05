import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Car, Gauge, CheckCircle, AlertTriangle, User, ArrowRight } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const MileageLog = () => {
  const { tenantSlug, vehicleId } = useParams();
  const navigate = useNavigate();
  
  const [vehicle, setVehicle] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [mileage, setMileage] = useState('');
  const [submittedByName, setSubmittedByName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetchVehiclePublic();
  }, [tenantSlug, vehicleId]);

  const fetchVehiclePublic = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use PUBLIC endpoint - no auth required
      const response = await axios.get(`${API}/api/public/vehicle/${tenantSlug}/${vehicleId}`);
      setVehicle(response.data.vehicle);
      setTenant(response.data.tenant);
      // Pre-fill with last known mileage
      if (response.data.vehicle.current_mileage) {
        setMileage(response.data.vehicle.current_mileage.toString());
      }
    } catch (err) {
      console.error('Failed to fetch vehicle:', err);
      if (err.response?.status === 404) {
        setError('Vehicle or organisation not found');
      } else {
        setError('Failed to load vehicle information');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const mileageValue = parseInt(mileage, 10);
    if (isNaN(mileageValue) || mileageValue < 0) {
      toast.error('Please enter a valid mileage');
      return;
    }
    
    // Validate mileage is not less than previous
    if (vehicle?.current_mileage && mileageValue < vehicle.current_mileage) {
      toast.error(`Mileage cannot be less than current reading (${vehicle.current_mileage} km)`);
      return;
    }
    
    setSubmitting(true);
    try {
      // Use PUBLIC endpoint - no auth required
      const response = await axios.post(`${API}/api/public/vehicle/${tenantSlug}/${vehicleId}/submit-mileage`, {
        mileage: mileageValue,
        submitted_by_name: submittedByName || undefined,
        notes: notes || undefined
      });
      
      setResult(response.data);
      toast.success('Mileage submitted successfully!');
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit mileage');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading vehicle information...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden text-center p-8">
          <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Success State
  if (submitted && result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden text-center p-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={48} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Mileage Submitted!</h2>
          <p className="text-gray-600 mb-4">
            <span className="font-semibold">{result.vehicle_name}</span> - {result.registration}
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-500">Previous:</span>
              <span className="font-semibold">{result.previous_mileage?.toLocaleString() || 0} km</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-500">New:</span>
              <span className="font-bold text-green-600 text-lg">{result.new_mileage?.toLocaleString()} km</span>
            </div>
            {result.previous_mileage && result.new_mileage > result.previous_mileage && (
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-gray-500">Added:</span>
                <span className="text-blue-600 font-medium">+{(result.new_mileage - result.previous_mileage).toLocaleString()} km</span>
              </div>
            )}
          </div>
          
          {result.service_alert && (
            <div className={`rounded-lg p-4 mb-4 ${
              result.service_alert.type === 'overdue' ? 'bg-red-50 border border-red-200' :
              result.service_alert.type === 'urgent' ? 'bg-orange-50 border border-orange-200' :
              'bg-yellow-50 border border-yellow-200'
            }`}>
              <AlertTriangle className={`inline mr-2 ${
                result.service_alert.type === 'overdue' ? 'text-red-500' :
                result.service_alert.type === 'urgent' ? 'text-orange-500' :
                'text-yellow-500'
              }`} size={18} />
              <span className={`text-sm ${
                result.service_alert.type === 'overdue' ? 'text-red-700' :
                result.service_alert.type === 'urgent' ? 'text-orange-700' :
                'text-yellow-700'
              }`}>
                {result.service_alert.message}
              </span>
            </div>
          )}
          
          <p className="text-gray-500 text-sm mb-6">
            Submitted by: {result.submitted_by}
          </p>
          
          <button
            onClick={() => {
              setSubmitted(false);
              setResult(null);
              setMileage('');
              setNotes('');
              fetchVehiclePublic();
            }}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Submit Another Reading
          </button>
        </div>
      </div>
    );
  }

  // Mileage Input Form - PUBLIC (no login required)
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header with Vehicle Info */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Car size={28} />
            </div>
            <div>
              <h1 className="text-xl font-bold">{vehicle?.name || 'Unknown Vehicle'}</h1>
              <p className="text-blue-100">{vehicle?.registration || ''}</p>
            </div>
          </div>
          
          {tenant && (
            <p className="text-blue-200 text-sm">{tenant.name}</p>
          )}
          
          {vehicle?.current_mileage && (
            <div className="bg-white/10 rounded-lg p-3 mt-4">
              <p className="text-blue-100 text-xs">Last Recorded Mileage</p>
              <p className="text-2xl font-bold">{vehicle.current_mileage.toLocaleString()} km</p>
              {vehicle.last_mileage_update && (
                <p className="text-blue-200 text-xs mt-1">
                  Updated: {new Date(vehicle.last_mileage_update).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Mileage Input */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Gauge size={18} className="mr-2 text-blue-600" />
              Current Mileage (km) *
            </label>
            <input
              type="number"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              className="w-full px-4 py-4 text-2xl font-bold text-center border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter odometer reading"
              min="0"
              required
              autoFocus
              data-testid="mileage-input"
            />
            {vehicle?.current_mileage && mileage && parseInt(mileage) > vehicle.current_mileage && (
              <p className="text-sm text-green-600 mt-2 text-center">
                +{(parseInt(mileage) - vehicle.current_mileage).toLocaleString()} km since last reading
              </p>
            )}
          </div>
          
          {/* Name Input (Optional) */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <User size={18} className="mr-2 text-gray-500" />
              Your Name (optional)
            </label>
            <input
              type="text"
              value={submittedByName}
              onChange={(e) => setSubmittedByName(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your name"
              data-testid="name-input"
            />
          </div>
          
          {/* Notes Input (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Any issues or comments..."
              rows={3}
              data-testid="notes-input"
            />
          </div>
          
          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || !mileage}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 flex items-center justify-center space-x-2"
            data-testid="submit-mileage-btn"
          >
            {submitting ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle size={22} />
                <span>Submit Mileage</span>
              </>
            )}
          </button>
          
          <p className="text-center text-xs text-gray-400">
            No login required - just scan and submit
          </p>
        </form>
      </div>
    </div>
  );
};

export default MileageLog;
