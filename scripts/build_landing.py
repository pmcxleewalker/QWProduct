"""Generates src/pages/LandingPage.js from the supplied quick-wing-site/index.html.

Keeps the markup, copy and CSS byte-identical to the design file; only scopes the
CSS under #qw-landing so it cannot leak into the logged-in app, rewrites asset
paths to /images + /video, and adds data-testid hooks.
"""
import re
from pathlib import Path

SRC = Path('/tmp/qwsite/quick-wing-site/index.html')
OUT = Path('/app/frontend/src/pages/LandingPage.js')

html = SRC.read_text()

css = re.search(r'<style>(.*?)</style>', html, re.S).group(1)
body = re.search(r'<body>(.*?)\n<script>', html, re.S).group(1)

SCOPE = '#qw-landing'


def prefix_selector(sel: str) -> str:
    sel = sel.strip()
    if not sel:
        return sel
    if sel in (':root', 'body'):
        return SCOPE
    if sel == 'html':
        return 'html.qw-home'
    if sel == '*':
        return f'{SCOPE} *'
    if sel.startswith(':'):
        return f'{SCOPE} {sel}'
    return f'{SCOPE} {sel}'


def scope_block(block: str) -> str:
    """Scope every rule in a flat CSS block (no nested at-rules)."""
    out = []
    for rule in re.finditer(r'([^{}]+)\{([^{}]*)\}', block):
        sels, decls = rule.group(1), rule.group(2)
        comment_prefix = ''
        # keep standalone comments that sit before the selector
        comments = re.findall(r'/\*.*?\*/', sels, re.S)
        if comments:
            comment_prefix = ''.join(comments)
            sels = re.sub(r'/\*.*?\*/', '', sels, flags=re.S)
        scoped = ','.join(prefix_selector(s) for s in sels.split(',') if s.strip())
        out.append(f'{comment_prefix}{scoped}{{{decls}}}')
    return '\n'.join(out)


scoped_css_parts = []
pos = 0
for media in re.finditer(r'@media[^{]+\{', css):
    # flat part before this media query
    scoped_css_parts.append(scope_block(css[pos:media.start()]))
    # find matching closing brace for the media block
    depth = 1
    i = media.end()
    while depth:
        if css[i] == '{':
            depth += 1
        elif css[i] == '}':
            depth -= 1
        i += 1
    inner = css[media.end():i - 1]
    scoped_css_parts.append(f'{media.group(0).strip()}\n{scope_block(inner)}\n}}')
    pos = i
scoped_css_parts.append(scope_block(css[pos:]))
scoped_css = '\n'.join(p for p in scoped_css_parts if p.strip())

# Neutralise the logged-in app's global resets (src/index.css) inside the
# landing page so the design renders exactly as supplied.
scoped_css += '''
#qw-landing h1,#qw-landing h2,#qw-landing h3,#qw-landing h4{color:inherit;letter-spacing:normal;font-family:Manrope,system-ui,sans-serif}
#qw-landing .hero h1{letter-spacing:-.03em}
#qw-landing .h2{letter-spacing:-.025em}
#qw-landing :focus-visible{outline:3px solid var(--blue-light) !important;outline-offset:2px !important}
#qw-landing input:focus,#qw-landing textarea:focus{box-shadow:none;border-color:var(--blue)}
#qw-landing blockquote{margin:0}
#qw-landing button{font-family:Manrope,system-ui,sans-serif}'''

# assets live in the public folder
body = body.replace('src="images/', 'src="/images/')
body = body.replace('src="video/', 'src="/video/')
body = body.replace('poster="images/', 'poster="/images/')
body = body.replace('data-img="images/', 'data-img="/images/')

# testing hooks (no visual / copy change)
testids = [
    ('<a class="nav-logo" href="https://quick-wing.com/"',
     '<a data-testid="landing-nav-logo" class="nav-logo" href="https://quick-wing.com/"'),
    ('<a class="nav-login" href="https://quick-wing.com/login">Login</a>',
     '<a data-testid="landing-nav-login" class="nav-login" href="https://quick-wing.com/login">Login</a>'),
    ('<button class="menu-btn" aria-label="Open menu"',
     '<button data-testid="landing-menu-btn" class="menu-btn" aria-label="Open menu"'),
    ('<nav class="mobile-menu" id="mobile-menu"',
     '<nav data-testid="landing-mobile-menu" class="mobile-menu" id="mobile-menu"'),
    ('<form class="form" id="contact-form" action="mailto:Lee@quick-wing.com" method="post" enctype="text/plain">',
     '<form data-testid="landing-contact-form" class="form" id="contact-form" novalidate="">'),
    ('<input id="c-name"', '<input data-testid="contact-full-name" id="c-name"'),
    ('<input id="c-co"', '<input data-testid="contact-company" id="c-co"'),
    ('<input id="c-email"', '<input data-testid="contact-email" id="c-email"'),
    ('<input id="c-phone"', '<input data-testid="contact-phone" id="c-phone"'),
    ('<textarea id="c-msg"', '<textarea data-testid="contact-message" id="c-msg"'),
    ('<button class="btn btn-primary" type="submit">Send Message</button>',
     '<button data-testid="contact-submit" class="btn btn-primary" type="submit">Send Message</button>'),
    ('<div class="tab-stage" role="tabpanel"><div><img id="tab-img"',
     '<div class="tab-stage" role="tabpanel"><div><img data-testid="landing-tab-image" id="tab-img"'),
]
for old, new in testids:
    assert old in body, old[:60]
    body = body.replace(old, new)

