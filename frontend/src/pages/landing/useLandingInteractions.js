import { useCallback, useEffect, useRef } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const AUTOMATION = 0.73;
const eur = (n) => (n < 0 ? '−€' : '€') + Math.abs(Math.round(n)).toLocaleString('en-IE');

export function useLandingInteractions(rootRef) {
  const priceRef = useRef(6.5);
  const submittingRef = useRef(false);
  const onChoosePlan = useCallback((plan) => {
    const root = rootRef.current;
    const input = root?.querySelector('[name="plan_interest"]');
    if (!input) return;
    input.value = plan;
    const fuel = root.querySelector('.fuel-interest');
    fuel.hidden = !['essential', 'professional'].includes(plan);
    if (fuel.hidden) fuel.querySelector('input').checked = false;
  }, [rootRef]);

  useEffect(() => {
    const plan = new URLSearchParams(window.location.search).get('interest');
    if (['standard', 'essential', 'professional'].includes(plan)) onChoosePlan(plan);
  }, [onChoosePlan]);

  const calc = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const v = root.querySelector('#roi-v');
    const h = root.querySelector('#roi-h');
    const r = root.querySelector('#roi-r');
    const saved = (h.value * 52) / 12 * AUTOMATION;
    const value = saved * r.value;
    const cost = v.value * priceRef.current;
    root.querySelector('#o-v').textContent = v.value;
    root.querySelector('#o-h').textContent = `${h.value} h`;
    root.querySelector('#o-r').textContent = `€${r.value}`;
    root.querySelector('#r-hours').textContent = Math.round(saved);
    root.querySelector('#r-value').textContent = eur(value);
    root.querySelector('#r-cost').textContent = eur(cost);
    root.querySelector('#r-net').textContent = eur(value - cost);
  }, [rootRef]);

  const onSyncPricing = useCallback((catalog) => {
    const root = rootRef.current;
    if (!root || !catalog?.plans) return;
    [['standard', 'roi-plan-6-5'], ['essential', 'roi-plan-8-5']].forEach(([id, testId]) => {
      const offer = catalog.plans.find(plan => plan.id === id);
      const button = root.querySelector(`[data-testid="${testId}"]`);
      if (offer && button) {
        button.dataset.price = String(offer.unit_price_cents / 100);
        button.textContent = `€${(offer.unit_price_cents / 100).toFixed(2)} · ${offer.name.replace('QuickWing ', '')}`;
        if (button.getAttribute('aria-pressed') === 'true') priceRef.current = offer.unit_price_cents / 100;
      }
    });
    calc();
  }, [rootRef, calc]);

  const selectTab = (tab) => {
    const root = rootRef.current;
    root.querySelectorAll('.tab').forEach((item) => {
      item.setAttribute('aria-selected', String(item === tab));
      item.tabIndex = item === tab ? 0 : -1;
    });
    const image = root.querySelector('#tab-img');
    image.src = tab.dataset.img;
    image.alt = tab.dataset.alt;
    root.querySelector('#feature-preview-title').textContent = tab.dataset.title;
    root.querySelector('#feature-preview-description').textContent = tab.dataset.description;
    root.querySelector('#feature-preview-index').textContent = `${tab.dataset.index.padStart(2, '0')} / 05`;
    root.querySelector('#feature-preview').setAttribute('aria-labelledby', tab.id);
  };

  const galleryState = useCallback(() => {
    const gallery = rootRef.current.querySelector('#field-gallery');
    const items = [...gallery.querySelectorAll('article')];
    const step = items[1].offsetLeft - items[0].offsetLeft;
    const atEnd = gallery.scrollLeft + gallery.clientWidth >= gallery.scrollWidth - 2;
    const overflowing = gallery.scrollWidth > gallery.clientWidth + 2;
    const index = !overflowing ? 0 : atEnd ? items.length - 1 : Math.round(gallery.scrollLeft / step);
    return { gallery, items, index, atEnd };
  }, [rootRef]);

  const syncGallery = useCallback(() => {
    const { items, index, atEnd } = galleryState();
    const root = rootRef.current;
    root.querySelector('[data-testid="landing-field-gallery-count"]').textContent = `${index + 1} / ${items.length}`;
    root.querySelector('[data-gallery-step="-1"]').disabled = index === 0;
    root.querySelector('[data-gallery-step="1"]').disabled = atEnd;
  }, [rootRef, galleryState]);

  useEffect(() => {
    const gallery = rootRef.current.querySelector('#field-gallery');
    const syncLayout = () => {
      syncGallery();
      rootRef.current.querySelector('.tabs').setAttribute('aria-orientation',
        window.matchMedia('(max-width: 720px)').matches ? 'horizontal' : 'vertical');
    };
    const observer = new ResizeObserver(syncLayout);
    observer.observe(gallery);
    syncLayout();
    return () => observer.disconnect();
  }, [rootRef, syncGallery]);

  const onScrollCapture = (event) => {
    if (event.target.id === 'field-gallery') syncGallery();
  };

  const closeMenu = () => {
    const root = rootRef.current;
    root.querySelector('#mobile-menu').classList.remove('open');
    const button = root.querySelector('.menu-btn');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'Open menu');
  };

  const onClick = (event) => {
    const root = rootRef.current;
    const target = event.target;
    if (!root || !target.closest) return;
    const menuBtn = target.closest('.menu-btn');
    if (menuBtn) {
      const open = root.querySelector('#mobile-menu').classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      return;
    }
    if (target.closest('#mobile-menu a')) closeMenu();
    const galleryButton = target.closest('[data-gallery-step]');
    if (galleryButton) {
      const { gallery, items, index } = galleryState();
      const next = Math.max(0, Math.min(items.length - 1, index + Number(galleryButton.dataset.galleryStep)));
      gallery.scrollTo({ left: items[next].offsetLeft - items[0].offsetLeft,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      return;
    }
    const tab = target.closest('.tab');
    if (tab) selectTab(tab);
    const plan = target.closest('.plan-btns button');
    if (plan) {
      root.querySelectorAll('.plan-btns button').forEach((item) => item.setAttribute('aria-pressed', String(item === plan)));
      priceRef.current = parseFloat(plan.dataset.price);
      calc();
    }
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      if (rootRef.current.querySelector('#mobile-menu').classList.contains('open')) {
        closeMenu();
        rootRef.current.querySelector('.menu-btn').focus();
      }
      return;
    }
    const tab = event.target.closest('.tab');
    if (!tab || !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...rootRef.current.querySelectorAll('.tab')];
    const step = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1;
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (tabs.indexOf(tab) + step + tabs.length) % tabs.length;
    selectTab(tabs[index]);
    tabs[index].focus();
  };

  const onSubmit = async (event) => {
    if (event.target.id !== 'contact-form') return;
    event.preventDefault();
    const form = event.target;
    if (submittingRef.current || !form.reportValidity()) return;
    const fields = new FormData(form);
    const value = (key) => (fields.get(key) || '').trim();
    if (['full_name', 'company', 'email', 'phone'].some((key) => !value(key))) return;
    const button = form.querySelector('button[type="submit"]');
    const note = form.querySelector('.form-note');
    submittingRef.current = true;
    button.disabled = true;
    button.textContent = 'Sending…';
    note.textContent = "We'll only use your details to reply to this enquiry.";
    try {
      await axios.post(`${API}/public/contact`, {
        name: value('full_name'), company: value('company'), email: value('email'),
        phone: value('phone'), message: value('message') || null,
        type: value('plan_interest') ? 'pricing' : 'general', plan_interest: value('plan_interest') || null,
        fuel_card_interest: fields.get('fuel_card_interest') === 'on',
      });
      const panel = document.createElement('div');
      panel.className = 'form contact-success';
      panel.setAttribute('data-testid', 'landing-contact-success');
      panel.setAttribute('role', 'status');
      panel.setAttribute('tabindex', '-1');
      panel.innerHTML = '<span class="success-mark" aria-hidden="true">✓</span><h3 data-testid="landing-contact-success-title">Message sent</h3><p data-testid="landing-contact-success-message">Thanks — your enquiry is on its way to Lee. He’ll personally get back to you.</p>';
      form.replaceWith(panel);
      panel.focus();
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Send Message';
      note.textContent = 'Something went wrong — please email Lee@quick-wing.com instead.';
      note.setAttribute('role', 'alert');
    } finally {
      submittingRef.current = false;
    }
  };

  return { onChoosePlan, onSyncPricing, onClick, onKeyDown, onSubmit, onScrollCapture, onInput: (event) => {
    if (event.target.matches('input[type=range]')) calc();
    if (event.target.name === 'plan_interest') onChoosePlan(event.target.value);
  } };
}