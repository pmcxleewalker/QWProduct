import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { bookingLocationsAPI } from '../api/api';
import { MapPin, Calendar, Clock, Car, User, RefreshCw, ChevronLeft, ChevronRight, Phone } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons for different car colors
const CAR_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

const createCarIcon = (color, isDoubleUp = false) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" width="32" height="40">
      <path d="M16 0C7.164 0 0 7.164 0 16c0 8.837 16 24 16 24s16-15.163 16-24C32 7.164 24.836 0 16 0z" fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="14" r="8" fill="white"/>
      <text x="16" y="18" text-anchor="middle" font-size="10" font-weight="bold" fill="${color}">${isDoubleUp ? '2x' : '🚗'}</text>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: 'custom-car-marker',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40]
  });
};

// Component to auto-fit map bounds
const FitBounds = ({ pins }) => {
  const map = useMap();
  
  useEffect(() => {
    const validPins = pins.filter(p => p.has_coordinates);
    if (validPins.length > 0) {
      const bounds = L.latLngBounds(validPins.map(pin => [pin.latitude, pin.longitude]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [pins, map]);
  
  return null;
};

const BookingLocationsMap = ({ carId = null, selectedDate = null, height = '400px', showDatePicker = true }) => {
  const [date, setDate] = useState(selectedDate || new Date().toISOString().split('T')[0]);
  const [locationData, setLocationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Ireland default center (Kerry area)
  const defaultCenter = [52.2, -9.5];
  const defaultZoom = 9;

  // Create a color map for cars
  const [carColorMap, setCarColorMap] = useState({});

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await bookingLocationsAPI.getLocationsForDate(date, carId);
      setLocationData(response.data);
      
      // Assign colors to cars
      const cars = [...new Set(response.data.pins.map(p => p.car_id))];
      const colorMap = {};
      cars.forEach((carId, index) => {
        colorMap[carId] = CAR_COLORS[index % CAR_COLORS.length];
      });
      setCarColorMap(colorMap);
    } catch (err) {
      console.error('Error fetching booking locations:', err);
      setError('Failed to fetch booking locations');
    } finally {
      setLoading(false);
    }
  }, [date, carId]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Update date when selectedDate prop changes
  useEffect(() => {
    if (selectedDate && selectedDate !== date) {
      setDate(selectedDate);
    }
  }, [selectedDate]);

  const changeDate = (days) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    setDate(newDate.toISOString().split('T')[0]);
  };

  const formatDisplayDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const pins = locationData?.pins || [];
  const pinsWithCoords = pins.filter(p => p.has_coordinates);

  return (
    <div className="space-y-3">
      {/* Date Navigation */}
      {showDatePicker && (
        <div className="bg-white rounded-lg shadow-md p-3 flex items-center justify-between">
          <button
            onClick={() => changeDate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="flex items-center space-x-3">
            <Calendar className="text-blue-600" size={20} />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-1 border rounded-lg text-sm"
            />
            <span className="text-sm text-gray-600 hidden sm:inline">
              {formatDisplayDate(date)}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setDate(new Date().toISOString().split('T')[0])}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
            >
              Today
            </button>
            <button
              onClick={() => changeDate(1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight size={20} />
            </button>
            <button
              onClick={fetchLocations}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="bg-white rounded-lg shadow-md p-3 flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center space-x-2">
          <MapPin className="text-blue-600" size={18} />
          <span className="font-medium">{locationData?.total_bookings || 0} bookings</span>
        </div>
        <div className="flex items-center space-x-2 text-green-600">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span>{locationData?.pins_with_coords || 0} on map</span>
        </div>
        {locationData?.pins_without_coords > 0 && (
          <div className="flex items-center space-x-2 text-orange-600">
            <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
            <span>{locationData.pins_without_coords} no location</span>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Map */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden" style={{ height }}>
        {loading ? (
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
              <p className="text-gray-600 text-sm">Loading booking locations...</p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={defaultCenter}
            zoom={defaultZoom}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {pinsWithCoords.length > 0 && <FitBounds pins={pinsWithCoords} />}
            
            {pinsWithCoords.map((pin, index) => (
              <Marker
                key={`${pin.booking_id}-${index}`}
                position={[pin.latitude, pin.longitude]}
                icon={createCarIcon(carColorMap[pin.car_id] || '#3B82F6', pin.is_double_up_call)}
              >
                <Popup>
                  <div className="min-w-52">
                    {/* Car Info */}
                    <div className="flex items-center space-x-2 mb-2 pb-2 border-b">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: carColorMap[pin.car_id] || '#3B82F6' }}
                      >
                        <Car size={16} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{pin.car_name}</p>
                        <p className="text-xs text-gray-500">{pin.car_registration}</p>
                      </div>
                    </div>
                    
                    {/* Booking Details */}
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center space-x-2">
                        <User size={14} className="text-gray-400" />
                        <span className="text-gray-700">{pin.user_name}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Clock size={14} className="text-gray-400" />
                        <span className="text-gray-700">{pin.start_time} - {pin.end_time}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <MapPin size={14} className="text-gray-400" />
                        <span className="text-gray-700">{pin.location || 'No location'}</span>
                      </div>
                      
                      {pin.purpose && (
                        <p className="text-xs text-gray-500 italic mt-1">"{pin.purpose}"</p>
                      )}
                      
                      {/* Badges */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {pin.is_recurring && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                            Recurring
                          </span>
                        )}
                        {pin.is_double_up_call && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full flex items-center">
                            <Phone size={10} className="mr-1" />
                            Double Up
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Bookings List (for those without coordinates) */}
      {pins.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center">
            <Car className="mr-2 text-blue-600" size={18} />
            All Bookings for {formatDisplayDate(date)} ({pins.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {pins.map((pin, index) => (
              <div 
                key={`list-${pin.booking_id}-${index}`}
                className={`p-3 rounded-lg border-l-4 ${
                  pin.has_coordinates 
                    ? 'bg-green-50 border-green-400' 
                    : 'bg-gray-50 border-gray-300'
                }`}
                style={{ borderLeftColor: carColorMap[pin.car_id] || '#3B82F6' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-gray-900">{pin.car_name}</span>
                  <span className="text-xs text-gray-500">{pin.start_time}-{pin.end_time}</span>
                </div>
                <div className="text-xs text-gray-600">
                  <span>{pin.user_name}</span>
                  {pin.location && <span className="ml-2">📍 {pin.location}</span>}
                </div>
                {!pin.has_coordinates && pin.location && (
                  <p className="text-xs text-orange-600 mt-1">⚠️ Location not mapped</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && pins.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <MapPin size={40} className="mx-auto mb-3 text-gray-300" />
          <h3 className="font-medium text-gray-900 mb-1">No Bookings</h3>
          <p className="text-sm text-gray-500">
            No bookings found for {formatDisplayDate(date)}
          </p>
        </div>
      )}

      {/* Legend */}
      {Object.keys(carColorMap).length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-3">
          <p className="text-xs text-gray-500 mb-2">Car Legend:</p>
          <div className="flex flex-wrap gap-2">
            {pins.filter((pin, index, self) => 
              self.findIndex(p => p.car_id === pin.car_id) === index
            ).map(pin => (
              <div 
                key={`legend-${pin.car_id}`}
                className="flex items-center space-x-1 px-2 py-1 rounded-full text-xs text-white"
                style={{ backgroundColor: carColorMap[pin.car_id] }}
              >
                <Car size={12} />
                <span>{pin.car_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingLocationsMap;
