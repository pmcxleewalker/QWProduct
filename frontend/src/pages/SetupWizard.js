import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { 
  Car, Users, CheckCircle, ArrowRight, ArrowLeft,
  Sparkles, Building2, UserPlus, Rocket, PartyPopper
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Helper to extract error message from various error formats
const getErrorMessage = (err, defaultMsg = 'An error occurred') => {
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail[0]?.msg || defaultMsg;
  } else if (typeof detail === 'string') {
    return detail;
  } else if (typeof detail === 'object' && detail?.msg) {
    return detail.msg;
  }
  return err?.message || defaultMsg;
};

const SetupWizard = () => {
  const navigate = useNavigate();
  const { user, activeTenant } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Vehicle form
  const [vehicle, setVehicle] = useState({
    name: '',
    registration: ''
  });
  
  // Staff form
  const [staff, setStaff] = useState({
    email: '',
    password: '',
    name: ''
  });
  
  // Track what was created
  const [createdVehicle, setCreatedVehicle] = useState(null);
  const [createdStaff, setCreatedStaff] = useState(null);

  const steps = [
    { id: 'welcome', title: 'Welcome', icon: Sparkles },
    { id: 'vehicle', title: 'Add Vehicle', icon: Car },
    { id: 'staff', title: 'Add Staff', icon: UserPlus },
    { id: 'complete', title: 'Ready!', icon: PartyPopper }
  ];

  const handleAddVehicle = async () => {
    if (!vehicle.name || !vehicle.registration) {
      setError('Please fill in all vehicle fields');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post(`${API}/vehicles`, vehicle);
      setCreatedVehicle(response.data.vehicle);
      setCurrentStep(2);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to add vehicle'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async () => {
    if (!staff.email || !staff.password || !staff.name) {
      setError('Please fill in all staff fields');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await axios.post(`${API}/tenant/users`, staff, {
        params: { role: 'staff' }
      });
      setCreatedStaff({ email: staff.email, name: staff.name });
      setCurrentStep(3);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to add staff member'));
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    setCurrentStep(currentStep + 1);
  };

  const handleComplete = () => {
    // Mark setup as complete in localStorage
    localStorage.setItem(`setup_complete_${activeTenant?.tenant_id}`, 'true');
    // Redirect to tenant-scoped dashboard
    const dashboardPath = activeTenant?.tenant_slug ? `/${activeTenant.tenant_slug}` : '/';
    navigate(dashboardPath);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-2">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                  index <= currentStep 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-slate-700 text-slate-400'
                }`}>
                  {index < currentStep ? (
                    <CheckCircle size={20} />
                  ) : (
                    <step.icon size={20} />
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-12 h-1 rounded ${
                    index < currentStep ? 'bg-blue-500' : 'bg-slate-700'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-center mt-2">
            <span className="text-slate-400 text-sm">
              Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" data-testid="setup-wizard">
          {/* Step 0: Welcome */}
          {currentStep === 0 && (
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Building2 size={40} className="text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome to {activeTenant?.tenant_name}!
              </h1>
              <p className="text-gray-600 mb-6">
                Hi {user?.name || user?.email}! Let's get your fleet management system set up in just a few steps.
              </p>
              
              <div className="bg-blue-50 rounded-xl p-6 mb-8 text-left">
                <h3 className="font-semibold text-blue-900 mb-3">What we'll do:</h3>
                <ul className="space-y-2 text-blue-800">
                  <li className="flex items-center">
                    <Car size={18} className="mr-2 text-blue-600" />
                    Add your first vehicle to the fleet
                  </li>
                  <li className="flex items-center">
                    <UserPlus size={18} className="mr-2 text-blue-600" />
                    Create a staff account for your team
                  </li>
                  <li className="flex items-center">
                    <Rocket size={18} className="mr-2 text-blue-600" />
                    Get you ready to start booking!
                  </li>
                </ul>
              </div>
              
              <button
                onClick={() => setCurrentStep(1)}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center"
                data-testid="start-setup-btn"
              >
                Let's Get Started
                <ArrowRight size={20} className="ml-2" />
              </button>
            </div>
          )}

          {/* Step 1: Add Vehicle */}
          {currentStep === 1 && (
            <div className="p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Car size={32} className="text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Add Your First Vehicle</h2>
                <p className="text-gray-600">Enter the details of a vehicle in your fleet</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Name *</label>
                  <input
                    type="text"
                    value={vehicle.name}
                    onChange={(e) => setVehicle({ ...vehicle, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Toyota Corolla - Blue"
                    data-testid="vehicle-name-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number *</label>
                  <input
                    type="text"
                    value={vehicle.registration}
                    onChange={(e) => setVehicle({ ...vehicle, registration: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 191-KY-1234"
                    data-testid="vehicle-reg-input"
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleSkip}
                  className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Skip for now
                </button>
                <button
                  onClick={handleAddVehicle}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                  data-testid="add-vehicle-btn"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      Add Vehicle
                      <ArrowRight size={18} className="ml-2" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Add Staff */}
          {currentStep === 2 && (
            <div className="p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <UserPlus size={32} className="text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Add a Staff Member</h2>
                <p className="text-gray-600">Create an account for someone on your team</p>
              </div>

              {createdVehicle && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center text-green-700 text-sm">
                  <CheckCircle size={18} className="mr-2" />
                  Vehicle "{createdVehicle.name}" added successfully!
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Staff Name *</label>
                  <input
                    type="text"
                    value={staff.name}
                    onChange={(e) => setStaff({ ...staff, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., John Smith"
                    data-testid="staff-name-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    value={staff.email}
                    onChange={(e) => setStaff({ ...staff, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., john@company.com"
                    data-testid="staff-email-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password *</label>
                  <input
                    type="text"
                    value={staff.password}
                    onChange={(e) => setStaff({ ...staff, password: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Create a temporary password"
                    data-testid="staff-password-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">Share this with your staff member so they can log in</p>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleSkip}
                  className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Skip for now
                </button>
                <button
                  onClick={handleAddStaff}
                  disabled={loading}
                  className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center"
                  data-testid="add-staff-btn"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      Add Staff Member
                      <ArrowRight size={18} className="ml-2" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Complete */}
          {currentStep === 3 && (
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <PartyPopper size={40} className="text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">You're All Set!</h2>
              <p className="text-gray-600 mb-6">
                Your fleet management system is ready to use.
              </p>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-6 mb-8 text-left">
                <h3 className="font-semibold text-gray-900 mb-4">Setup Summary:</h3>
                <div className="space-y-3">
                  {createdVehicle ? (
                    <div className="flex items-center text-green-700">
                      <CheckCircle size={18} className="mr-2" />
                      <span>Added vehicle: <strong>{createdVehicle.name}</strong> ({createdVehicle.registration})</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-gray-500">
                      <Car size={18} className="mr-2" />
                      <span>No vehicles added yet - you can add them from the Admin panel</span>
                    </div>
                  )}
                  {createdStaff ? (
                    <div className="flex items-center text-green-700">
                      <CheckCircle size={18} className="mr-2" />
                      <span>Added staff: <strong>{createdStaff.name}</strong> ({createdStaff.email})</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-gray-500">
                      <Users size={18} className="mr-2" />
                      <span>No staff added yet - you can invite them later</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleComplete}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-4 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-600 transition-all flex items-center justify-center"
                data-testid="complete-setup-btn"
              >
                Go to Dashboard
                <Rocket size={20} className="ml-2" />
              </button>
            </div>
          )}
        </div>

        {/* Skip all link */}
        {currentStep > 0 && currentStep < 3 && (
          <div className="text-center mt-4">
            <button
              onClick={handleComplete}
              className="text-slate-400 hover:text-white text-sm underline transition-colors"
            >
              Skip setup and go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupWizard;
