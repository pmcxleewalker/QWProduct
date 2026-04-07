import React, { useState, useEffect } from 'react';
import { 
  Car, Calendar, Clock, MapPin, QrCode, Bell, User, 
  ChevronRight, Plus, RefreshCw, Check, X, AlertCircle,
  Fuel, CheckCircle, Timer, Navigation
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StaffMobileView = ({ 
  vehicles = [], 
  bookings = [], 
  announcements = [],
  onRefresh,
  onBookVehicle,
  tenantSlug 
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    purpose: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get user's bookings
  const myBookings = bookings.filter(b => 
    b.user_id === user?.id || b.user_name === user?.name
  );
  
  // Today's bookings
  const today = new Date().toISOString().split('T')[0];
  const todaysBookings = myBookings.filter(b => 
    b.start_time?.split('T')[0] === today
  );

  // Available vehicles
  const availableVehicles = vehicles.filter(v => 
    v.status === 'available' || v.current_status === 'Free'
  );

  // Upcoming bookings
  const upcomingBookings = myBookings
    .filter(b => new Date(b.start_time) >= new Date())
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 5);

  const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString('en-IE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IE', { 
      weekday: 'short',
      day: 'numeric', 
      month: 'short' 
    });
  };

  const getVehicleName = (carId) => {
    const vehicle = vehicles.find(v => v.id === carId);
    return vehicle?.name || 'Unknown Vehicle';
  };

  const handleQuickBook = (vehicle) => {
    setSelectedVehicle(vehicle);
    setShowBookingModal(true);
  };

  const submitBooking = async () => {
    if (!selectedVehicle || !bookingForm.purpose) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const startDateTime = `${bookingForm.date}T${bookingForm.startTime}:00`;
      const endDateTime = `${bookingForm.date}T${bookingForm.endTime}:00`;

      await axios.post(`${API}/bookings`, {
        car_id: selectedVehicle.id,
        start_time: startDateTime,
        end_time: endDateTime,
        purpose: bookingForm.purpose,
        status: 'pending'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Booking request submitted!');
      setShowBookingModal(false);
      setSelectedVehicle(null);
      setBookingForm({
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '17:00',
        purpose: ''
      });
      if (onRefresh) onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 pt-12 pb-6 safe-area-top">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-blue-200 text-sm">Welcome back,</p>
            <h1 className="text-xl font-bold">{user?.name || 'Staff'}</h1>
          </div>
          <button 
            onClick={onRefresh}
            className="p-3 bg-white/20 rounded-full active:bg-white/30"
          >
            <RefreshCw size={20} />
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{todaysBookings.length}</p>
            <p className="text-xs text-blue-200">Today</p>
          </div>
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{availableVehicles.length}</p>
            <p className="text-xs text-blue-200">Available</p>
          </div>
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{upcomingBookings.length}</p>
            <p className="text-xs text-blue-200">Upcoming</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 -mt-4">
        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">QUICK ACTIONS</h2>
          <div className="grid grid-cols-4 gap-2">
            <Link
              to={`/${tenantSlug}/mileage`}
              className="flex flex-col items-center p-3 bg-green-50 rounded-xl active:bg-green-100"
            >
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mb-2">
                <QrCode className="text-white" size={24} />
              </div>
              <span className="text-xs text-gray-700 text-center">Scan QR</span>
            </Link>
            
            <button
              onClick={() => setActiveTab('vehicles')}
              className="flex flex-col items-center p-3 bg-blue-50 rounded-xl active:bg-blue-100"
            >
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mb-2">
                <Car className="text-white" size={24} />
              </div>
              <span className="text-xs text-gray-700 text-center">Vehicles</span>
            </button>
            
            <button
              onClick={() => setActiveTab('bookings')}
              className="flex flex-col items-center p-3 bg-purple-50 rounded-xl active:bg-purple-100"
            >
              <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mb-2">
                <Calendar className="text-white" size={24} />
              </div>
              <span className="text-xs text-gray-700 text-center">Bookings</span>
            </button>
            
            <Link
              to={`/${tenantSlug}/request-lift`}
              className="flex flex-col items-center p-3 bg-orange-50 rounded-xl active:bg-orange-100"
            >
              <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mb-2">
                <Navigation className="text-white" size={24} />
              </div>
              <span className="text-xs text-gray-700 text-center">Request</span>
            </Link>
          </div>
        </div>

        {/* Today's Schedule */}
        {todaysBookings.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-500 mb-3">TODAY'S SCHEDULE</h2>
            <div className="space-y-3">
              {todaysBookings.map((booking) => (
                <div 
                  key={booking.id}
                  className="flex items-center p-3 bg-blue-50 rounded-xl"
                >
                  <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mr-3">
                    <Car className="text-white" size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {getVehicleName(booking.car_id)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    booking.status === 'confirmed' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {booking.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Vehicles for Quick Booking */}
        {activeTab === 'home' && (
          <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500">AVAILABLE NOW</h2>
              <span className="text-xs text-blue-600">{availableVehicles.length} vehicles</span>
            </div>
            
            {availableVehicles.length === 0 ? (
              <div className="text-center py-8">
                <Car className="mx-auto text-gray-300 mb-2" size={40} />
                <p className="text-gray-500">No vehicles available</p>
              </div>
            ) : (
              <div className="space-y-2">
                {availableVehicles.slice(0, 4).map((vehicle) => (
                  <button
                    key={vehicle.id}
                    onClick={() => handleQuickBook(vehicle)}
                    className="w-full flex items-center p-3 bg-gray-50 rounded-xl active:bg-gray-100 text-left"
                  >
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                      <Car className="text-green-600" size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{vehicle.name}</p>
                      <p className="text-xs text-gray-500">{vehicle.registration}</p>
                    </div>
                    <div className="flex items-center text-green-600">
                      <span className="text-xs mr-1">Book</span>
                      <ChevronRight size={16} />
                    </div>
                  </button>
                ))}
                
                {availableVehicles.length > 4 && (
                  <button
                    onClick={() => setActiveTab('vehicles')}
                    className="w-full py-3 text-center text-blue-600 text-sm font-medium"
                  >
                    View all {availableVehicles.length} vehicles
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Vehicles Tab */}
        {activeTab === 'vehicles' && (
          <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500">ALL VEHICLES</h2>
              <button 
                onClick={() => setActiveTab('home')}
                className="text-xs text-blue-600"
              >
                Back
              </button>
            </div>
            
            <div className="space-y-2">
              {vehicles.map((vehicle) => {
                const isAvailable = vehicle.status === 'available' || vehicle.current_status === 'Free';
                return (
                  <button
                    key={vehicle.id}
                    onClick={() => isAvailable && handleQuickBook(vehicle)}
                    disabled={!isAvailable}
                    className={`w-full flex items-center p-4 rounded-xl text-left ${
                      isAvailable 
                        ? 'bg-green-50 active:bg-green-100' 
                        : 'bg-gray-100 opacity-60'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-3 ${
                      isAvailable ? 'bg-green-500' : 'bg-red-400'
                    }`}>
                      <Car className="text-white" size={24} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{vehicle.name}</p>
                      <p className="text-sm text-gray-500">{vehicle.registration}</p>
                      {vehicle.base_location && (
                        <p className="text-xs text-gray-400 flex items-center mt-1">
                          <MapPin size={10} className="mr-1" />
                          {vehicle.base_location}
                        </p>
                      )}
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      isAvailable 
                        ? 'bg-green-200 text-green-800' 
                        : 'bg-red-200 text-red-800'
                    }`}>
                      {isAvailable ? 'Available' : 'In Use'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500">MY BOOKINGS</h2>
              <button 
                onClick={() => setActiveTab('home')}
                className="text-xs text-blue-600"
              >
                Back
              </button>
            </div>
            
            {upcomingBookings.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="mx-auto text-gray-300 mb-2" size={40} />
                <p className="text-gray-500">No upcoming bookings</p>
                <button
                  onClick={() => setActiveTab('vehicles')}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
                >
                  Book a Vehicle
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingBookings.map((booking) => (
                  <div 
                    key={booking.id}
                    className="p-4 bg-gray-50 rounded-xl"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {getVehicleName(booking.car_id)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(booking.start_time)}
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        booking.status === 'confirmed' 
                          ? 'bg-green-100 text-green-700' 
                          : booking.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {booking.status}
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock size={14} className="mr-1" />
                      {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                    </div>
                    {booking.purpose && (
                      <p className="text-xs text-gray-500 mt-2">{booking.purpose}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Announcements */}
        {announcements.length > 0 && activeTab === 'home' && (
          <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-500 mb-3">ANNOUNCEMENTS</h2>
            <div className="space-y-2">
              {announcements.slice(0, 2).map((announcement) => (
                <div 
                  key={announcement.id}
                  className={`p-3 rounded-xl ${
                    announcement.priority === 'high' 
                      ? 'bg-red-50 border-l-4 border-red-500' 
                      : 'bg-blue-50 border-l-4 border-blue-500'
                  }`}
                >
                  <p className="font-medium text-gray-900 text-sm">{announcement.title}</p>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{announcement.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Book Modal */}
      {showBookingModal && selectedVehicle && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 animate-slide-up max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Book Vehicle</h2>
              <button 
                onClick={() => setShowBookingModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={24} />
              </button>
            </div>

            {/* Selected Vehicle */}
            <div className="flex items-center p-4 bg-blue-50 rounded-xl mb-6">
              <div className="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center mr-4">
                <Car className="text-white" size={28} />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg">{selectedVehicle.name}</p>
                <p className="text-gray-500">{selectedVehicle.registration}</p>
              </div>
            </div>

            {/* Booking Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={bookingForm.date}
                  onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                  <input
                    type="time"
                    value={bookingForm.startTime}
                    onChange={(e) => setBookingForm({ ...bookingForm, startTime: e.target.value })}
                    className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                  <input
                    type="time"
                    value={bookingForm.endTime}
                    onChange={(e) => setBookingForm({ ...bookingForm, endTime: e.target.value })}
                    className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Purpose</label>
                <input
                  type="text"
                  value={bookingForm.purpose}
                  onChange={(e) => setBookingForm({ ...bookingForm, purpose: e.target.value })}
                  placeholder="e.g., Client meeting, Delivery"
                  className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={submitBooking}
              disabled={isSubmitting || !bookingForm.purpose}
              className="w-full mt-6 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl disabled:opacity-50 active:bg-blue-700"
            >
              {isSubmitting ? 'Submitting...' : 'Request Booking'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .safe-area-top {
          padding-top: max(48px, env(safe-area-inset-top));
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default StaffMobileView;
