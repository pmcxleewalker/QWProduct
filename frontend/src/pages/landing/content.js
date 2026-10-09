const arrow = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const check = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
const award = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.4 7 22l5-3 5 3-1.2-8.6"/></svg>';

const features = [
  ['app-dashboard', 'One organised admin view', 'Live fleet status', 'Bookings and live status—without the chasing.', 'Live Fleet Status dashboard'],
  ['app-booking', 'Booking management', 'Bookings & calendars', 'Create, assign and repeat bookings, with AI Booking Intelligence.', 'Car Bookings — Create New Booking form'],
  ['app-vehicles', 'Compliance and reporting', 'Compliance & fleet records', 'Reminders, fleet records and clear reports.', 'Fleet Vehicles with compliance reminders'],
  ['app-reports', 'Reports', 'Reports & CSV export', 'All bookings, most-booked cars and daily availability, with CSV export.', 'Reports — bookings list, most booked cars, daily availability'],
  ['app-gps', 'Live GPS visibility', 'Live GPS tracking', 'Follow active journeys in one calm view.', 'Live Fleet Map with GPS tracking'],
];
const phones = [
  ['app-mobile-home', 'For teams in the field', 'Live availability—clear at a glance.', 'Mobile home screen with live fleet status'],
  ['app-mobile-bookings', 'Book in seconds', 'Personal bookings and calendars stay together.', 'My Bookings calendar on mobile'],
  ['app-mobile-docs', 'Report from the field', 'Checks and incidents—captured while details are fresh.', 'Documents screen with incident reporting'],
  ['app-mobile-lift', 'Built-in lift requests', 'A simple taxi system for Quick Wing users.', 'Request a Lift form on mobile'],
];
const softwareFeatures = ['Vehicle bookings &amp; shared calendar', 'Live fleet status dashboard', 'Compliance reminders &amp; fleet records', 'Inspections &amp; incident reporting', 'Built-in lift requests', 'Reports &amp; CSV export', 'AI Booking Intelligence'];
const gpsFeatures = ['Everything in Fleet Software', 'Live GPS tracking', 'Live fleet map — follow active journeys in one calm view'];

const DEMO_SECTION = `<section id="demo" class="section video-section" data-testid="landing-demo-section"><div class="wrap video-in">
  <div class="video-copy"><h2 class="eyebrow" data-testid="landing-demo-heading">See it in action</h2><p class="section-title" data-testid="landing-demo-title">Smarter fleet management,<br><em>made simple.</em></p><p class="lead" data-testid="landing-demo-description">Less administration. Better oversight. Easier to manage.</p><div class="btns"><a data-testid="landing-demo-get-started" class="btn btn-primary" href="#contact">Get Started ${arrow}</a><a data-testid="landing-demo-pricing" class="btn btn-text" href="#pricing">See pricing ${arrow}</a></div><div class="video-photo"><img src="/images/photo-mobile.jpg" alt="Coordinator checking Quick Wing on her phone" loading="lazy" width="900" height="900"></div></div>
  <div class="video-frame"><video data-testid="landing-demo-video" controls playsinline preload="metadata" poster="/images/demo-poster.jpg" aria-label="Quick Wing product demonstration"><source src="/video/quick-wing-demo.webm" type="video/webm"><source src="/video/quick-wing-demo.mp4" type="video/mp4"></video></div>
</div></section>`;

