import React, { useState, useEffect, useMemo } from 'react';
import { 
  Car, Calendar, Clock, Download, TrendingUp, MapPin,
  PieChart, BarChart3, AlertCircle, CheckCircle, Lock,
  Shield, Gauge, AlertTriangle
} from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FleetReportsSection = ({ onRefresh, vehicles = [], complianceSettings = {} }) => {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      let url = `${API}/tenant/fleet-reports`;
      const params = new URLSearchParams();
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await axios.get(url);
      setReports(response.data);
    } catch (err) {
      setError('Failed to load fleet reports');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    window.open(`${API}/tenant/fleet-reports/csv`, '_blank');
  };

  const applyDates = () => {
    fetchReports();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-600">
        <AlertCircle size={40} className="mx-auto mb-3" />
        <p>{error}</p>
        <button onClick={fetchReports} className="mt-4 text-blue-600 underline">
          Try Again
        </button>
      </div>
    );
  }

  if (!reports) return null;

  const { summary, most_booked_cars, daily_availability, location_summary } = reports;

  // Calculate donut chart percentages
  const total = daily_availability.total_fleet || 1;
  const freePercent = (daily_availability.fully_free / total) * 100;
  const partialPercent = (daily_availability.partially_free / total) * 100;
  const bookedPercent = (daily_availability.fully_booked / total) * 100;

  // Calculate compliance summary
  const settings = {
    tax_warning_days: complianceSettings.tax_warning_days ?? 60,
    nct_warning_days: complianceSettings.nct_warning_days ?? 60,
    service_warning_km: complianceSettings.service_warning_km ?? 10
  };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const complianceSummary = {
    taxExpired: 0,
    taxDueSoon: 0,
    nctExpired: 0,
    nctDueSoon: 0,
    serviceOverdue: 0,
    serviceDueSoon: 0,
    compliant: 0,
    issues: []
  };
  
  vehicles.forEach(vehicle => {
    let hasIssue = false;
    
    // Check Tax
    if (vehicle.tax_due_date) {
      const taxDate = new Date(vehicle.tax_due_date);
      const daysUntil = Math.ceil((taxDate - today) / (1000 * 60 * 60 * 24));
      if (daysUntil < 0) {
        complianceSummary.taxExpired++;
        complianceSummary.issues.push({ vehicle, type: 'tax', status: 'expired', days: daysUntil });
        hasIssue = true;
      } else if (daysUntil <= settings.tax_warning_days) {
        complianceSummary.taxDueSoon++;
        complianceSummary.issues.push({ vehicle, type: 'tax', status: 'due', days: daysUntil });
        hasIssue = true;
      }
    }
    
    // Check NCT
    if (vehicle.nct_due_date) {
      const nctDate = new Date(vehicle.nct_due_date);
      const daysUntil = Math.ceil((nctDate - today) / (1000 * 60 * 60 * 24));
      if (daysUntil < 0) {
        complianceSummary.nctExpired++;
        complianceSummary.issues.push({ vehicle, type: 'nct', status: 'expired', days: daysUntil });
        hasIssue = true;
      } else if (daysUntil <= settings.nct_warning_days) {
        complianceSummary.nctDueSoon++;
        complianceSummary.issues.push({ vehicle, type: 'nct', status: 'due', days: daysUntil });
        hasIssue = true;
      }
    }
    
    // Check Service
    if (vehicle.service_due_mileage && vehicle.current_mileage) {
      const kmRemaining = vehicle.service_due_mileage - vehicle.current_mileage;
      if (kmRemaining < 0) {
        complianceSummary.serviceOverdue++;
        complianceSummary.issues.push({ vehicle, type: 'service', status: 'overdue', km: kmRemaining });
        hasIssue = true;
      } else if (kmRemaining <= settings.service_warning_km) {
        complianceSummary.serviceDueSoon++;
        complianceSummary.issues.push({ vehicle, type: 'service', status: 'due', km: kmRemaining });
        hasIssue = true;
      }
    }
    
    if (!hasIssue) complianceSummary.compliant++;
  });
  
  const totalIssues = complianceSummary.taxExpired + complianceSummary.nctExpired + complianceSummary.serviceOverdue +
                       complianceSummary.taxDueSoon + complianceSummary.nctDueSoon + complianceSummary.serviceDueSoon;

  return (
    <div className="space-y-6" data-testid="fleet-reports-section">
      {/* Fleet Reports Header */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <BarChart3 className="mr-2 text-blue-600" size={20} />
            Fleet Reports
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">From:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">To:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm"
              />
            </div>
            <button
              onClick={applyDates}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              Apply Dates
            </button>
            <button
              onClick={handleExportCSV}
              className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 flex items-center space-x-1"
            >
              <Download size={16} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Vehicles</p>
              <p className="text-3xl font-bold text-gray-900">{summary.total_vehicles}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Car className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Bookings</p>
              <p className="text-3xl font-bold text-gray-900">{summary.total_bookings.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Calendar className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Bookings</p>
              <p className="text-3xl font-bold text-orange-600">{summary.pending_bookings}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="text-orange-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Blocked Cars</p>
              <p className="text-3xl font-bold text-red-600">{summary.blocked_cars}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <Lock className="text-red-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Most Booked Cars and Daily Availability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Booked Cars */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900 flex items-center">
              <TrendingUp size={18} className="mr-2 text-green-600" />
              Most Booked Cars (Ranked)
            </h3>
          </div>
          <div className="p-4">
            {most_booked_cars.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No booking data available</p>
            ) : (
              <div className="space-y-2">
                {most_booked_cars.map((car, index) => (
                  <div 
                    key={car.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <div className="flex items-center space-x-3">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-200 text-gray-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{car.name}</p>
                        <p className="text-xs text-gray-500">{car.registration}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{car.bookings.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">bookings</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Daily Availability Report */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900 flex items-center">
              <PieChart size={18} className="mr-2 text-purple-600" />
              Daily Availability Report
            </h3>
            <p className="text-xs text-gray-500 mt-1">{daily_availability.date}</p>
          </div>
          
          <div className="p-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="text-center p-2 bg-blue-50 rounded-lg">
                <p className="text-xl font-bold text-blue-700">{daily_availability.total_fleet}</p>
                <p className="text-xs text-blue-600">Total Fleet</p>
              </div>
              <div className="text-center p-2 bg-green-50 rounded-lg">
                <p className="text-xl font-bold text-green-700">{daily_availability.fully_free}</p>
                <p className="text-xs text-green-600">Fully Free</p>
              </div>
              <div className="text-center p-2 bg-orange-50 rounded-lg">
                <p className="text-xl font-bold text-orange-700">{daily_availability.partially_free}</p>
                <p className="text-xs text-orange-600">Partially Free</p>
              </div>
              <div className="text-center p-2 bg-red-50 rounded-lg">
                <p className="text-xl font-bold text-red-700">{daily_availability.fully_booked}</p>
                <p className="text-xs text-red-600">Fully Booked</p>
              </div>
            </div>

            {/* Donut Chart Visualization */}
            <div className="flex items-center justify-center">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  {/* Background circle */}
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12"/>
                  
                  {/* Free segment (green) */}
                  {freePercent > 0 && (
                    <circle 
                      cx="50" cy="50" r="40" 
                      fill="none" 
                      stroke="#22c55e" 
                      strokeWidth="12"
                      strokeDasharray={`${freePercent * 2.51} 251`}
                      strokeDashoffset="0"
                      transform="rotate(-90 50 50)"
                    />
                  )}
                  
                  {/* Partial segment (orange) */}
                  {partialPercent > 0 && (
                    <circle 
                      cx="50" cy="50" r="40" 
                      fill="none" 
                      stroke="#f97316" 
                      strokeWidth="12"
                      strokeDasharray={`${partialPercent * 2.51} 251`}
                      strokeDashoffset={`${-freePercent * 2.51}`}
                      transform="rotate(-90 50 50)"
                    />
                  )}
                  
                  {/* Booked segment (red) */}
                  {bookedPercent > 0 && (
                    <circle 
                      cx="50" cy="50" r="40" 
                      fill="none" 
                      stroke="#ef4444" 
                      strokeWidth="12"
                      strokeDasharray={`${bookedPercent * 2.51} 251`}
                      strokeDashoffset={`${-(freePercent + partialPercent) * 2.51}`}
                      transform="rotate(-90 50 50)"
                    />
                  )}
                  
                  {/* Center text */}
                  <text x="50" y="47" textAnchor="middle" className="text-2xl font-bold fill-gray-900">
                    {daily_availability.total_fleet}
                  </text>
                  <text x="50" y="58" textAnchor="middle" className="text-xs fill-gray-500">
                    Total
                  </text>
                </svg>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center space-x-4 mt-4 text-xs">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded bg-green-500"></div>
                <span className="text-gray-600">Free ({daily_availability.fully_free})</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded bg-orange-500"></div>
                <span className="text-gray-600">Partial ({daily_availability.partially_free})</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded bg-red-500"></div>
                <span className="text-gray-600">Booked ({daily_availability.fully_booked})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Summary */}
      {vehicles.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className={`px-4 py-3 border-b ${
            (complianceSummary.taxExpired + complianceSummary.nctExpired + complianceSummary.serviceOverdue) > 0 
              ? 'bg-red-50' : totalIssues > 0 ? 'bg-amber-50' : 'bg-green-50'
          }`}>
            <h3 className="font-semibold text-gray-900 flex items-center">
              <AlertTriangle size={18} className={`mr-2 ${
                (complianceSummary.taxExpired + complianceSummary.nctExpired + complianceSummary.serviceOverdue) > 0 
                  ? 'text-red-500' : totalIssues > 0 ? 'text-amber-500' : 'text-green-500'
              }`} />
              Compliance Report
              {totalIssues > 0 && (
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                  (complianceSummary.taxExpired + complianceSummary.nctExpired + complianceSummary.serviceOverdue) > 0 
                    ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'
                }`}>
                  {totalIssues} issues
                </span>
              )}
            </h3>
          </div>
          <div className="p-4">
            {/* Compliance Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className={`p-3 rounded-lg ${complianceSummary.taxExpired > 0 ? 'bg-red-100' : complianceSummary.taxDueSoon > 0 ? 'bg-amber-100' : 'bg-green-50'}`}>
                <div className="flex items-center space-x-2 mb-1">
                  <Shield size={16} className={complianceSummary.taxExpired > 0 ? 'text-red-600' : complianceSummary.taxDueSoon > 0 ? 'text-amber-600' : 'text-green-600'} />
                  <span className="text-sm font-medium text-gray-700">Tax</span>
                </div>
                {complianceSummary.taxExpired > 0 && (
                  <p className="text-sm text-red-700 font-bold">{complianceSummary.taxExpired} Expired</p>
                )}
                {complianceSummary.taxDueSoon > 0 && (
                  <p className="text-sm text-amber-700">{complianceSummary.taxDueSoon} Due Soon</p>
                )}
                {complianceSummary.taxExpired === 0 && complianceSummary.taxDueSoon === 0 && (
                  <p className="text-sm text-green-700">All OK</p>
                )}
              </div>
              
              <div className={`p-3 rounded-lg ${complianceSummary.nctExpired > 0 ? 'bg-red-100' : complianceSummary.nctDueSoon > 0 ? 'bg-amber-100' : 'bg-green-50'}`}>
                <div className="flex items-center space-x-2 mb-1">
                  <Calendar size={16} className={complianceSummary.nctExpired > 0 ? 'text-red-600' : complianceSummary.nctDueSoon > 0 ? 'text-amber-600' : 'text-green-600'} />
                  <span className="text-sm font-medium text-gray-700">NCT</span>
                </div>
                {complianceSummary.nctExpired > 0 && (
                  <p className="text-sm text-red-700 font-bold">{complianceSummary.nctExpired} Expired</p>
                )}
                {complianceSummary.nctDueSoon > 0 && (
                  <p className="text-sm text-amber-700">{complianceSummary.nctDueSoon} Due Soon</p>
                )}
                {complianceSummary.nctExpired === 0 && complianceSummary.nctDueSoon === 0 && (
                  <p className="text-sm text-green-700">All OK</p>
                )}
              </div>
              
              <div className={`p-3 rounded-lg ${complianceSummary.serviceOverdue > 0 ? 'bg-red-100' : complianceSummary.serviceDueSoon > 0 ? 'bg-amber-100' : 'bg-green-50'}`}>
                <div className="flex items-center space-x-2 mb-1">
                  <Gauge size={16} className={complianceSummary.serviceOverdue > 0 ? 'text-red-600' : complianceSummary.serviceDueSoon > 0 ? 'text-amber-600' : 'text-green-600'} />
                  <span className="text-sm font-medium text-gray-700">Service</span>
                </div>
                {complianceSummary.serviceOverdue > 0 && (
                  <p className="text-sm text-red-700 font-bold">{complianceSummary.serviceOverdue} Overdue</p>
                )}
                {complianceSummary.serviceDueSoon > 0 && (
                  <p className="text-sm text-amber-700">{complianceSummary.serviceDueSoon} Due Soon</p>
                )}
                {complianceSummary.serviceOverdue === 0 && complianceSummary.serviceDueSoon === 0 && (
                  <p className="text-sm text-green-700">All OK</p>
                )}
              </div>
              
              <div className="p-3 rounded-lg bg-green-50">
                <div className="flex items-center space-x-2 mb-1">
                  <CheckCircle size={16} className="text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Compliant</span>
                </div>
                <p className="text-sm text-green-700 font-bold">{complianceSummary.compliant} of {vehicles.length}</p>
              </div>
            </div>
            
            {/* Issues List */}
            {complianceSummary.issues.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Issues Requiring Attention</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {complianceSummary.issues.map((issue, idx) => (
                    <div 
                      key={`${issue.vehicle.id}-${issue.type}-${idx}`}
                      className={`p-2 rounded-lg text-sm flex items-center justify-between ${
                        issue.status === 'expired' || issue.status === 'overdue' 
                          ? 'bg-red-50 text-red-800' 
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {issue.type === 'tax' && <Shield size={14} />}
                        {issue.type === 'nct' && <Calendar size={14} />}
                        {issue.type === 'service' && <Gauge size={14} />}
                        <span className="font-medium">{issue.vehicle.name}</span>
                        <span className="text-xs opacity-75">({issue.vehicle.registration})</span>
                      </div>
                      <span className="text-xs font-medium">
                        {issue.type.toUpperCase()}: {
                          issue.type === 'service' 
                            ? (issue.km < 0 ? `${Math.abs(issue.km)}km overdue` : `${issue.km}km left`)
                            : (issue.days < 0 ? `${Math.abs(issue.days)} days overdue` : `${issue.days} days left`)
                        }
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Settings Note */}
            <p className="text-xs text-gray-400 mt-3 pt-3 border-t">
              Alert settings: Tax/NCT {settings.tax_warning_days} days notice | Service {settings.service_warning_km}km notice
            </p>
          </div>
        </div>
      )}

      {/* By Location Summary */}
      {location_summary && location_summary.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900 flex items-center">
              <MapPin size={18} className="mr-2 text-red-500" />
              By Location Summary
            </h3>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {location_summary.map((loc) => (
                <div key={loc.location} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <MapPin size={16} className="text-gray-400" />
                      <span className="font-medium text-gray-900">{loc.location}</span>
                      <span className="text-sm text-gray-500">({loc.total} cars)</span>
                    </div>
                    <span className="font-bold text-blue-600">{loc.utilization}%</span>
                  </div>
                  
                  {/* Availability breakdown */}
                  <div className="flex items-center space-x-4 text-xs">
                    <div className="flex items-center space-x-1">
                      <CheckCircle size={12} className="text-green-500" />
                      <span className="text-gray-600">{loc.free} free</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock size={12} className="text-orange-500" />
                      <span className="text-gray-600">{loc.partial} partial</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar size={12} className="text-purple-500" />
                      <span className="text-gray-600">{loc.booked} booked</span>
                    </div>
                    {loc.blocked > 0 && (
                      <div className="flex items-center space-x-1">
                        <Lock size={12} className="text-red-500" />
                        <span className="text-gray-600">{loc.blocked} blocked</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Utilization bar */}
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${loc.utilization}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetReportsSection;
