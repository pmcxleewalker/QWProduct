import { useRef, useState } from 'react';
import axios from 'axios';
import { ArrowRight, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { QuoteSummary } from '../components/subscriptions/QuoteSummary';
import { useSubscriptionData, subscriptionApi, errorMessage, money, newKey } from '../components/subscriptions/useSubscriptionData';
import '../components/subscriptions/Subscriptions.css';
import { useAuth } from '../contexts/AuthContext';

export default function Subscription() {
  const { activeTenant } = useAuth();
  const account = useSubscriptionData('/tenant/subscription', activeTenant?.tenant_id);
  const catalog = useSubscriptionData('/public/subscription-catalog');
  const [plan, setPlan] = useState('essential');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [consent, setConsent] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const keys = useRef({});
  const send = async (path, payload, action) => {
    setBusy(true); setError('');
    const identity = `${action}-${account.data.revision}`;
    keys.current[identity] ||= newKey();
    try {
      const { data } = await axios.post(`${subscriptionApi}${path}`, { ...payload, revision: account.data.revision, idempotency_key: keys.current[identity] });
      account.setData(data); setConsent(false); setAccepted(false);
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };
  if (account.loading || catalog.loading) return <main className="subscription-page" data-testid="subscription-loading" role="status">Loading your agreement…</main>;
  if (!account.data || !catalog.data) return <main className="subscription-page"><p role="alert" data-testid="subscription-load-error">{account.error || catalog.error}</p><Button data-testid="subscription-retry" onClick={() => { account.reload(); catalog.reload(); }}>Retry</Button></main>;
  const data = account.data;
  const open = data.requests.find(r => ['requested', 'quoted', 'accepted'].includes(r.status));
  return <main className="subscription-page" data-testid="subscription-page">
    <header className="subscription-page-header"><div><p className="subscription-eyebrow">Your agreement</p><h1 data-testid="subscription-title">Plans &amp; subscription</h1><p>{data.tenant_name}</p></div><Button variant="outline" size="icon" aria-label="Refresh agreement" data-testid="subscription-refresh" onClick={account.reload}><RefreshCw size={18} /></Button></header>
    <div className="subscription-safety" data-testid="subscription-safety"><ShieldCheck size={22} /><p>No automatic payments, invoice changes or GPS activation. A plan change needs your acceptance and final platform approval.</p></div>
    <section className="subscription-current" data-testid="subscription-current">
      <h2>{data.active_agreement ? data.active_agreement.name : data.legacy ? 'Existing agreement — protected' : 'New per-vehicle offer — awaiting agreement'}</h2>
      {data.active_agreement ? <p data-testid="subscription-current-rate">{money(data.active_agreement.unit_price_cents)} / vehicle / month · effective {data.active_agreement.effective_at.slice(0,10)}</p> : <p>Your current records, vehicle capacity and existing access are unchanged.</p>}
      <p data-testid="subscription-existing-price">Stored monthly agreement: {!data.legacy_agreement.monthly_price ? 'On file with your account team' : new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(data.legacy_agreement.monthly_price)}. This stored billing amount is not changed by this workflow.</p>
    </section>
    <div className="subscription-offers">{catalog.data.plans.map(p => <article className={p.recommended ? 'recommended' : ''} key={p.id} data-testid={`account-plan-${p.id}`}><span>{p.recommended ? 'Recommended · Best Value' : p.status === 'coming_soon' ? 'Coming soon' : 'Core fleet operations'}</span><h2>{p.name}</h2><strong>{money(p.unit_price_cents)} <small>/ vehicle / month</small></strong><ul>{p.highlights.map((x,i) => <li key={x} data-testid={`account-plan-${p.id}-feature-${i}`}>{x}</li>)}</ul>{p.status === 'coming_soon' ? <a data-testid="subscription-professional-interest" href="/?interest=professional#contact">Register interest <ArrowRight size={15} /></a> : <Button data-testid={`subscription-choose-${p.id}`} variant={plan === p.id ? 'default' : 'outline'} onClick={() => setPlan(p.id)} disabled={!!open}>{plan === p.id ? 'Selected' : `Select ${p.name.replace('QuickWing ', '')}`}</Button>}</article>)}</div>
    {error && <p role="alert" className="subscription-error" data-testid="subscription-action-error">{error}</p>}
    {open ? <section className="subscription-request" data-testid="subscription-open-request"><div className="subscription-request-heading"><h2>Plan request</h2><span className="subscription-status-pill" data-testid="subscription-request-status">{open.status}</span></div><p>{catalog.data.plans.find(p => p.id === open.plan)?.name} · requested {open.requested_at.slice(0,10)}</p>
      {open.quote && <QuoteSummary quote={open.quote} prefix="tenant" />}
      {open.status === 'requested' && <p>The platform owner will confirm vehicle quantity, VAT treatment, hardware arrangements and the effective date.</p>}
      {open.status === 'quoted' && <><label className="subscription-consent"><input data-testid="subscription-accept-checkbox" type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} /><span>I accept this exact quote and plan-access change. Existing billing is handled separately; no payment or GPS activation is automatic.</span></label><Button data-testid="subscription-accept" disabled={busy || !accepted} onClick={() => send(`/tenant/subscription/requests/${open.id}/accept`, { accepted }, 'accept')}>Accept quoted plan</Button></>}
      {open.status === 'accepted' && <p data-testid="subscription-awaiting-apply">Your acceptance is recorded. The platform owner must apply it on or after the agreed date.</p>}
      <Button variant="outline" data-testid="subscription-cancel" disabled={busy} onClick={() => send(`/tenant/subscription/requests/${open.id}/cancel`, {}, 'cancel')}>Cancel request</Button>
    </section> : <form className="subscription-request" data-testid="subscription-request-form" onSubmit={e => { e.preventDefault(); send('/tenant/subscription/requests', { plan, effective_date: date, reason, acknowledged: consent }, 'create'); }}>
      <h2>Request a plan change</h2><div className="subscription-form-grid"><label>Plan<select data-testid="subscription-plan-select" value={plan} onChange={e => setPlan(e.target.value)}><option value="standard">QuickWing Standard</option><option value="essential">QuickWing Essential</option></select></label><label>Preferred effective date<input data-testid="subscription-effective-date" type="date" min={new Date().toISOString().slice(0,10)} value={date} onChange={e => setDate(e.target.value)} required /></label></div>
      <label>Notes (optional)<textarea data-testid="subscription-reason" maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} rows={3} /></label>
      <label className="subscription-consent"><input data-testid="subscription-request-consent" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>I understand this is a request, not an immediate upgrade, charge or GPS change. I will review the quoted terms before accepting.</span></label>
      <Button data-testid="subscription-request-submit" type="submit" disabled={busy || !consent}>{busy ? 'Submitting…' : 'Request review'}</Button>
    </form>}
    <section className="subscription-history"><h2>Request history</h2>{data.requests.length === 0 ? <p data-testid="subscription-history-empty">No plan changes requested.</p> : [...data.requests].reverse().map(r => <div className="subscription-history-row" key={r.id} data-testid={`subscription-history-${r.id}`}><span>{r.plan} · {r.requested_at.slice(0,10)}</span><span>{r.status}</span></div>)}</section>
  </main>;
}