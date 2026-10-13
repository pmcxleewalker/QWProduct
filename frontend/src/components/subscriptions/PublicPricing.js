import { Check, Minus, ArrowRight, Sparkles } from 'lucide-react';
import { money } from './useSubscriptionData';

export const PublicPricing = ({ catalog, loading, error, retry, onChoose }) => {
  if (loading) return <p data-testid="pricing-loading" role="status">Loading plans…</p>;
  if (error || !catalog) return <div role="alert" data-testid="pricing-error"><p>Pricing is temporarily unavailable.</p><button className="btn btn-outline" data-testid="pricing-retry" onClick={retry}>Try again</button></div>;
  return <>
    <div className="subscription-prices" data-testid="subscription-prices">
      {catalog.plans.map(plan => <article key={plan.id} className={`subscription-price subscription-price-${plan.id}`} data-testid={`pricing-plan-${plan.id}`}>
        <div className="subscription-plan-top">
          {plan.recommended ? <span className="subscription-recommended" data-testid="pricing-essential-recommended"><Sparkles size={13} aria-hidden="true" />Recommended</span> : <span className="subscription-kicker">{plan.status === 'coming_soon' ? 'Coming soon' : 'The essentials of fleet management'}</span>}
          {plan.recommended && <span data-testid="pricing-essential-value" className="subscription-value">Best Value</span>}
        </div>
        <h3>{plan.name}</h3><p className="subscription-description">{plan.description}</p>
        <div className="subscription-amount" data-testid={`pricing-amount-${plan.id}`}><strong>{money(plan.unit_price_cents)}</strong><span>per vehicle / month</span></div>
        <p className="subscription-includes">{plan.id === 'standard' ? 'Your existing non-GPS operations, covered.' : plan.id === 'essential' ? 'Everything in Standard, plus:' : 'Everything in both tiers, plus planned extras:'}</p>
        <ul>{plan.highlights.map((item, index) => <li data-testid={`pricing-${plan.id}-feature-${index}`} key={item}><Check size={16} aria-hidden="true" /><span>{item}</span></li>)}</ul>
        <a data-testid={`pricing-select-${plan.id}`} href="#contact" className={`btn ${plan.id === 'essential' ? 'btn-primary' : 'btn-outline'}`} onClick={() => onChoose(plan.id)}>{plan.status === 'coming_soon' ? 'Register interest' : plan.id === 'essential' ? 'Choose Essential' : 'Choose Standard'}<ArrowRight size={17} aria-hidden="true" /></a>
        {plan.status === 'coming_soon' && <p className="subscription-status" data-testid="pricing-professional-status">Not available to activate or purchase yet.</p>}
      </article>)}
    </div>
    <div className="subscription-terms" data-testid="pricing-terms">
      <p data-testid="pricing-tax-terms">{catalog.terms.tax}</p><p data-testid="pricing-hardware-terms"><strong>GPS hardware &amp; installation.</strong> {catalog.terms.hardware}</p>
      <p data-testid="pricing-fuel-terms"><strong>Optional fuel-card benefit.</strong> {catalog.terms.fuel}</p>
      <p data-testid="pricing-existing-customers">{catalog.terms.legacy}</p>
    </div>
    <details className="plan-comparison" data-testid="pricing-comparison">
      <summary data-testid="pricing-comparison-toggle"><span>Compare every plan</span><span aria-hidden="true">+</span></summary>
      <div className="comparison-heading" aria-hidden="true"><span>Feature</span>{catalog.plans.map(p => <span key={p.id}>{p.id[0].toUpperCase() + p.id.slice(1)}</span>)}</div>
      {catalog.comparison.map(row => <div className="comparison-row" data-testid={`comparison-${row.id}`} key={row.id}><span>{row.label}</span>{catalog.plans.map(plan => <span key={plan.id} data-testid={`comparison-${row.id}-${plan.id}`} aria-label={`${plan.name}: ${row.included[plan.id] ? (plan.status === 'coming_soon' ? 'planned' : 'included') : 'not included'}`}>{row.included[plan.id] ? plan.status === 'coming_soon' ? <span className="comparison-planned">Planned</span> : <Check size={17} aria-hidden="true" /> : <Minus size={15} aria-hidden="true" />}</span>)}</div>)}
      <p className="subscription-terms">Professional is coming soon. Existing customer agreements may include additional retained features.</p>
    </details>
  </>;
};