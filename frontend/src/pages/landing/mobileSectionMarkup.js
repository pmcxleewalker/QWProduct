const sections = {
  'landing-features': ['features', 'Fleet features', 'Bookings, compliance &amp; live visibility'],
  'landing-field-features': ['field', 'Out in the field', 'The mobile app for your team'],
  'landing-award': ['award', 'Award-winning software', 'HCCI Innovation of the Year 2026'],
  'landing-stories': ['stories', 'Our customer &amp; founder', 'The people behind Quick Wing'],
  'landing-pricing': ['pricing', 'Plans &amp; pricing', '€6.50–€8.50 per vehicle / month'],
  'landing-roi': ['roi', 'ROI calculator', 'See what your fleet could save'],
  'landing-contact': ['contact', 'Let’s talk about your fleet', 'Get in touch with Lee'],
};

// These are the flat, trusted sections in our static landing markup, never user HTML.
// Their complete original contents stay in the DOM for desktop and expanded mobile.
export function withMobileSections(html) {
  return html.replace(/<section\b([^>]*)>([\s\S]*?)<\/section>/g, (original, attributes, body) => {
    const testId = attributes.match(/\bdata-testid="([^"]+)"/)?.[1];
    if (!sections[testId]) return original;
    const [key, title, hint] = sections[testId];
    const sectionAttributes = attributes.replace('class="', 'class="mobile-collapsible ');
    return `<section${sectionAttributes}>
      <details class="mobile-section" id="mobile-section-${key}" data-mobile-section="${key}" data-testid="landing-disclosure-${key}" open>
        <summary class="wrap mobile-section-summary" data-testid="landing-summary-${key}" aria-controls="mobile-body-${key}">
          <span class="mobile-section-label"><span class="mobile-section-title" data-testid="landing-summary-title-${key}">${title}</span><span class="mobile-section-hint" data-testid="landing-summary-hint-${key}">${hint}</span></span>
          <span class="mobile-section-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 12h14"/><path class="disclosure-plus" d="M12 5v14"/></svg></span>
        </summary>
        <div class="mobile-section-body" id="mobile-body-${key}" data-testid="landing-disclosure-body-${key}">${body}</div>
      </details>
    </section>`;
  });
}