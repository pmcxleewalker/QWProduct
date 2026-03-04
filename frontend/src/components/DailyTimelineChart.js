import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Clock, TrendingUp, Download, RefreshCw, Calendar, Car } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DailyTimelineChart = () => {
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchTimeline();
  }, [selectedDate]);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/tenant/reports/daily-timeline`, {
        params: { date: selectedDate }
      });
      setTimelineData(response.data);
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const response = await axios.get(`${API}/tenant/reports/daily-timeline/csv`, {
        params: { date: selectedDate },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `daily_timeline_${selectedDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export:', err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm border">
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!timelineData) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm border text-center text-gray-500">
        <Clock size={48} className="mx-auto mb-4 opacity-50" />
        <p>Unable to load timeline data</p>
        <button onClick={fetchTimeline} className="mt-4 text-blue-600 hover:underline">
          Retry
        </button>
      </div>
    );
  }

  const { timeline, summary, available_fleet, blocked_vehicles, total_vehicles } = timelineData;
  const maxInUse = Math.max(...timeline.map(t => t.in_use), 1);

  return (
    <div className="space-y-6" data-testid="daily-timeline">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Clock size={20} className="mr-2 text-blue-600" />
            Daily Availability Timeline
          </h3>
          <p className="text-sm text-gray-500">Hourly fleet utilization (07:00 - 22:00)</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={fetchTimeline}
            className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <Download size={16} />
            <span>{exporting ? 'Exporting...' : 'CSV'}</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg p-4 border shadow-sm">
          <p className="text-xs text-gray-500">Total Fleet</p>
          <p className="text-2xl font-bold text-gray-900">{total_vehicles}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-xs text-blue-600">Available</p>
          <p className="text-2xl font-bold text-blue-700">{available_fleet}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <p className="text-xs text-orange-600">Peak Hour</p>
          <p className="text-2xl font-bold text-orange-700">{summary.peak_hour || 'N/A'}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <p className="text-xs text-purple-600">Avg Utilization</p>
          <p className="text-2xl font-bold text-purple-700">{summary.average_utilization}%</p>
        </div>
      </div>

      {/* Timeline Chart */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="space-y-2">
          {timeline.map((slot, index) => {
            const barWidth = available_fleet > 0 ? (slot.in_use / available_fleet) * 100 : 0;
            const isPeakHour = slot.hour === summary.peak_hour;
            
            return (
              <div 
                key={slot.hour} 
                className="flex items-center space-x-3 group"
                data-testid={`timeline-slot-${slot.hour}`}
              >
                <span className={`w-14 text-sm font-medium ${isPeakHour ? 'text-orange-600' : 'text-gray-600'}`}>
                  {slot.hour}
                </span>
                
                <div className="flex-1 h-8 bg-gray-100 rounded-full overflow-hidden relative">
                  {/* In Use Bar */}
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      isPeakHour 
                        ? 'bg-gradient-to-r from-orange-400 to-orange-500' 
                        : slot.utilization_percent > 70 
                          ? 'bg-gradient-to-r from-purple-400 to-purple-500'
                          : 'bg-gradient-to-r from-blue-400 to-blue-500'
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                  
                  {/* Hover tooltip */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-medium text-gray-700 bg-white/80 px-2 py-0.5 rounded">
                      {slot.in_use} in use / {slot.free} free
                    </span>
                  </div>
                </div>
                
                <div className="w-20 text-right">
                  <span className={`text-sm font-medium ${
                    slot.utilization_percent > 70 ? 'text-purple-600' : 
                    slot.utilization_percent > 40 ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {slot.utilization_percent}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center space-x-6 mt-6 pt-4 border-t text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded bg-gradient-to-r from-blue-400 to-blue-500"></div>
            <span className="text-gray-600">Normal Usage</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded bg-gradient-to-r from-purple-400 to-purple-500"></div>
            <span className="text-gray-600">High Usage (&gt;70%)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded bg-gradient-to-r from-orange-400 to-orange-500"></div>
            <span className="text-gray-600">Peak Hour</span>
          </div>
        </div>
      </div>

      {/* Blocked Vehicles Note */}
      {blocked_vehicles > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          <Car size={16} className="inline mr-2" />
          Note: {blocked_vehicles} vehicle{blocked_vehicles > 1 ? 's are' : ' is'} currently blocked and excluded from availability calculations.
        </div>
      )}
    </div>
  );
};

export default DailyTimelineChart;
