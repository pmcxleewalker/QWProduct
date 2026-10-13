import { useRef, useState } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { QuoteSummary } from './QuoteSummary';
import { useSubscriptionData, subscriptionApi, errorMessage, money, newKey } from './useSubscriptionData';
import './Subscriptions.css';

export const PlatformSubscriptions = () => {
  const controls = useSubscriptionData('/platform/subscriptions');
  const catalog = useSubscriptionData('/public/subscription-catalog');
  const [selected, setSelected] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [tax, setTax] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [hardware, setHardware] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const keys = useRef({});
  const choose = (account, request) => {
    setSelected({ account, request }); setQuantity(String(Math.max(1, account.vehicle_count)));
    setDate(request.requested_effective_date); setTax(''); setNotes(''); setHardware(''); setConfirmed(false); setError('');
  };
  const send = async (action, payload) => {
    setBusy(true); setError('');
    const { account, request } = selected;
    const id = `${request.id}-${account.revision}-${action}`;
    keys.current[id] ||= newKey();
    try {
      await axios.post(`${subscriptionApi}/platform/subscriptions/${account.tenant_id}/requests/${request.id}/${action}`, { ...payload, revision: account.revision, idempotency_key: keys.current[id] });
      setSelected(null); await controls.reload();
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };
  const rows = (controls.data?.items || []).flatMap(account => account.requests.map(request => ({ account, request }))).sort((a,b) => b.request.requested_at.localeCompare(a.request.requested_at));
  return <div className="subscription-page platform-subscriptions" data-testid="platform-subscriptions">
    <header className="subscription-page-header"><div><p className="subscription-eyebrow">Consent-led changes</p><h1>Subscription requests</h1></div><Button variant="outline" data-testid="platform-subscriptions-refresh" onClick={controls.reload}>Refresh</Button></header>
    <p className="subscription-safety" data-testid="platform-subscriptions-safety">Review → tenant acceptance → manual application. This changes only the separate plan agreement. Stored tenant prices, capacity, overrides, invoices, vehicle records and GPS settings are not rewritten.</p>
    {controls.loading && <p role="status" data-testid="platform-subscriptions-loading">Loading requests…</p>}
    {controls.error && <p role="alert" data-testid="platform-subscriptions-error">{controls.error}</p>}
    {!controls.loading && !rows.length && <p className="subscription-empty" data-testid="platform-subscriptions-empty">No subscription changes requested yet.</p>}
    <div className="subscription-review-list">{rows.map(({ account, request }) => <article key={request.id} data-testid={`platform-request-${request.id}`}><div><h2>{account.tenant_name}</h2><p>QuickWing {request.plan[0].toUpperCase() + request.plan.slice(1)} · {request.requested_at.slice(0,10)}</p><span className="subscription-status-pill" data-testid={`platform-status-${request.id}`}>{request.status}</span></div><Button variant="outline" data-testid={`platform-review-${request.id}`} onClick={() => choose(account, request)}>{request.status === 'requested' ? 'Review' : request.status === 'accepted' ? 'Apply accepted change' : 'View'}</Button></article>)}</div>
    <Dialog open={!!selected} onOpenChange={open => { if (!open && !busy) setSelected(null); }}><DialogContent className="subscription-review-dialog" data-testid="subscription-review-dialog" closeButtonTestId="subscription-review-close"><DialogHeader><DialogTitle>{selected?.account.tenant_name} — {selected?.request.plan}</DialogTitle><DialogDescription>Prices are catalogue references, not payment instructions. No automatic billing occurs.</DialogDescription></DialogHeader>
      {selected && <div className="subscription-review-body"><p data-testid="platform-request-reason">{selected.request.reason || 'No additional notes.'}</p>
        {selected.request.quote && <QuoteSummary quote={selected.request.quote} prefix="platform" />}
        {selected.request.status === 'requested' && <form data-testid="platform-quote-form" onSubmit={e => { e.preventDefault(); send('review', { decision: 'quote', notes, effective_date: date, vehicle_quantity: Number(quantity), tax_treatment: tax, hardware_terms: hardware }); }}>
          <p data-testid="platform-unit-rate">Catalogue rate: {catalog.data ? money(catalog.data.plans.find(p => p.id === selected.request.plan).unit_price_cents) : 'Loading…'} / vehicle / month. Existing stored monthly amount is unchanged.</p>
          <div className="subscription-form-grid"><label>Agreed vehicle quantity<input data-testid="platform-quote-quantity" type="number" min="1" max="100000" value={quantity} onChange={e => setQuantity(e.target.value)} required /></label><label>Earliest application date<input data-testid="platform-quote-date" type="date" min={new Date().toISOString().slice(0,10)} value={date} onChange={e => setDate(e.target.value)} required /></label></div>
          <label>VAT treatment<select data-testid="platform-quote-tax" value={tax} onChange={e => setTax(e.target.value)} required><option value="">Choose agreed VAT treatment</option><option value="inclusive">VAT included in quoted amount</option><option value="exclusive">VAT excluded from quoted amount</option></select></label>
          <label>Hardware &amp; installation arrangements{selected.request.plan === 'essential' ? ' (required)' : ''}<textarea data-testid="platform-quote-hardware" maxLength={1200} rows={2} value={hardware} onChange={e => setHardware(e.target.value)} required={selected.request.plan === 'essential'} /></label>
          <label>Quote / review notes<textarea data-testid="platform-quote-notes" maxLength={1200} rows={3} value={notes} onChange={e => setNotes(e.target.value)} required /></label>
          <div className="subscription-actions"><Button data-testid="platform-quote-submit" disabled={busy} type="submit">Send quote for tenant acceptance</Button><Button data-testid="platform-quote-reject" variant="outline" disabled={busy || !notes.trim()} type="button" onClick={() => send('review', { decision: 'reject', notes })}>Reject request</Button></div>
        </form>}
        {selected.request.status === 'quoted' && <p data-testid="platform-awaiting-acceptance">Waiting for the tenant administrator to accept these exact terms.</p>}
        {selected.request.status === 'accepted' && <><label className="subscription-consent"><input data-testid="platform-apply-confirm" type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>I confirm the tenant accepted these terms. Apply plan access only; do not change invoices, stored prices or GPS configuration.</span></label><Button data-testid="platform-apply-submit" disabled={busy || !confirmed || selected.request.quote.effective_date > new Date().toISOString().slice(0,10)} onClick={() => send('apply', { confirmed })}>Apply accepted agreement</Button>{selected.request.quote.effective_date > new Date().toISOString().slice(0,10) && <p data-testid="platform-apply-future">Available for manual application from {selected.request.quote.effective_date}.</p>}</>}
        {selected.request.status === 'rejected' && <p data-testid="platform-rejection-notes">{selected.request.review_notes}</p>}
        {error && <p role="alert" className="subscription-error" data-testid="platform-subscription-action-error">{error}</p>}
      </div>}
    </DialogContent></Dialog>
  </div>;
};