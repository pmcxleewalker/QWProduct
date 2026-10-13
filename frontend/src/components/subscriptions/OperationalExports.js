import { useState } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { subscriptionApi, errorMessage } from './useSubscriptionData';

export const OperationalExports = () => {
  const today = new Date().toISOString().slice(0,10);
  const [kind, setKind] = useState('bookings');
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const download = async (format) => {
    setBusy(true); setError('');
    try {
      const result = await axios.get(`${subscriptionApi}/tenant/subscription/reports/${kind}/${format}`, { params: { start, end }, responseType: 'blob' });
      const url = URL.createObjectURL(result.data); const link = document.createElement('a');
      link.href = url; link.download = `quickwing-${kind}-${start}-${end}.${format}`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      if (err.response?.data instanceof Blob) {
        try { const detail = JSON.parse(await err.response.data.text()); setError(typeof detail.detail === 'string' ? detail.detail : 'Check the dates and try again.'); }
        catch { setError('Unable to download this report.'); }
      } else setError(errorMessage(err));
    } finally { setBusy(false); }
  };
  return <section className="border border-stone-200 rounded-lg bg-white p-5" data-testid="operational-exports"><h3 className="text-lg font-semibold">Operational report downloads</h3><p className="text-xs text-gray-600 mt-2">Recorded data only. Dates are UTC; compliance is a current snapshot. No idle-time or cost-saving estimates.</p><div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4"><label className="text-sm">Report<select className="w-full p-2 border rounded mt-1" data-testid="operational-report-kind" value={kind} onChange={e => setKind(e.target.value)}><option value="bookings">Detailed bookings</option><option value="gps">GPS recorded samples</option><option value="compliance">Compliance records</option><option value="availability">Daily calendar availability</option></select></label><label className="text-sm">From<input className="w-full p-2 border rounded mt-1" data-testid="operational-report-start" type="date" value={start} onChange={e => setStart(e.target.value)} /></label><label className="text-sm">To<input className="w-full p-2 border rounded mt-1" data-testid="operational-report-end" type="date" value={end} min={start} onChange={e => setEnd(e.target.value)} /></label></div><div className="flex flex-wrap gap-3 mt-4"><Button data-testid="operational-export-csv" disabled={busy || !start || !end} onClick={() => download('csv')}>Download CSV</Button><Button data-testid="operational-export-pdf" variant="outline" disabled={busy || !start || !end} onClick={() => download('pdf')}>Download PDF</Button></div>{error && <p className="text-sm text-red-700 mt-3" role="alert" data-testid="operational-export-error">{error}</p>}</section>;
};