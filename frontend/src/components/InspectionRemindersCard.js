import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ClipboardCheck, ChevronDown, ChevronUp, AlertTriangle, Clock } from 'lucide-react';
import useCollapseState from '../hooks/useCollapseState';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Admin-only card that lists vehicles whose next Car Inspection Sheet is
 * overdue (or due within 24h). Renders nothing when everything is on track.
 */
const InspectionRemindersCard = ({ onViewDocuments }) => {
  const [data, setData] = useState({ vehicles: [], overdue_count: 0, due_soon_count: 0 });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useCollapseState('qw:panel:inspection-reminders', true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await axios.get(`${API}/vehicles/inspection-status`);
        if (!cancelled) setData(res.data || { vehicles: [], overdue_count: 0, due_soon_count: 0 });
      } catch (e) {
        // silent — best-effort widget
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 60000); // refresh every minute
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (loading) return null;
  const total = (data.overdue_count || 0) + (data.due_soon_count || 0);
  if (total === 0) return null; // hide when everything's on track

  // Show overdue first, then due-soon (which are the non-overdue ones)
  const overdue = data.vehicles.filter((v) => v.is_overdue);
  const dueSoon = data.vehicles.filter((v) => !v.is_overdue);

  return (
    <div
      className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm"
      data-testid="inspection-reminders-card"
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-amber-50/60 transition-colors"
        data-testid="inspection-reminders-toggle"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
            <ClipboardCheck size={18} />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              Inspection Reminders
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                {total} {total === 1 ? 'issue' : 'issues'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {data.overdue_count > 0 && (
                <span className="text-rose-600 font-medium">
                  {data.overdue_count} overdue
                </span>
              )}
              {data.overdue_count > 0 && data.due_soon_count > 0 && <span> · </span>}
              {data.due_soon_count > 0 && (
                <span className="text-amber-700 font-medium">
                  {data.due_soon_count} due within 24h
                </span>
              )}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-amber-100 divide-y divide-slate-100">
          {overdue.map((v) => (
            <InspectionRow key={v.vehicle_id} row={v} tone="overdue" />
          ))}
          {dueSoon.map((v) => (
            <InspectionRow key={v.vehicle_id} row={v} tone="due-soon" />
          ))}

          {onViewDocuments && (
            <div className="p-3 bg-slate-50/60 flex justify-end">
              <button
                onClick={onViewDocuments}
                className="text-xs font-medium text-blue-700 hover:underline"
                data-testid="inspection-reminders-open-docs"
              >
                Open Documents →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const InspectionRow = ({ row, tone }) => {
  const isOverdue = tone === 'overdue';
  const daysLabel = row.days_since === null || row.days_since === undefined
    ? 'Never inspected'
    : `${row.days_since} day${row.days_since === 1 ? '' : 's'} since last check`;

  return (
    <div
      className="p-3 flex items-center gap-3"
      data-testid={`inspection-row-${row.vehicle_id}`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isOverdue ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
      }`}>
        {isOverdue ? <AlertTriangle size={15} /> : <Clock size={15} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">
          {row.name || 'Vehicle'} <span className="font-normal text-slate-500">· {row.registration}</span>
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {daysLabel} · every {row.frequency_days} day{row.frequency_days === 1 ? '' : 's'}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
          isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
        }`}>
          {isOverdue ? 'Overdue' : 'Due soon'}
        </span>
      </div>
    </div>
  );
};

export default InspectionRemindersCard;
