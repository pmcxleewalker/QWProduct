import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';

const columns = 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1.7fr)_minmax(0,1.1fr)_minmax(0,1.1fr)]';
const statusStyles = {
  'Ready to start': 'bg-slate-100 text-slate-700',
  'Activating SIM': 'bg-blue-50 text-blue-800',
  'Sending messages': 'bg-blue-50 text-blue-800',
  'Waiting for delivery': 'bg-amber-50 text-amber-800',
  Configured: 'bg-emerald-50 text-emerald-800',
  Failed: 'bg-red-50 text-red-800',
};

export const BulkTrackerRows = ({ batch, configured, busy, onRetry }) => (
  <div data-testid="bulk-tracker-review-table" className="w-full rounded-md border border-gray-200 bg-white overflow-hidden">
    <div className={`hidden lg:grid ${columns} gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600`}>
      {['Vehicle', 'Tracker', 'SIM details', 'Status', 'SMS delivery'].map(label => <span key={label}>{label}</span>)}
    </div>
    {batch.rows.map((row, index) => {
      const errors = [...row.errors, row.error].filter(Boolean);
      return (
        <div key={row.id} data-testid={`bulk-tracker-row-${row.id}`} className={`border-t first:border-t-0 border-gray-200 ${errors.length ? 'border-l-[3px] border-l-red-400' : 'border-l-[3px] border-l-transparent'}`}>
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${columns} gap-x-4 gap-y-4 px-4 py-4 items-start text-sm`}>
            <div className="min-w-0">
              <div data-testid={`bulk-row-number-${row.id}`} className="mb-1 text-xs text-gray-500">Row {index + 1}</div>
              <div data-testid={`bulk-registration-${row.id}`} className="font-semibold text-gray-900 break-words">{row.registration || 'Registration missing'}</div>
            </div>
            <div data-testid={`bulk-tracker-identity-${row.id}`} className="min-w-0">
              <span className="block mb-1 text-xs text-gray-500">Tracker ID</span>
              <span className="block font-mono text-xs leading-5 break-all text-gray-900">{row.tracker_id || '—'}</span>
              <span data-testid={`bulk-tracker-model-${row.id}`} className="block mt-1 text-xs text-gray-500 break-words">{row.tracker_model || 'Model missing'}</span>
            </div>
            <div className="min-w-0 space-y-2">
              <div data-testid={`bulk-iccid-${row.id}`}><span className="block text-xs text-gray-500">ICCID</span><span className="font-mono text-xs leading-5 break-all text-gray-900">{row.sim_iccid || '—'}</span></div>
              <div data-testid={`bulk-msisdn-${row.id}`}><span className="block text-xs text-gray-500">MSISDN</span><span className="font-mono text-xs leading-5 break-all text-gray-900">{row.sim_msisdn || '—'}</span></div>
            </div>
            <div className="min-w-0">
              <span className="block lg:hidden mb-1 text-xs text-gray-500">Status</span>
              <span data-testid={`bulk-status-${row.id}`} className={`inline-flex items-start gap-1.5 rounded px-2 py-1 text-xs font-medium ${statusStyles[row.status]}`}><span aria-hidden="true" className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />{row.status}</span>
            </div>
            <div className="min-w-0 space-y-2">
              <span data-testid={`bulk-delivery-${row.id}`} className="block text-xs tabular-nums font-medium text-gray-700">{row.delivered}/4 delivered</span>
              <div data-testid={`bulk-delivery-progress-${row.id}`} role="progressbar" aria-label={`SMS delivered for ${row.registration || `row ${index + 1}`}`} aria-valuenow={row.delivered} aria-valuemin={0} aria-valuemax={4} className="flex gap-1 max-w-28">
                {[0, 1, 2, 3].map(segment => <span key={segment} className={`h-1.5 flex-1 rounded-sm ${segment < row.delivered ? 'bg-emerald-600' : 'bg-gray-200'}`} />)}
              </div>
              {batch.started_at && ['Failed', 'Waiting for delivery'].includes(row.status) && (
                <Button data-testid={`bulk-retry-${row.id}`} variant="outline" size="sm" disabled={!configured || busy || row.retry_requested} onClick={() => onRetry(row.id)}><RotateCcw size={13} />Retry failed</Button>
              )}
            </div>
          </div>
          {errors.length > 0 && <div data-testid={`bulk-row-error-${row.id}`} role="alert" className="flex items-start gap-2 border-t border-red-100 bg-red-50/60 px-4 py-3 text-xs text-red-800">
            <AlertCircle size={14} className="shrink-0 mt-0.5" /><div className="min-w-0"><span className="font-semibold">Needs attention</span><ul className="mt-1 space-y-1 list-disc pl-4">{errors.map((error, i) => <li key={i} data-testid={`bulk-row-error-${row.id}-${i}`} className="break-words">{error}</li>)}</ul></div>
          </div>}
        </div>
      );
    })}
  </div>
);