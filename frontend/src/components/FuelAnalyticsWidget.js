import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Fuel, Euro, Droplets, Calendar, Loader2, TrendingUp } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IE', { month: 'long', year: 'numeric' });
};

const FuelAnalyticsWidget = () => {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/documents/fuel-analytics`, {
          headers: getAuthHeaders(),
          params: { month },
        });
        setData(res.data);
      } catch (err) {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [month]);

  const maxCost = data?.vehicles?.[0]?.cost || 0;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5" data-testid="fuel-analytics-widget">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
            <Fuel size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Fuel insights</h3>
            <p className="text-xs text-slate-500">{formatMonth(month)} · auto-pulled from staff Fuel Logs</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar size={14} className="text-slate-400" />
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            data-testid="fuel-analytics-month-input"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-6 text-sm text-slate-500">
          <Loader2 className="animate-spin inline mr-2" size={14} /> Loading…
        </div>
      ) : !data ? (
        <p className="text-sm text-slate-500">Could not load fuel data.</p>
      ) : (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                <Euro size={11} /> Total spend
              </div>
              <div className="text-xl font-bold text-slate-900">€{data.total_cost.toFixed(2)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                <Droplets size={11} /> Litres
              </div>
              <div className="text-xl font-bold text-slate-900">{data.total_litres.toFixed(1)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                <TrendingUp size={11} /> Fills
              </div>
              <div className="text-xl font-bold text-slate-900">{data.submissions_count}</div>
            </div>
          </div>

          {/* Per-vehicle breakdown */}
          {data.vehicles.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl">
              <p className="text-sm text-slate-500">No fuel logs submitted this month.</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">By vehicle</div>
                <div className="text-xs text-slate-400">€ spend · litres · fills</div>
              </div>
              <div className="space-y-2">
                {data.vehicles.map((v) => {
                  const pct = maxCost > 0 ? (v.cost / maxCost) * 100 : 0;
                  return (
                    <div
                      key={v.vehicle_id}
                      className="rounded-lg border border-slate-200 p-2.5"
                      data-testid={`fuel-row-${v.vehicle_id}`}
                    >
                      <div className="flex items-center justify-between mb-1.5 text-sm">
                        <span className="font-medium text-slate-900 truncate pr-2">
                          {v.vehicle_registration}
                        </span>
                        <span className="text-slate-700 flex-shrink-0 tabular-nums">
                          <span className="font-semibold">€{v.cost.toFixed(2)}</span>
                          <span className="text-slate-400 mx-1.5">·</span>
                          <span className="text-slate-600">{v.litres.toFixed(1)}L</span>
                          <span className="text-slate-400 mx-1.5">·</span>
                          <span className="text-slate-600">{v.fills}</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FuelAnalyticsWidget;
