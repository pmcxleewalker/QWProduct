import React, { useState, useEffect } from 'react';
import { bookingAPI, carAPI } from '../api/api';
import { Calendar as CalendarIcon, Plus, Trash2, AlertCircle } from 'lucide-react';

const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    car_id: '',
    user_name: '',
    start_time: '',
    end_time: '',
    destination_notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [bookingsRes, carsRes] = await Promise.all([
        bookingAPI.getAll(),
        carAPI.getAll(),
      ]);
      setBookings(bookingsRes.data);
      setCars(carsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await bookingAPI.create({
        ...formData,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
      });
      setSuccess('Booking created successfully!');
      setShowForm(false);
      setFormData({
        car_id: '',
        user_name: '',
        start_time: '',
        end_time: '',
        destination_notes: '',
      });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create booking');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this booking?')) return;
    
    try {
      await bookingAPI.delete(id);
      setSuccess('Booking deleted successfully');
      fetchData();
    } catch (err) {
      setError('Failed to delete booking');
    }
  };

  const getCarName = (carId) => {
    const car = cars.find(c => c.id === carId);
    return car ? `${car.name} (${car.registration})` : 'Unknown Car';
  };

  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900" data-testid="bookings-title">Car Bookings</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          data-testid="new-booking-button"
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          <span>New Booking</span>
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6" data-testid="success-message">
          <p className="text-green-800">{success}</p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center" data-testid="error-message">
          <AlertCircle className="text-red-500 mr-2" size={20} />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Booking Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Create New Booking</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Car *
                </label>
                <select
                  data-testid="booking-car-select"
                  value={formData.car_id}
                  onChange={(e) => setFormData({ ...formData, car_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Choose a car</option>
                  {cars.map((car) => (
                    <option key={car.id} value={car.id}>
                      {car.name} ({car.registration})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name *
                </label>
                <input
                  type="text"
                  data-testid="booking-user-name"
                  value={formData.user_name}
                  onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time *
                </label>
                <input
                  type="datetime-local"
                  data-testid="booking-start-time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Time *
                </label>
                <input
                  type="datetime-local"
                  data-testid="booking-end-time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Destination / Notes
              </label>
              <textarea
                data-testid="booking-notes"
                value={formData.destination_notes}
                onChange={(e) => setFormData({ ...formData, destination_notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows="2"
                placeholder="Where will the car be left?"
              />
            </div>

            <div className="flex space-x-4">
              <button
                type="submit"
                data-testid="submit-booking-button"
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Booking
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bookings List */}
      {bookings.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <CalendarIcon className="mx-auto text-gray-400" size={48} />
          <p className="text-gray-500 mt-4">No bookings yet. Create your first booking!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              data-testid={`booking-card-${booking.id}`}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900">
                    {getCarName(booking.car_id)}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Booked by: <span className="font-medium">{booking.user_name}</span>
                  </p>
                  <div className="mt-3 space-y-1">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">From:</span> {formatDateTime(booking.start_time)}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">To:</span> {formatDateTime(booking.end_time)}
                    </p>
                  </div>
                  {booking.destination_notes && (
                    <p className="text-sm text-gray-600 mt-2 italic">
                      Destination: {booking.destination_notes}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(booking.id)}
                  data-testid={`delete-booking-${booking.id}`}
                  className="text-red-500 hover:text-red-700 transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Bookings;