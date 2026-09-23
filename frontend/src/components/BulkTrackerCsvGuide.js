import React from 'react';
import { ChevronDown, Download, FileSpreadsheet } from 'lucide-react';
import { Button } from './ui/button';

const fields = [
  ['registration', 'Existing vehicle registration', '231-D-12345'],
  ['tracker_id', 'Tracker ID printed on the device · 10–20 digits', '123456789012345'],
  ['sim_iccid', 'SIM card ICCID · 18–22 digits', '8988280666000000000'],
  ['sim_msisdn', 'SIM phone number · 6–15 digits', '353871234567'],
  ['tracker_model', 'Tracker model printed on the device', 'ST-901'],
];

export const BulkTrackerCsvGuide = ({ hasTenant, busy, onExample }) => (
  <details data-testid="bulk-csv-guide" className="border-y border-gray-200 py-3 group">
    <summary data-testid="bulk-csv-guide-toggle" className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm font-medium text-gray-700 [&::-webkit-details-marker]:hidden">
      <FileSpreadsheet size={16} />CSV format & examples<ChevronDown size={14} className="ml-auto group-open:rotate-180" />
    </summary>
    <div className="pt-4 space-y-4">
      <p data-testid="bulk-template-guidance" className="text-sm text-gray-600">{hasTenant ? 'The template includes up to 200 registrations from the selected franchise. Fill in the hardware details and remove unused rows.' : 'Select a franchise for a template with its vehicle registrations, or download a blank template.'}</p>
      <div className="grid gap-0 border-t border-gray-200">
        {fields.map(([field, label, example]) => <div key={field} data-testid={`bulk-csv-field-${field.replaceAll('_', '-')}`} className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1.4fr)] gap-1 sm:gap-4 border-b border-gray-100 py-2.5 text-xs">
          <code className="break-all font-semibold text-gray-800">{field}</code><span className="text-gray-600">{label}</span><span className="font-mono text-gray-500 break-all">{example}</span>
        </div>)}
      </div>
      <p data-testid="bulk-csv-excel-note" className="text-xs text-gray-600"><strong>Excel:</strong> set tracker ID, ICCID and MSISDN columns to Text before entering values. Long numbers can otherwise be rounded and leading zeros lost. Save as CSV UTF-8; keep the five column names unchanged.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button data-testid="bulk-download-example" size="sm" variant="outline" disabled={busy} onClick={onExample}><Download />Download example CSV</Button>
        <span data-testid="bulk-example-disclaimer" className="text-xs text-gray-500">Placeholders only. Replace every example value before upload.</span>
      </div>
    </div>
  </details>
);