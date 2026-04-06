import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Car, MapPin, Navigation, Clock, User } from 'lucide-react';

// Fix leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Generate distinct colors for each vehicle
const VEHICLE_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
  '#6366F1', // indigo
];

// Irish Eircode to approximate coordinates (simplified mapping)
// In production, you'd use a geocoding API
const eircodeToCoords = (eircode) => {
  if (!eircode) return null;
  
  // Remove spaces and uppercase
  const code = eircode.replace(/\s/g, '').toUpperCase();
  
  // Dublin eircode prefixes mapping to approximate coords
  const dublinPrefixes = {
    'D01': [53.3498, -6.2603], 'D02': [53.3382, -6.2591], 'D03': [53.3559, -6.2469],
    'D04': [53.3244, -6.2287], 'D05': [53.3703, -6.2169], 'D06': [53.3305, -6.2756],
    'D07': [53.3589, -6.2845], 'D08': [53.3389, -6.2950], 'D09': [53.3698, -6.2503],
    'D10': [53.3447, -6.3350], 'D11': [53.3870, -6.2747], 'D12': [53.3178, -6.3194],
    'D13': [53.3956, -6.1847], 'D14': [53.2939, -6.2456], 'D15': [53.3889, -6.3678],
    'D16': [53.2872, -6.2058], 'D17': [53.3922, -6.1431], 'D18': [53.2633, -6.1508],
    'D20': [53.3528, -6.3947], 'D22': [53.3233, -6.3917], 'D24': [53.2897, -6.3733],
  };
  
  // Cork prefixes
  const corkPrefixes = {
    'T12': [51.8969, -8.4863], 'T23': [51.8836, -8.4958], 'T45': [51.9000, -8.4700],
  };
  
  // Galway prefixes
  const galwayPrefixes = {
    'H91': [53.2707, -9.0568],
  };
  
  // Check Dublin first
  const prefix = code.substring(0, 3);
  if (dublinPrefixes[prefix]) {
    // Add small random offset for differentiation
    const [lat, lng] = dublinPrefixes[prefix];
    return [lat + (Math.random() - 0.5) * 0.01, lng + (Math.random() - 0.5) * 0.01];
  }
  
  if (corkPrefixes[prefix]) {
    const [lat, lng] = corkPrefixes[prefix];
    return [lat + (Math.random() - 0.5) * 0.01, lng + (Math.random() - 0.5) * 0.01];
  }
  
  if (galwayPrefixes[prefix]) {
    const [lat, lng] = galwayPrefixes[prefix];
    return [lat + (Math.random() - 0.5) * 0.01, lng + (Math.random() - 0.5) * 0.01];
  }
  
  // Default to Dublin City Centre if unknown
  return [53.3498 + (Math.random() - 0.5) * 0.05, -6.2603 + (Math.random() - 0.5) * 0.05];
};

