import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Download, Upload, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { BulkTrackerRows } from '../components/BulkTrackerRows';
import { useConfirm } from '../components/ConfirmDialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/platform/bulk-tracker-setup`;
const errorText = e => typeof e.response?.data?.detail === 'string' ? e.response.data.detail : 'Unable to complete this request. Please try again.';

export default function BulkTrackerSetup({ tenants }) {
  const confirm = useConfirm();
  const [tenantId, setTenantId] = useState('');
  const [file, setFile] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [batches, setBatches] = useState([]);
  const [batch, setBatch] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = useRef(sessionStorage.getItem('quickwing-tracker-batch') || null);
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    const wanted = selected.current;
    const { data } = await axios.get(API);
    setConfigured(data.configured);
    setBatches(data.batches);
    setLoaded(true);
    if (wanted && selected.current === wanted) {
      try {
        const result = await axios.get(`${API}/batches/${wanted}`);
        if (selected.current === wanted) {
          setBatch(result.data);
          setTenantId(result.data.tenant_id);
        }
      } catch (e) {
        if (e.response?.status === 404 && selected.current === wanted) {
          selected.current = null; sessionStorage.removeItem('quickwing-tracker-batch'); setBatch(null);
        }
        throw e;
      }
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const poll = () => refresh().catch(e => { if (alive) setError(errorText(e)); });
    poll();
    const timer = setInterval(poll, 6000);
    return () => { alive = false; clearInterval(timer); };
  }, [refresh]);

  const chooseBatch = async id => {
    selected.current = id || null;
    if (!id) { sessionStorage.removeItem('quickwing-tracker-batch'); setBatch(null); return; }
    sessionStorage.setItem('quickwing-tracker-batch', id);
    try {
      const { data } = await axios.get(`${API}/batches/${id}`);
      if (selected.current === id) { setBatch(data); setTenantId(data.tenant_id); }
    } catch (e) { setError(errorText(e)); }
  };

  const run = async operation => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await operation(); } catch (e) { setError(errorText(e)); }
    finally { busyRef.current = false; setBusy(false); }
  };

  const review = () => run(async () => {
    if (!tenantId || !file) return;
    const form = new FormData(); form.append('tenant_id', tenantId); form.append('file', file);
    const { data } = await axios.post(`${API}/review`, form);
    selected.current = data.id; sessionStorage.setItem('quickwing-tracker-batch', data.id);
    setBatch(data); await refresh();
  });

  const activate = () => run(async () => {
    const id = batch.id;
    if (!await confirm({ title: 'Activate and Configure?', description: `${batch.rows.length} tracker(s) for ${batch.tenant_name}. Activate their SIMs and send four configuration messages to each SIM.`, confirmLabel: 'Activate and Configure' })) return;
    await axios.post(`${API}/batches/${id}/activate`); await refresh();
  });

  const download = () => run(async () => {
    const { data } = await axios.get(`${API}/template`, { responseType: 'blob' });
    const url = URL.createObjectURL(data); const a = document.createElement('a');
    a.href = url; a.download = 'quick-wing-tracker-template.csv'; a.click(); URL.revokeObjectURL(url);
  });

  return (
    <section data-testid="bulk-tracker-setup-page" className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 data-testid="bulk-tracker-title" className="text-lg font-semibold text-gray-900">Bulk Tracker Setup</h2>
        <Button data-testid="bulk-download-template" size="sm" variant="outline" onClick={download} disabled={busy}><Download />Download CSV template</Button>
      </div>
      {!loaded && <p data-testid="onence-config-loading" role="status" className="text-sm text-gray-600">Checking 1NCE configuration…</p>}
      {loaded && !configured && <div data-testid="onence-not-configured" role="alert" className="flex items-center gap-2 border border-amber-200 bg-amber-50 p-3 rounded-md text-sm text-amber-900"><AlertCircle size={18} className="shrink-0" />1NCE integration not configured</div>}
      {error && <div data-testid="bulk-setup-error" role="alert" className="text-sm text-red-700 break-words">{error}</div>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] items-end gap-4">
        <label className="text-sm font-medium text-gray-700">Franchise / client
          <select data-testid="bulk-tenant-select" className="block w-full min-w-0 mt-1 h-10 border border-gray-300 rounded-md px-2 bg-white" value={tenantId} disabled={busy} onChange={e => { setTenantId(e.target.value); chooseBatch(''); }}>
            <option value="">Select franchise / client</option>{tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">Tracker CSV
          <Input data-testid="bulk-csv-upload" className="mt-1 bg-white min-w-0" type="file" accept=".csv,text/csv" disabled={!tenantId || busy} onChange={e => setFile(e.target.files?.[0] || null)} />
        </label>
        <Button data-testid="bulk-review-csv" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={!tenantId || !file || busy} onClick={review}><Upload />Review CSV</Button>
      </div>
      <div className="flex flex-wrap gap-3 items-end border-t pt-5">
        <label className="text-sm font-medium text-gray-700 min-w-0 flex-1">Saved batches
          <select data-testid="bulk-batch-select" className="block mt-1 w-full min-w-0 h-10 border border-gray-300 rounded-md px-2 bg-white" value={batch?.id || ''} disabled={busy} onChange={e => { const id = e.target.value; run(() => chooseBatch(id)); }}>
            <option value="">Select a batch</option>{batches.map(b => <option key={b.id} value={b.id}>{b.tenant_name} · {new Date(b.created_at).toLocaleString()} · {b.row_count} tracker(s)</option>)}
          </select>
        </label>
        <Button data-testid="bulk-refresh-batches" variant="outline" disabled={busy} onClick={() => run(refresh)}><RefreshCw />Refresh</Button>
      </div>
      {batch && <>
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div><h3 data-testid="bulk-review-tenant" className="font-semibold text-gray-900">{batch.tenant_name}</h3><p data-testid="bulk-review-summary" className="text-sm text-gray-600">{batch.rows.length} tracker(s) · {batch.rows.filter(r => r.errors.length).length} row(s) with validation errors</p></div>
          {!batch.started_at && <Button data-testid="bulk-activate-configure" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={!configured || !batch.valid || busy} onClick={activate}>Activate and Configure</Button>}
        </div>
        <BulkTrackerRows batch={batch} configured={configured} busy={busy} onRetry={id => run(async () => { await axios.post(`${API}/batches/${batch.id}/rows/${id}/retry`); await refresh(); })} />
      </>}
    </section>
  );
}