body = re.sub(r'<button class="tab" role="tab" aria-selected="(true|false)" data-img="([^"]+)"',
              lambda m: f'<button data-testid="landing-tab-{Path(m.group(2)).stem}" class="tab" role="tab" aria-selected="{m.group(1)}" data-img="{m.group(2)}"',
              body)
body = re.sub(r'<button type="button" class="btn" data-price="([\d.]+)"',
              lambda m: f'<button data-testid="roi-plan-{m.group(1).replace(".", "-")}" type="button" class="btn" data-price="{m.group(1)}"',
              body)

component = '''import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

/**
 * LandingPage — public home page for quick-wing.com.
 *
 * Markup, copy and CSS are a 1:1 port of the supplied design file. The CSS is
 * scoped under #qw-landing so it cannot leak into the logged-in app, and the
 * contact form posts to the existing /api/public/contact backend (emails Lee).
 */
const LANDING_CSS = `__CSS__`;

const LANDING_HTML = `__HTML__`;

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const AUTOMATION = 0.73; // up to 73% of fleet admin automated (Sept 2026)

const SUCCESS_HTML = [
  '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin:0 auto"><circle cx="12" cy="12" r="10"/><path d="m8 12.5 2.6 2.6L16 9.5"/></svg>',
  '<b style="font-size:22px;font-weight:800">Message sent</b>',
  '<p style="margin:0;font-size:16px;line-height:1.6;color:#3B4866">Thanks — your enquiry is on its way to Lee. He\u2019ll personally get back to you.</p>',
].join('');

const eur = (n) => (n < 0 ? '\u2212\u20AC' : '\u20AC') + Math.abs(Math.round(n)).toLocaleString('en-IE');

const LandingPage = () => {
  const rootRef = useRef(null);
  const priceRef = useRef(6.5);

  // html-level rules (smooth anchor scrolling + scroll padding) while mounted
  useEffect(() => {
    document.documentElement.classList.add('qw-home');
    return () => document.documentElement.classList.remove('qw-home');
  }, []);

  const calc = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const v = root.querySelector('#roi-v');
    const h = root.querySelector('#roi-h');
    const r = root.querySelector('#roi-r');
    if (!v || !h || !r) return;
    const saved = (h.value * 52) / 12 * AUTOMATION;
    const value = saved * r.value;
    const cost = v.value * priceRef.current;
    root.querySelector('#o-v').textContent = v.value;
    root.querySelector('#o-h').textContent = `${h.value} h`;
    root.querySelector('#o-r').textContent = `\u20AC${r.value}`;
    root.querySelector('#r-hours').textContent = Math.round(saved);
    root.querySelector('#r-value').textContent = eur(value);
    root.querySelector('#r-cost').textContent = eur(cost);
    root.querySelector('#r-net').textContent = eur(value - cost);
  }, []);

  const onClick = (e) => {
    const root = rootRef.current;
    const target = e.target;
    if (!root || !target.closest) return;

    const menuBtn = target.closest('.menu-btn');
    const menu = root.querySelector('#mobile-menu');
    if (menuBtn && menu) {
      const open = menu.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }
    if (target.closest('#mobile-menu a') && menu) {
      menu.classList.remove('open');
      root.querySelector('.menu-btn')?.setAttribute('aria-expanded', 'false');
      return;
    }

    const tab = target.closest('.tab');
    if (tab) {
      const img = root.querySelector('#tab-img');
      root.querySelectorAll('.tab').forEach((x) => x.setAttribute('aria-selected', 'false'));
      tab.setAttribute('aria-selected', 'true');
      img.src = tab.dataset.img;
      img.alt = tab.dataset.alt;
      return;
    }

    const plan = target.closest('.plan-btns .btn');
    if (plan) {
      root.querySelectorAll('.plan-btns .btn').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      plan.setAttribute('aria-pressed', 'true');
      priceRef.current = parseFloat(plan.dataset.price);
      calc();
    }
  };

  const onInput = (e) => {
    if (e.target.matches('input[type=range]')) calc();
  };

  const onSubmit = async (e) => {
    if (e.target.id !== 'contact-form') return;
    e.preventDefault();
    const root = rootRef.current;
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const val = (id) => (root.querySelector(id)?.value || '').trim();
    const payload = {
      name: val('#c-name'),
      company: val('#c-co'),
      email: val('#c-email'),
      phone: val('#c-phone'),
      message: val('#c-msg') || null,
      type: 'general',
    };
    if (!payload.name || !payload.company || !payload.email || !payload.phone) {
      form.reportValidity();
      return;
    }
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      await axios.post(`${API}/public/contact`, payload);
      const panel = document.createElement('div');
      panel.className = 'form';
      panel.setAttribute('data-testid', 'landing-contact-success');
      panel.setAttribute('role', 'status');
      panel.style.cssText = 'justify-content:center;text-align:center;gap:14px';
      panel.innerHTML = SUCCESS_HTML;
      form.replaceWith(panel);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = original;
      const note = form.querySelector('.form-note');
      if (note) note.textContent = 'Something went wrong — please email Lee@quick-wing.com instead.';
    }
  };

  return (
    <>
      <style>{LANDING_CSS}</style>
      <div
        id="qw-landing"
        ref={rootRef}
        onClick={onClick}
        onInput={onInput}
        onSubmit={onSubmit}
        dangerouslySetInnerHTML={{ __html: LANDING_HTML }}
      />
    </>
  );
};

export default LandingPage;
'''

component = component.replace('__CSS__', scoped_css).replace('__HTML__', body.strip())
OUT.write_text(component)
print('written', OUT, len(component), 'chars')