// Custom marker icon creator
const createMarkerIcon = (color, type = 'default') => {
  const svgIcon = type === 'start' 
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="32"><circle cx="12" cy="12" r="10" fill="${color}"/><circle cx="12" cy="12" r="4" fill="white"/></svg>`
    : type === 'end'
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="32"><rect x="4" y="4" width="16" height="16" rx="2" fill="${color}"/><rect x="8" y="8" width="8" height="8" fill="white"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="24" height="24"><polygon points="12,2 22,20 2,20" fill="${color}"/></svg>`;
  
  return L.divIcon({
    html: svgIcon,
    className: 'custom-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

// Component to fit map bounds to markers
const FitBounds = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
};

const FleetMap = ({ bookings, vehicles, selectedVehicleId = null }) => {
  const [activeBookings, setActiveBookings] = useState([]);
  const [bounds, setBounds] = useState([]);

  useEffect(() => {
    // Filter to bookings with journey data
    const withJourney = bookings.filter(b => 
      b.start_eircode && b.end_eircode && 
      (selectedVehicleId ? b.car_id === selectedVehicleId : true)
    );
    
    // Map bookings to include coordinates and vehicle color
    const processed = withJourney.map((booking, index) => {
      const vehicleIndex = vehicles.findIndex(v => v.id === booking.car_id);
      const color = VEHICLE_COLORS[vehicleIndex % VEHICLE_COLORS.length];
      const vehicle = vehicles.find(v => v.id === booking.car_id);
      
      const startCoords = eircodeToCoords(booking.start_eircode);
      const endCoords = eircodeToCoords(booking.end_eircode);
      
      // Process stops
      const stopCoords = (booking.journey_stops || []).map(stop => ({
        coords: eircodeToCoords(stop.eircode),
        eircode: stop.eircode,
        address: stop.address
      }));
      
      // Build route path
      const routePath = [startCoords];
      stopCoords.forEach(stop => {
        if (stop.coords) routePath.push(stop.coords);
      });
      routePath.push(endCoords);
      
      return {
        ...booking,
        color,
        vehicleName: vehicle?.name || 'Unknown',
        vehicleReg: vehicle?.registration || '',
        startCoords,
        endCoords,
        stopCoords: stopCoords.filter(s => s.coords),
        routePath: routePath.filter(Boolean)
      };
    });
    
    setActiveBookings(processed);
    
    // Calculate bounds
    const allCoords = processed.flatMap(b => b.routePath);
    if (allCoords.length > 0) {
      setBounds(allCoords);
    }
  }, [bookings, vehicles, selectedVehicleId]);

  // Default center (Dublin)
  const defaultCenter = [53.3498, -6.2603];

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
        <h3 className="font-bold text-gray-900 flex items-center">
          <MapPin className="mr-2 text-blue-600" size={20} />
          Fleet Journey Map
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          {activeBookings.length} booking{activeBookings.length !== 1 ? 's' : ''} with journey data
        </p>
      </div>
      
      {/* Legend - scrollable with max height */}
      {activeBookings.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-b max-h-24 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {activeBookings.slice(0, 20).map((booking, index) => (
              <div key={booking.id} className="flex items-center space-x-1 text-xs">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: booking.color }}
                />
                <span className="text-gray-700 truncate max-w-[100px]">{booking.vehicleName}</span>
              </div>
            ))}
            {activeBookings.length > 20 && (
              <span className="text-xs text-gray-500">+{activeBookings.length - 20} more</span>
            )}
          </div>
        </div>
      )}

      <div style={{ height: '500px' }}>
        <MapContainer
          center={defaultCenter}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {bounds.length > 0 && <FitBounds bounds={bounds} />}
          
          {activeBookings.map((booking) => (
            <React.Fragment key={booking.id}>
              {/* Route line */}
              {booking.routePath.length > 1 && (
                <Polyline
                  positions={booking.routePath}
                  pathOptions={{ 
                    color: booking.color, 
                    weight: 4, 
                    opacity: 0.8,
                    dashArray: '10, 5'
                  }}
                />
              )}
              
              {/* Start marker */}
              {booking.startCoords && (
                <Marker 
                  position={booking.startCoords}
                  icon={createMarkerIcon(booking.color, 'start')}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="font-bold text-green-700 mb-1">START</div>
                      <div className="font-semibold">{booking.vehicleName}</div>
                      <div className="text-gray-600">{booking.vehicleReg}</div>
                      <div className="mt-2">
                        <div className="font-medium">{booking.start_eircode}</div>
                        {booking.start_address && (
                          <div className="text-gray-500">{booking.start_address}</div>
                        )}
                      </div>
                      <div className="mt-2 text-gray-600">
                        <User size={12} className="inline mr-1" />
                        {booking.user_name}
                      </div>
                      <div className="text-gray-500 text-xs mt-1">
                        <Clock size={10} className="inline mr-1" />
                        {new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )}
              
              {/* Stop markers */}
              {booking.stopCoords.map((stop, stopIndex) => (
                <Marker 
                  key={`${booking.id}-stop-${stopIndex}`}
                  position={stop.coords}
                  icon={createMarkerIcon(booking.color, 'stop')}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="font-bold text-amber-700 mb-1">STOP {stopIndex + 1}</div>
                      <div className="font-semibold">{booking.vehicleName}</div>
                      <div className="font-medium">{stop.eircode}</div>
                      {stop.address && (
                        <div className="text-gray-500">{stop.address}</div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
              
              {/* End marker */}
              {booking.endCoords && (
                <Marker 
                  position={booking.endCoords}
                  icon={createMarkerIcon(booking.color, 'end')}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="font-bold text-red-700 mb-1">END</div>
                      <div className="font-semibold">{booking.vehicleName}</div>
                      <div className="text-gray-600">{booking.vehicleReg}</div>
                      <div className="mt-2">
                        <div className="font-medium">{booking.end_eircode}</div>
                        {booking.end_address && (
                          <div className="text-gray-500">{booking.end_address}</div>
                        )}
                      </div>
                      <div className="text-gray-500 text-xs mt-1">
                        <Clock size={10} className="inline mr-1" />
                        {new Date(booking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )}
            </React.Fragment>
          ))}
        </MapContainer>
      </div>
      
      {activeBookings.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 pointer-events-none" style={{ top: '120px' }}>
          <div className="text-center text-gray-500">
            <MapPin size={48} className="mx-auto mb-2 opacity-50" />
            <p>No bookings with journey data</p>
            <p className="text-sm">Create bookings with start/end eircodes to see them on the map</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetMap;