export const LANDING_HTML = `
<header class="nav" data-testid="landing-header">
  <div class="wrap nav-in">
    <a data-testid="landing-nav-logo" class="nav-logo" href="/" aria-label="Quick Wing home"><img src="/images/quick-wing-logo-wide.png" alt="Quick Wing — Car Fleet Management" width="893" height="313"></a>
    <nav class="nav-links" aria-label="Main">
      <a data-testid="landing-nav-features" href="#features">Features</a>
      <a data-testid="landing-nav-demo" href="#demo">Demo</a>
      <a data-testid="landing-nav-pricing" href="#pricing">Pricing</a>
      <a data-testid="landing-nav-roi" href="#roi">ROI Calculator</a>
      <a data-testid="landing-nav-award" href="#award">Award</a>
      <a data-testid="landing-nav-contact" href="/contact">Contact</a>
    </nav>
    <div class="nav-right">
      <a data-testid="landing-nav-login" class="nav-login" href="/login">Login</a>
      <a data-testid="landing-nav-get-started" class="btn btn-primary nav-cta" href="#contact">Get Started ${arrow}</a>
      <button data-testid="landing-menu-btn" class="menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
    </div>
  </div>
  <nav data-testid="landing-mobile-menu" class="mobile-menu" id="mobile-menu" aria-label="Mobile">
    <a data-testid="landing-mobile-features" href="#features">Features</a><a data-testid="landing-mobile-demo" href="#demo">Demo</a><a data-testid="landing-mobile-pricing" href="#pricing">Pricing</a><a data-testid="landing-mobile-roi" href="#roi">ROI Calculator</a><a data-testid="landing-mobile-award" href="#award">Award</a><a data-testid="landing-mobile-contact" href="/contact">Contact</a><a data-testid="landing-mobile-login" href="/login">Login</a>
  </nav>
</header>
<main>
  <section class="hero" data-testid="landing-hero" aria-labelledby="hero-title">
    <div class="hero-backdrop" aria-hidden="true"><img data-testid="landing-hero-photo" src="/images/photo-field.jpg" alt="" width="900" height="1200" fetchpriority="high" loading="eager"></div>
    <div class="wrap hero-in">
      <div class="hero-copy">
        <p class="eyebrow" data-testid="landing-hero-brand"><span class="accent-line"></span>Quick Wing / Fleet management</p>
        <h1 id="hero-title" data-testid="landing-hero-title">Stay compliant.<br>Reduce downtime.<br><span>Control your fleet.</span></h1>
        <p class="hero-sub" data-testid="landing-hero-description">The simple, all-in-one system for vehicle bookings, compliance tracking, and live visibility. Built for teams that can't afford downtime.</p>
        <div class="btns"><a data-testid="landing-hero-get-started" class="btn btn-primary" href="#contact">Get Started ${arrow}</a><a data-testid="landing-hero-demo" class="btn btn-text" href="#demo"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z"/></svg>Watch demo</a></div>
        <a class="award-link" data-testid="landing-hero-award" href="#award">${award}<span>Winner · Technological Innovation of the Year 2026 · HCCI</span></a>
      </div>
      <span class="hero-caption" data-testid="landing-hero-caption">Built for teams that keep moving.</span>
    </div>
  </section>
  <section class="stats-band" aria-label="Quick Wing at a glance" data-testid="landing-stats">
    <div class="wrap stats">
      <p class="stats-label" data-testid="landing-trust-label">Trusted by<br><strong>Irish Care Providers</strong></p>
      <div class="stat" data-testid="landing-stat-automation"><b>73%</b><span>of fleet admin processes<br>automated (Sept 2026)</span></div>
      <div class="stat" data-testid="landing-stat-price"><b>€6.50</b><span>per vehicle,<br>per month</span></div>
      <div class="stat" data-testid="landing-stat-setup"><b>1 afternoon</b><span>to set up</span></div>
    </div>
  </section>
  ${DEMO_SECTION}
  <section class="trust" data-testid="landing-trust" aria-label="Clients and recognition">
    <div class="wrap trust-in">
      <div class="trust-item" data-testid="landing-trust-client"><span class="tag">Client</span><img src="/images/bluebird-care-logo.jpg" alt="Bluebird Care" class="client-logo" width="421" height="191"></div>
      <div class="trust-item trust-award" data-testid="landing-trust-award"><img class="trust-award-logo" data-testid="landing-trust-hcci-logo" src="/images/hcci-logo.png" alt="HCCI — Home &amp; Community Care Ireland" width="738" height="198"><span><b>HCCI Home Care Awards 2026</b><small>Technological Innovation of the Year — Winner</small></span><span class="tag">Award</span></div>
      <a class="trust-item" data-testid="landing-trust-podcast" href="https://youtu.be/_oR2ROeUOp4"><img src="/images/ai-six-podcast.jpg" alt="AI Six Podcast" class="podcast-logo" width="500" height="449"><span><small class="tag">As featured on</small><b>AI Six Podcast ${arrow}</b></span></a>
    </div>
  </section>

  <section id="features" class="section features-section" data-testid="landing-features">
    <div class="wrap">
      <div class="section-head"><div><h2 class="eyebrow" data-testid="landing-features-heading">01 / Features</h2><p class="section-title" data-testid="landing-features-title">Built for both sides<br>of the working day.</p></div><p class="lead" data-testid="landing-features-description">Less chasing. More clarity.<br>Easier coordination.</p></div>
      <div class="tabs-wrap">
        <div class="feature-list"><h3 class="section-subtitle" data-testid="landing-office-heading">In the office</h3><div class="tabs" role="tablist" aria-label="Admin features" aria-orientation="vertical">
          ${features.map(([id, title, subtitle, description, alt], index) => `<button id="feature-tab-${index}" data-testid="landing-tab-${id}" class="tab" role="tab" aria-selected="${index === 0}" aria-controls="feature-preview" tabindex="${index === 0 ? '0' : '-1'}" data-img="/images/${id}.jpg" data-title="${subtitle}" data-description="${description}" data-alt="${alt}"><span class="tab-number">0${index + 1}</span><span class="tab-copy"><span class="tab-top"><b>${title}</b>${arrow}</span><span class="tab-subtitle">${subtitle}</span><span class="tab-description">${description}</span></span></button>`).join('')}
        </div></div>
        <div class="tab-stage" id="feature-preview" role="tabpanel" aria-labelledby="feature-tab-0" tabindex="0" data-testid="landing-feature-preview"><div class="preview-bar"><span data-testid="landing-preview-brand">Quick Wing</span><span id="feature-preview-title" data-testid="landing-preview-title">Live fleet status</span></div><p class="preview-description" id="feature-preview-description" data-testid="landing-preview-description" aria-live="polite">Bookings and live status—without the chasing.</p><div class="preview-image"><img data-testid="landing-tab-image" id="tab-img" src="/images/app-dashboard.jpg" alt="Live Fleet Status dashboard" loading="lazy" width="852" height="1348"></div></div>
      </div>
    </div>
  </section>

  <section class="section field-section" data-testid="landing-field-features">
    <div class="wrap"><div class="section-head"><div><h2 class="eyebrow" data-testid="landing-field-heading">Out in the field</h2><p class="section-title" data-testid="landing-field-title">One clear view. Live.</p></div><p class="lead" data-testid="landing-field-description">People and vehicles<br>moving together.</p></div>
      <div class="phones" id="field-gallery" data-testid="landing-field-gallery" role="region" aria-label="Mobile app features">${phones.map(([id, title, description, alt], index) => `<article data-testid="landing-field-feature-${index}" tabindex="0" aria-label="${title}"><div class="phone"><img src="/images/${id}.jpg" alt="${alt}" loading="lazy" width="722" height="1584"></div><h3>${title}</h3><p>${description}</p></article>`).join('')}</div>
      <div class="gallery-nav" data-testid="landing-field-gallery-controls"><span class="gallery-count" data-testid="landing-field-gallery-count" aria-live="polite">1 / 4</span><div><button class="gallery-button" data-testid="landing-field-previous" data-gallery-step="-1" aria-label="Previous mobile feature" aria-controls="field-gallery" disabled>${arrow}</button><button class="gallery-button" data-testid="landing-field-next" data-gallery-step="1" aria-label="Next mobile feature" aria-controls="field-gallery">${arrow}</button></div></div>
    </div>
  </section>

  <section id="award" class="section award-section" data-testid="landing-award"><div class="wrap award-layout">
    <div class="award-copy"><img class="award-body-logo" data-testid="landing-award-hcci-logo" src="/images/hcci-logo.png" alt="HCCI — Home &amp; Community Care Ireland" width="738" height="198" loading="lazy"><h2 class="eyebrow" data-testid="landing-award-heading">02 / Award-winning software</h2><p class="section-title" data-testid="landing-award-title">Technological Innovation<br>of the Year 2026.</p><p class="lead" data-testid="landing-award-description">Quick Wing was recognised at the Home &amp; Community Care Ireland (HCCI) Home Care Awards 2026, winning Technological Innovation of the Year. The award was presented to founder Lee Walker, Bluebird Care – Kerry and West Cork.</p><div class="facts" data-testid="landing-award-facts"><div><span>Awarding body</span><strong>Home &amp; Community Care Ireland</strong></div><div><span>Category</span><strong>Technological Innovation of the Year</strong></div><div><span>In use at</span><strong>Bluebird Care</strong></div></div></div>
    <div class="award-grid"><img class="big" src="/images/hcci-award-lee-walker.jpg" alt="Lee Walker holding the HCCI Technological Innovation of the Year 2026 award" loading="lazy" width="1100" height="1466"><div class="stack"><img src="/images/hcci-award-certificate.jpg" alt="HCCI Home Care Awards 2026 winner certificate — Technological Innovation of the Year" loading="lazy" width="900" height="1600"><img src="/images/hcci-award-trophy.jpg" alt="HCCI Technological Innovation of the Year 2026 glass trophy" loading="lazy" width="900" height="1200"></div></div>
  </div></section>

  <section class="section proof-section" data-testid="landing-stories"><div class="wrap proof">
    <figure class="testimonial" data-testid="landing-testimonial"><h2 class="eyebrow">Success Story</h2><blockquote>“Quick Wing has completely changed how we run our fleet. Compliance is under control, downtime is down, and my team finally have visibility of every vehicle without chasing spreadsheets. It's the kind of tool you didn't know you needed until you can't imagine working without it.”</blockquote><figcaption><img src="/images/bluebird-care-logo.jpg" alt="Bluebird Care" loading="lazy" width="421" height="191"><span class="who"><b>Director</b><small>Bluebird Care · Kerry &amp; West Cork</small></span></figcaption></figure>
    <div class="founder" data-testid="landing-founder"><h2 class="eyebrow">From the founder</h2><h3>“Built from real experience.”</h3><p>“I'm proud to announce the launch of Quick Wing. I built this to help businesses manage vehicle bookings, track compliance, and gain clear visibility in one place.”</p><p>“Designed for real working teams who don't have time for complicated software.”</p><div class="founder-person"><img class="avatar" src="/images/hcci-award-lee-walker.jpg" alt="Lee Walker" loading="lazy" width="1100" height="1466"><span class="who"><b>Lee Walker</b><small>Founder &amp; CEO, Quick Wing</small></span></div><a class="pod" data-testid="landing-founder-podcast" href="https://youtu.be/_oR2ROeUOp4"><img src="/images/ai-six-podcast.jpg" alt="AI Six Podcast" loading="lazy" width="500" height="449"><span>Watch our founder discuss fleet intelligence on AI Six Podcast</span>${arrow}</a></div>
  </div></section>

  <section id="pricing" class="section pricing-section" data-testid="landing-pricing"><div class="wrap">
    <div class="section-head"><div><h2 class="eyebrow" data-testid="landing-pricing-heading">03 / Pricing</h2><p class="section-title" data-testid="landing-pricing-title">Simple, per-vehicle pricing.</p></div><a class="text-link" href="#roi" data-testid="landing-pricing-roi">Calculate your return ${arrow}</a></div>
    <div class="prices">
      <article class="price price-light" data-testid="landing-software-plan"><div class="price-top"><span class="tag">Fleet management</span><span class="plan-index" aria-hidden="true">01</span></div><h3>Fleet Software</h3><p class="plan-description" data-testid="landing-software-subheading">Bookings, compliance &amp; reporting</p><div class="amount" data-testid="landing-software-price"><b>€6.50</b><span>per vehicle / month</span></div><h4 class="plan-includes" data-testid="landing-software-includes">Your day-to-day fleet, covered.</h4><ul>${softwareFeatures.map((text, index) => `<li data-testid="landing-software-feature-${index}">${check}<span>${text}</span></li>`).join('')}</ul><a class="btn btn-outline" data-testid="landing-software-get-started" href="#contact">Get Started ${arrow}</a></article>
      <article class="price price-gps" data-testid="landing-gps-plan"><div class="price-top"><span class="tag">Fleet management + tracking</span><span class="badge" data-testid="landing-gps-badge">Full visibility</span></div><h3>Fleet Software + Live GPS</h3><p class="plan-description" data-testid="landing-gps-subheading">All your software. A live view of every journey.</p><div class="amount" data-testid="landing-gps-price"><b>€8.50</b><span>per vehicle / month</span></div><h4 class="plan-includes" data-testid="landing-gps-includes">Everything above. Plus live GPS.</h4><ul>${gpsFeatures.map((text, index) => `<li data-testid="landing-gps-feature-${index}">${check}<span>${text}</span></li>`).join('')}</ul><div class="map"><img src="/images/app-gps.jpg" alt="Quick Wing Live Fleet Map" loading="lazy" width="764" height="1306"></div><a class="btn btn-primary" data-testid="landing-gps-get-started" href="#contact">Get Started ${arrow}</a></article>
    </div>
  </div></section>

  <section id="roi" class="section roi-section" data-testid="landing-roi"><div class="wrap">
    <div class="section-head"><div><h2 class="eyebrow" data-testid="landing-roi-heading">04 / ROI Calculator</h2><p class="section-title" data-testid="landing-roi-title">See what Quick Wing gives back.</p></div></div><p class="lead roi-intro" data-testid="landing-roi-description">Quick Wing is automating up to 73% of fleet admin processes (September 2026). Enter your numbers.</p>
    <div class="roi"><div class="roi-in">
      <h3 class="section-subtitle" data-testid="landing-roi-inputs-heading">Your fleet. Your numbers.</h3>
      <div class="range-field"><div class="roi-row"><label for="roi-v">Vehicles in your fleet</label><output id="o-v" for="roi-v" data-testid="roi-vehicles-value">20</output></div><input data-testid="roi-vehicles-input" id="roi-v" type="range" min="1" max="150" step="1" value="20"></div>
      <div class="range-field"><div class="roi-row"><label for="roi-h">Hours per week on vehicle admin</label><output id="o-h" for="roi-h" data-testid="roi-hours-value">10 h</output></div><input data-testid="roi-hours-input" id="roi-h" type="range" min="1" max="60" step="1" value="10"></div>
      <div class="range-field"><div class="roi-row"><label for="roi-r">Hourly staff cost</label><output id="o-r" for="roi-r" data-testid="roi-rate-value">€16</output></div><input data-testid="roi-rate-input" id="roi-r" type="range" min="12" max="45" step="1" value="16"></div>
      <fieldset><legend>Plan</legend><div class="plan-btns"><button data-testid="roi-plan-6-5" type="button" class="btn" data-price="6.5" aria-pressed="true">€6.50 · Software</button><button data-testid="roi-plan-8-5" type="button" class="btn" data-price="8.5" aria-pressed="false">€8.50 · Software + GPS</button></div></fieldset>
    </div><div class="roi-out" aria-live="polite" data-testid="roi-results">
      <div><small>Admin hours saved every month</small><div class="roi-big"><span id="r-hours" data-testid="roi-saved-hours">32</span><span class="roi-unit"> h</span></div></div><div class="roi-two"><div><small>Staff time value saved</small><b id="r-value" data-testid="roi-saved-value">€506</b></div><div><small>Quick Wing cost</small><b id="r-cost" data-testid="roi-plan-cost">€130</b></div></div><div class="roi-net"><small>Net monthly return</small><b id="r-net" data-testid="roi-net-return">€376</b></div><p class="roi-note" data-testid="roi-estimate-note">Estimate per month: hours × 52 ÷ 12 × 73% × hourly cost, minus vehicles × plan price. Your results will vary.</p><a class="text-link" data-testid="landing-roi-get-started" href="#contact">Get Started ${arrow}</a>
    </div></div>
  </div></section>

  <section id="contact" class="section contact-section" data-testid="landing-contact"><div class="wrap contact-layout">
    <div class="contact-copy"><h2 class="eyebrow" data-testid="landing-contact-heading">05 / Contact us</h2><p class="section-title" data-testid="landing-contact-title">Let's talk<br>about your fleet.</p><p class="lead" data-testid="landing-contact-description">Whether you're looking for a demo, a quote, or just have a quick question — drop your details in the form and Lee will personally get back to you.</p><div class="contact-info"><a data-testid="landing-contact-email-link" href="mailto:Lee@quick-wing.com">Lee@quick-wing.com ${arrow}</a><p data-testid="landing-contact-availability">Online — available everywhere</p></div><div class="ready" data-testid="landing-contact-ready"><b>Ready to control your fleet?</b><p>Set up in a single afternoon. Talk to us to get started.</p></div></div>
    <form data-testid="landing-contact-form" class="form" id="contact-form" novalidate>
      <div class="form-row"><div class="field"><label for="c-name">Full name*</label><input data-testid="contact-full-name" id="c-name" name="full_name" type="text" autocomplete="name" required></div><div class="field"><label for="c-co">Company name*</label><input data-testid="contact-company" id="c-co" name="company" type="text" autocomplete="organization" required></div></div>
      <div class="form-row"><div class="field"><label for="c-email">Email*</label><input data-testid="contact-email" id="c-email" name="email" type="email" autocomplete="email" required></div><div class="field"><label for="c-phone">Phone number*</label><input data-testid="contact-phone" id="c-phone" name="phone" type="tel" autocomplete="tel" required></div></div>
      <div class="field"><label for="c-msg">Message (optional)</label><textarea data-testid="contact-message" id="c-msg" name="message" rows="4"></textarea></div><button data-testid="contact-submit" class="btn btn-primary" type="submit">Send Message ${arrow}</button><p class="form-note" data-testid="contact-form-note" aria-live="polite">We'll only use your details to reply to this enquiry.</p>
    </form>
  </div></section>
</main>
<footer class="footer" data-testid="landing-footer"><div class="wrap footer-in"><a href="/" data-testid="landing-footer-logo" aria-label="Quick Wing home"><img src="/images/quick-wing-logo-wide.png" alt="Quick Wing" width="893" height="313"></a><nav aria-label="Footer"><a data-testid="landing-footer-contact" href="/contact">Contact</a><a data-testid="landing-footer-login" href="/login">Login</a><a data-testid="landing-footer-privacy" href="/privacy-policy">Privacy Policy</a><a data-testid="landing-footer-podcast" href="https://youtu.be/_oR2ROeUOp4">AI Six Podcast</a></nav><small data-testid="landing-copyright">Quick Wing · Est. 2025 · A product of QuickFleet Limited<br>© 2026 QuickFleet Limited. All rights reserved.</small></div></footer>`;