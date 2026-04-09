import React, { useState, useEffect, useCallback } from 'react';
import { 
  DollarSign, TrendingUp, TrendingDown, Fuel, Wrench, Car,
  Calendar, RefreshCw, RotateCcw, PieChart, BarChart3, 
  ArrowUp, ArrowDown, Minus, AlertCircle, CheckCircle
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CostAnalyticsDashboard = ({ settings, vehicles = [], mileageLogs = [], onResetSettings }) => {
  const [timeRange, setTimeRange] = useState('month'); // week, month, quarter, year
  const [loading, setLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  
  // Get currency symbol
  const getCurrencySymbol = (currency) => {
    switch(currency) {
      case 'GBP': return '£';
      case 'USD': return '$';
      default: return '€';
    }
  };
  
  const currencySymbol = getCurrencySymbol(settings?.currency || 'EUR');
  const distanceUnit = settings?.distance_unit || 'km';
  
  // Calculate analytics based on settings and data
  const calculateAnalytics = useCallback(() => {
    if (!settings || !vehicles.length) return null;
    
    const now = new Date();
    let startDate;
    
    switch(timeRange) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'quarter':
        startDate = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default: // month
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }
    
    // Filter mileage logs by time range
    const filteredLogs = mileageLogs.filter(log => {
      const logDate = new Date(log.created_at || log.timestamp);
      return logDate >= startDate;
    });
    
    // Calculate total mileage in period
    let totalMileage = 0;
    const vehicleMileage = {};
    
    vehicles.forEach(v => {
      vehicleMileage[v.id] = {
        name: v.name,
        registration: v.registration,
        startMileage: v.current_mileage || 0,
        endMileage: v.current_mileage || 0,
        distance: 0
      };
    });
    
    // Calculate mileage per vehicle from logs
    filteredLogs.forEach(log => {
      if (vehicleMileage[log.vehicle_id]) {
        const prevMileage = log.previous_mileage || 0;
        const newMileage = log.mileage || 0;
        const distance = newMileage - prevMileage;
        if (distance > 0) {
          vehicleMileage[log.vehicle_id].distance += distance;
          totalMileage += distance;
        }
      }
    });
    
    // Calculate costs using settings
    const mileageRate = settings.mileage_rate || 0.35;
    const fuelCostPerKm = settings.fuel_cost_per_km || 0.12;
    const maintenanceCostPerKm = settings.maintenance_cost_per_km || 0.08;
    
    const fuelCost = totalMileage * fuelCostPerKm;
    const maintenanceCost = totalMileage * maintenanceCostPerKm;
    const totalCost = totalMileage * mileageRate;
    const otherCosts = totalCost - fuelCost - maintenanceCost;
    
    // Calculate per-vehicle costs
    const vehicleCosts = Object.entries(vehicleMileage).map(([id, data]) => ({
      id,
      name: data.name,
      registration: data.registration,
      distance: data.distance,
      fuelCost: data.distance * fuelCostPerKm,
      maintenanceCost: data.distance * maintenanceCostPerKm,
      totalCost: data.distance * mileageRate
    })).sort((a, b) => b.totalCost - a.totalCost);
    
    // Calculate averages
    const avgCostPerVehicle = vehicles.length > 0 ? totalCost / vehicles.length : 0;
    const avgDistancePerVehicle = vehicles.length > 0 ? totalMileage / vehicles.length : 0;
    
    // Cost breakdown percentages
    const fuelPercent = totalCost > 0 ? (fuelCost / totalCost) * 100 : 0;
    const maintenancePercent = totalCost > 0 ? (maintenanceCost / totalCost) * 100 : 0;
    const otherPercent = totalCost > 0 ? (otherCosts / totalCost) * 100 : 0;
    
    return {
      totalMileage,
      totalCost,
      fuelCost,
      maintenanceCost,
      otherCosts,
      avgCostPerVehicle,
      avgDistancePerVehicle,
      vehicleCosts,
      costBreakdown: {
        fuel: { amount: fuelCost, percent: fuelPercent },
        maintenance: { amount: maintenanceCost, percent: maintenancePercent },
        other: { amount: otherCosts, percent: otherPercent }
      },
      settings: {
        mileageRate,
        fuelCostPerKm,
        maintenanceCostPerKm
      }
    };
  }, [settings, vehicles, mileageLogs, timeRange]);
  
  useEffect(() => {
    setAnalyticsData(calculateAnalytics());
  }, [calculateAnalytics]);
  
  const formatCurrency = (amount) => {
    return `${currencySymbol}${amount.toFixed(2)}`;
  };
  
  const formatDistance = (distance) => {
    return `${distance.toLocaleString()} ${distanceUnit}`;
  };
  
  const handleReset = () => {
    if (window.confirm('Reset all cost analytics settings to defaults?\n\nDefaults:\n• Mileage Rate: €0.35/km\n• Fuel Cost: €0.12/km\n• Maintenance: €0.08/km')) {
      onResetSettings?.();
      toast.success('Settings reset to defaults');
    }
  };
  
  if (!settings) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
        <AlertCircle className="mx-auto mb-3 text-yellow-600" size={40} />
        <p className="text-yellow-800 font-medium">Cost Analytics not configured</p>
        <p className="text-sm text-yellow-600 mt-1">Configure your rates in Settings to see analytics</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6" data-testid="cost-analytics-dashboard">
      {/* Header with Time Range & Reset */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <PieChart className="text-purple-600" size={24} />
            Cost Analytics Dashboard
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Based on your configured rates: {formatCurrency(settings.mileage_rate || 0.35)}/{distanceUnit}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            data-testid="time-range-select"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last 3 Months</option>
            <option value="year">Last 12 Months</option>
          </select>
          
          {/* Reset Button */}
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            data-testid="reset-settings-btn"
          >
            <RotateCcw size={16} />
            Reset Rates
          </button>
        </div>
      </div>
      
      {/* Current Configuration Card */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="text-purple-600" size={18} />
            <span className="font-medium text-purple-900">Current Configuration</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-purple-700">
              <strong>Mileage:</strong> {formatCurrency(settings.mileage_rate || 0.35)}/{distanceUnit}
            </span>
            <span className="text-purple-700">
              <strong>Fuel:</strong> {formatCurrency(settings.fuel_cost_per_km || 0.12)}/{distanceUnit}
            </span>
            <span className="text-purple-700">
              <strong>Maintenance:</strong> {formatCurrency(settings.maintenance_cost_per_km || 0.08)}/{distanceUnit}
            </span>
          </div>
        </div>
      </div>
      
      {analyticsData ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Distance */}
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex items-center justify-between mb-3">
                <Car className="text-blue-500" size={24} />
                <span className="text-xs text-gray-400 uppercase">Total Distance</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatDistance(analyticsData.totalMileage)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {vehicles.length} vehicles tracked
              </p>
            </div>
            
            {/* Total Cost */}
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex items-center justify-between mb-3">
                <DollarSign className="text-green-500" size={24} />
                <span className="text-xs text-gray-400 uppercase">Total Cost</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(analyticsData.totalCost)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                This {timeRange}
              </p>
            </div>
            
            {/* Fuel Cost */}
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex items-center justify-between mb-3">
                <Fuel className="text-orange-500" size={24} />
                <span className="text-xs text-gray-400 uppercase">Fuel Cost</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(analyticsData.fuelCost)}
              </p>
              <p className="text-sm text-orange-600 mt-1">
                {analyticsData.costBreakdown.fuel.percent.toFixed(1)}% of total
              </p>
            </div>
            
            {/* Maintenance Cost */}
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex items-center justify-between mb-3">
                <Wrench className="text-purple-500" size={24} />
                <span className="text-xs text-gray-400 uppercase">Maintenance</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(analyticsData.maintenanceCost)}
              </p>
              <p className="text-sm text-purple-600 mt-1">
                {analyticsData.costBreakdown.maintenance.percent.toFixed(1)}% of total
              </p>
            </div>
          </div>
          
          {/* Cost Breakdown Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visual Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <PieChart size={18} className="text-purple-600" />
                Cost Breakdown
              </h3>
              
              {/* Simple Bar Chart */}
              <div className="space-y-4">
                {/* Fuel */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-2">
                      <Fuel size={14} className="text-orange-500" />
                      Fuel
                    </span>
                    <span className="font-medium">{formatCurrency(analyticsData.fuelCost)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div 
                      className="bg-orange-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${analyticsData.costBreakdown.fuel.percent}%` }}
                    />
                  </div>
                </div>
                
                {/* Maintenance */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-2">
                      <Wrench size={14} className="text-purple-500" />
                      Maintenance
                    </span>
                    <span className="font-medium">{formatCurrency(analyticsData.maintenanceCost)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div 
                      className="bg-purple-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${analyticsData.costBreakdown.maintenance.percent}%` }}
                    />
                  </div>
                </div>
                
                {/* Other */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-2">
                      <DollarSign size={14} className="text-gray-500" />
                      Other (Insurance, Depreciation, etc.)
                    </span>
                    <span className="font-medium">{formatCurrency(analyticsData.otherCosts)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div 
                      className="bg-gray-400 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${analyticsData.costBreakdown.other.percent}%` }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span className="text-xs text-gray-600">Fuel ({analyticsData.costBreakdown.fuel.percent.toFixed(0)}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="text-xs text-gray-600">Maintenance ({analyticsData.costBreakdown.maintenance.percent.toFixed(0)}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-400" />
                  <span className="text-xs text-gray-600">Other ({analyticsData.costBreakdown.other.percent.toFixed(0)}%)</span>
                </div>
              </div>
            </div>
            
            {/* Averages Card */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 size={18} className="text-blue-600" />
                Fleet Averages
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Avg Cost per Vehicle</p>
                    <p className="text-xs text-blue-500">This {timeRange}</p>
                  </div>
                  <p className="text-2xl font-bold text-blue-700">
                    {formatCurrency(analyticsData.avgCostPerVehicle)}
                  </p>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div>
                    <p className="text-sm text-green-600 font-medium">Avg Distance per Vehicle</p>
                    <p className="text-xs text-green-500">This {timeRange}</p>
                  </div>
                  <p className="text-2xl font-bold text-green-700">
                    {formatDistance(Math.round(analyticsData.avgDistancePerVehicle))}
                  </p>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                  <div>
                    <p className="text-sm text-purple-600 font-medium">Cost per {distanceUnit.toUpperCase()}</p>
                    <p className="text-xs text-purple-500">Based on your rates</p>
                  </div>
                  <p className="text-2xl font-bold text-purple-700">
                    {formatCurrency(settings.mileage_rate || 0.35)}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Vehicle Cost Table */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Car size={18} className="text-gray-600" />
                Cost by Vehicle
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Distance</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Fuel Cost</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Maintenance</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {analyticsData.vehicleCosts.slice(0, 10).map((vehicle, index) => (
                    <tr key={vehicle.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Car size={16} className="text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{vehicle.name}</p>
                            <p className="text-xs text-gray-500">{vehicle.registration}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600">
                        {formatDistance(vehicle.distance)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-orange-600">
                        {formatCurrency(vehicle.fuelCost)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-purple-600">
                        {formatCurrency(vehicle.maintenanceCost)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-semibold text-gray-900">{formatCurrency(vehicle.totalCost)}</span>
                      </td>
                    </tr>
                  ))}
                  
                  {analyticsData.vehicleCosts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        <Car size={32} className="mx-auto mb-2 opacity-50" />
                        <p>No mileage data recorded for this period</p>
                        <p className="text-xs mt-1">Vehicle costs will appear once mileage is logged</p>
                      </td>
                    </tr>
                  )}
                </tbody>
                
                {analyticsData.vehicleCosts.length > 0 && (
                  <tfoot className="bg-gray-100 border-t">
                    <tr>
                      <td className="px-6 py-4 font-semibold text-gray-900">Total</td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">
                        {formatDistance(analyticsData.totalMileage)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-orange-600">
                        {formatCurrency(analyticsData.fuelCost)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-purple-600">
                        {formatCurrency(analyticsData.maintenanceCost)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">
                        {formatCurrency(analyticsData.totalCost)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
          
          {/* Info Footer */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
            <div className="text-sm">
              <p className="text-blue-800 font-medium">How costs are calculated</p>
              <p className="text-blue-600 mt-1">
                Total Cost = Distance × Mileage Rate ({formatCurrency(settings.mileage_rate || 0.35)}/{distanceUnit}). 
                Fuel and maintenance are calculated separately using your configured rates and shown as a percentage breakdown.
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <Car size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 font-medium">No analytics data available</p>
          <p className="text-sm text-gray-500 mt-1">Start logging vehicle mileage to see cost analytics</p>
        </div>
      )}
    </div>
  );
};

export default CostAnalyticsDashboard;
