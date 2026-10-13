import { money } from './useSubscriptionData';

export const QuoteSummary = ({ quote, prefix }) => <div className="subscription-quote" data-testid={`${prefix}-quote`}>
  <h3>{quote.name}</h3>
  <dl><div><dt>Unit price</dt><dd data-testid={`${prefix}-quote-unit-price`}>{money(quote.unit_price_cents)} / vehicle / month</dd></div>
    <div><dt>Agreed vehicle quantity</dt><dd data-testid={`${prefix}-quote-quantity`}>{quote.vehicle_quantity}</dd></div>
    <div><dt>Reference monthly amount</dt><dd data-testid={`${prefix}-quote-monthly`}>{money(quote.reference_monthly_cents)} · VAT {quote.tax_treatment === 'inclusive' ? 'included' : 'excluded'}</dd></div>
    <div><dt>Earliest application date</dt><dd data-testid={`${prefix}-quote-date`}>{quote.effective_date}</dd></div></dl>
  {quote.hardware_terms && <p><strong>Hardware / installation:</strong> {quote.hardware_terms}</p>}
  <p>{quote.notes}</p><p className="subscription-notice">{quote.billing_notice}</p>
  {quote.retained_capabilities?.length > 0 && <p>Existing agreement features remain protected, including previously available operational reports.</p>}
</div>;