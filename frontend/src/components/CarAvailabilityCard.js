import React, { useState, useEffect } from 'react';
import { Car, ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react';
import { carAPI } from '../api/api';

const CarAvailabilityCard = ({ car, onBookClick }) => {
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [view, setView] = useState('day'); // 'day', 'week', 'month'

  useEffect(() => {
    fetchAvailability();
  }, [car.id, currentDate, view]);

  const fetchAvailability = async () => {
    setLoading(true);
    try {
      const response = await carAPI.getAvailability(car.id, currentDate, view);
      setAvailability(response.data);
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateDate = (direction) => {
    const date = new Date(currentDate);
    if (view === 'day') {
      date.setDate(date.getDate() + direction);
    } else if (view === 'week') {
      date.setDate(date.getDate() + (direction * 7));
    } else {
      date.setMonth(date.getMonth() + direction);
    }
    setCurrentDate(date.toISOString().split('T')[0]);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-700 hover:bg-green-200';
      case 'booked': return 'bg-red-100 text-red-600';
      case 'recurring': return 'bg-purple-100 text-purple-600';
      case 'past': return 'bg-gray-100 text-gray-400';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  const formatDateHeader = () => {
    const date = new Date(currentDate);
    if (view === 'day') {
      return date.toLocaleDateString('en-IE', { weekday: 'long', month: 'short', day: 'numeric' });
    } else if (view === 'week') {
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 6);
      return `${date.toLocaleDateString('en-IE', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-IE', { month: 'short', day: 'numeric' })}`;
    } else {
      return date.toLocaleDateString('en-IE', { month: 'long', year: 'numeric' });
    }
  };

  return (
    <div className="bg-white rounded-xl border-2 border-amber-200 shadow-sm hover:shadow-lg transition-all overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-100 to-yellow-100 px-4 py-3 border-b border-amber-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Car className="text-amber-600" size={20} />
            <div>
              <h3 className="font-bold text-gray-900 text-sm">{car.name}</h3>
              <p className="text-xs text-gray-500">{car.registration}</p>
            </div>
          </div>
          {/* View Toggle */}
          <div className="flex bg-white rounded-lg p-0.5 border border-amber-300">
            {['day', 'week', 'month'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  view === v 
                    ? 'bg-amber-500 text-white' 
                    : 'text-gray-600 hover:bg-amber-100'
                }`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
        <button 
          onClick={() => navigateDate(-1)}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
        >
          <ChevronLeft size={18} className="text-gray-600" />
        </button>
        <span className="text-sm font-medium text-gray-700 flex items-center space-x-1">
          <Calendar size={14} />
          <span>{formatDateHeader()}</span>
        </span>
        <button 
          onClick={() => navigateDate(1)}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
        >
          <ChevronRight size={18} className="text-gray-600" />
        </button>
      </div>

      {/* Time Slots - Scrollable */}
      <div className="max-h-48 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500"></div>
          </div>
        ) : availability?.availability?.length > 0 ? (
          <div className="space-y-2">
            {view === 'day' ? (
              // Day view - show all hours
              <div className="grid grid-cols-4 gap-1">
                {availability.availability[0]?.hours?.map((slot) => (
                  <button
                    key={slot.hour}
                    disabled={slot.status !== 'available'}
                    onClick={() => slot.status === 'available' && onBookClick(car, currentDate, slot.hour)}
                    className={`p-1.5 rounded text-xs font-medium transition-all ${getStatusColor(slot.status)} ${
                      slot.status === 'available' ? 'cursor-pointer' : 'cursor-default'
                    }`}
                    title={slot.booked_by ? `Booked by ${slot.booked_by}` : (slot.status === 'available' ? 'Click to book' : '')}
                  >
                    {slot.time_display}
                  </button>
                ))}
              </div>
            ) : (
              // Week/Month view - show days with summary
              <div className="space-y-1.5">
                {availability.availability.map((day) => {
                  const availableHours = day.hours?.filter(h => h.status === 'available').length || 0;
                  const totalHours = day.hours?.length || 0;
                  return (
                    <div 
                      key={day.date}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-medium text-gray-600 w-8">{day.day_short}</span>
                        <span className="text-xs text-gray-500">{day.date_display}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-0.5">
                          {day.hours?.slice(0, 8).map((h, i) => (
                            <div 
                              key={i}
                              className={`w-2 h-3 rounded-sm ${
                                h.status === 'available' ? 'bg-green-400' : 
                                h.status === 'booked' ? 'bg-red-400' : 'bg-gray-300'
                              }`}
                              title={`${h.time_display}: ${h.status}`}
                            />
                          ))}
                          {day.hours?.length > 8 && <span className="text-xs text-gray-400">...</span>}
                        </div>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          availableHours > 8 ? 'bg-green-100 text-green-700' :
                          availableHours > 4 ? 'bg-yellow-100 text-yellow-700' :
                          availableHours > 0 ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-600'
                        }`}>
                          {availableHours}h free
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-gray-500 text-xs py-4">No availability data</p>
        )}
      </div>

      {/* Legend */}
      <div className="px-3 py-2 bg-gray-50 border-t flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-400 rounded"></div>
            <span className="text-gray-600">Free</span>
          </span>
          <span className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-400 rounded"></div>
            <span className="text-gray-600">Booked</span>
          </span>
        </div>
        <button
          onClick={() => onBookClick(car, currentDate)}
          className="px-3 py-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium text-xs"
        >
          Book
        </button>
      </div>
    </div>
  );
};

export default CarAvailabilityCard;
