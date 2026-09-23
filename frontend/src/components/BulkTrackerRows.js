import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from './ui/button';

export const BulkTrackerRows = ({ batch, configured, busy, onRetry }) => (
  <div data-testid="bulk-tracker-review-table" className="w-full border-y border-gray-200">
    <div className="hidden lg:grid grid-cols-[1fr_1.2fr_1.6fr_1.1fr_1.1fr_1.4fr] gap-3 bg-gray-100 p-3 text-xs font-semibold text-gray-600">
      {['Registration', 'Tracker ID / model', 'SIM ICCID', 'SIM MSISDN', 'Status', 'SMS delivery'].map(label => <span key={label}>{label}</span>)}
    </div>
    {batch.rows.map(row => (
      <div key={row.id} data-testid={`bulk-tracker-row-${row.id}`} className="border-t first:border-t-0 p-3 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_1.6fr_1.1fr_1.1fr_1.4fr] gap-3 items-start">
          <div className="min-w-0 break-words" data-testid={`bulk-registration-${row.id}`}><span className="block lg:hidden text-xs text-gray-500">Registration</span>{row.registration || '—'}</div>
          <div className="min-w-0 break-all" data-testid={`bulk-tracker-identity-${row.id}`}><span className="block lg:hidden text-xs text-gray-500">Tracker ID / model</span>{row.tracker_id || '—'}<span className="block text-gray-500">{row.tracker_model || '—'}</span></div>
          <div className="min-w-0 break-all font-mono text-xs" data-testid={`bulk-iccid-${row.id}`}><span className="block lg:hidden font-sans text-gray-500">SIM ICCID</span>{row.sim_iccid || '—'}</div>
          <div className="min-w-0 break-all text-xs" data-testid={`bulk-msisdn-${row.id}`}><span className="block lg:hidden text-gray-500">SIM MSISDN</span>{row.sim_msisdn || '—'}</div>
          <span data-testid={`bulk-status-${row.id}`} className={row.status === 'Failed' ? 'text-red-700' : row.status === 'Configured' ? 'text-green-700' : 'text-gray-700'}>{row.status}</span>
          <div className="flex flex-wrap items-center gap-2">
            <span data-testid={`bulk-delivery-${row.id}`} className="tabular-nums">{row.delivered}/4 delivered</span>
            {batch.started_at && ['Failed', 'Waiting for delivery'].includes(row.status) && (
              <Button data-testid={`bulk-retry-${row.id}`} variant="outline" size="sm" disabled={!configured || busy || row.retry_requested} onClick={() => onRetry(row.id)}><RotateCcw size={13} />Retry failed</Button>
            )}
          </div>
        </div>
        {(row.errors.length > 0 || row.error) && <p data-testid={`bulk-row-error-${row.id}`} role="alert" className="mt-2 text-xs text-red-700 break-words">{[...row.errors, row.error].filter(Boolean).join('; ')}</p>}
      </div>
    ))}
  </div>
);