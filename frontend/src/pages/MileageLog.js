import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Car, Gauge, CheckCircle, AlertTriangle, ArrowRight, User } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const MileageLog = () => {
  const { tenantSlug, vehicleId } = useParams();
  const navigate = useNavigate();
  const { user, activeTenant, isAuthenticated, login } = useAuth();
  
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mileage, setMileage] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  
  // Login form state (if not authenticated)
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    // Check if user is authenticated and belongs to this tenant
    if (isAuthenticated && activeTenant?.tenant_slug === tenantSlug) {
      fetchVehicle();
    } else if (isAuthenticated && activeTenant?.tenant_slug !== tenantSlug) {
      // User is logged in but to a different tenant
      setShowLogin(true);
      setLoading(false);
    } else {
      // Not authenticated
      setShowLogin(true);
      setLoading(false);
    }
  }, [isAuthenticated, activeTenant, tenantSlug, vehicleId]);

  const fetchVehicle = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/api/vehicles/${vehicleId}`);
      setVehicle(response.data);
      // Pre-fill with last known mileage
      if (response.data.current_mileage) {
        setMileage(response.data.current_mileage.toString());
      }
    } catch (err) {
      console.error('Failed to fetch vehicle:', err);
      toast.error('Vehicle not found or access denied');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    
    try {
      await login(loginEmail, loginPassword, tenantSlug);
      setShowLogin(false);
      fetchVehicle();
    } catch (err) {
      setLoginError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoginLoading(false);
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
      if (!window.confirm(`The entered mileage (${mileageValue}) is less than the last recorded mileage (${vehicle.current_mileage}). Are you sure this is correct?`)) {
        return;
      }
    }
    
    setSubmitting(true);
    try {
      await axios.post(`${API}/api/vehicles/${vehicleId}/log-mileage`, {
        mileage: mileageValue,
        notes: notes || undefined,
        logged_via: 'qr_scan'
      });
      
      toast.success('Mileage logged successfully!');
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to log mileage');
    } finally {
      setSubmitting(false);
    }
  };

  // Login Screen
  if (showLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <div className="flex items-center space-x-3">
              <Car size={32} />
              <div>
                <h1 className="text-xl font-bold">Quick Wing</h1>
                <p className="text-blue-100 text-sm">Vehicle Mileage Check-In</p>
              </div>
            </div>
          </div>
          
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div className="text-center mb-4">
              <User size={48} className="mx-auto text-gray-400 mb-2" />
              <p className="text-gray-600">Please sign in to log vehicle mileage</p>
            </div>
            
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {loginError}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="your.email@company.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loginLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Success State
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden text-center p-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={48} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Mileage Logged!</h2>
          <p className="text-gray-600 mb-6">
            {vehicle?.name} - {mileage} km recorded
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => navigate(`/${tenantSlug}`)}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => {
                setSubmitted(false);
                setMileage('');
                setNotes('');
                fetchVehicle();
              }}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
            >
              Log Another Reading
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Vehicle Not Found
  if (!vehicle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden text-center p-8">
          <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Vehicle Not Found</h2>
          <p className="text-gray-600 mb-6">
            This vehicle may have been removed or you don't have access to it.
          </p>
          <button
            onClick={() => navigate(`/${tenantSlug}`)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Mileage Input Form
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Car size={28} />
            </div>
            <div>
              <h1 className="text-xl font-bold">{vehicle.name}</h1>
              <p className="text-blue-100">{vehicle.registration}</p>
            </div>
          </div>
          
          {vehicle.current_mileage && (
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-blue-100 text-xs">Last Recorded Mileage</p>
              <p className="text-2xl font-bold">{vehicle.current_mileage.toLocaleString()} km</p>
            </div>
          )}
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Gauge size={18} className="mr-2 text-blue-600" />
              Current Mileage (km)
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
            />
            {vehicle.current_mileage && mileage && parseInt(mileage) > vehicle.current_mileage && (
              <p className="text-sm text-green-600 mt-2 text-center">
                +{(parseInt(mileage) - vehicle.current_mileage).toLocaleString()} km since last reading
              </p>
            )}
          </div>
          
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
            />
          </div>
          
          <button
            type="submit"
            disabled={submitting || !mileage}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {submitting ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle size={22} />
                <span>Log Mileage</span>
              </>
            )}
          </button>
          
          <p className="text-center text-xs text-gray-500">
            Logged by: {user?.email}
          </p>
        </form>
      </div>
    </div>
  );
};

export default MileageLog;
