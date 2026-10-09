import { useLayoutEffect } from 'react';

export function useMobileSections(rootRef) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    const media = window.matchMedia('(max-width: 767px)');
    const getDetails = () => [...root.querySelectorAll('[data-mobile-section]')];
    let mobileOpen = new Set();
    let wasMobile = false;
    let frame;

    const targetForHash = (hash) => {
      if (!hash || hash === '#') return null;
      let id;
      try { id = decodeURIComponent(hash.slice(1)); } catch { return null; }
      const target = document.getElementById(id);
      return target && root.contains(target) ? target : null;
    };

    const reveal = (target) => {
      const panel = target?.closest('[data-mobile-section]') || target?.querySelector('[data-mobile-section]');
      if (panel) {
        panel.open = true;
        if (media.matches) mobileOpen.add(panel.dataset.mobileSection);
      }
    };

    const revealHash = () => {
      const target = targetForHash(window.location.hash);
      if (!target) return;
      reveal(target);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: 'instant' }));
    };

    const syncMode = () => {
      const details = getDetails();
      if (wasMobile) mobileOpen = new Set(details.filter(panel => panel.open).map(panel => panel.dataset.mobileSection));
      wasMobile = media.matches;
      details.forEach(panel => { panel.open = !media.matches || mobileOpen.has(panel.dataset.mobileSection); });
    };

    const onToggle = (event) => {
      const panel = event.target;
      if (!wasMobile || !media.matches || !panel.matches('[data-mobile-section]')) return;
      if (panel.open) mobileOpen.add(panel.dataset.mobileSection);
      else mobileOpen.delete(panel.dataset.mobileSection);
    };

    const onLink = (event) => {
      const link = event.target.closest?.('a[href^="#"]');
      if (link) reveal(targetForHash(link.getAttribute('href')));
    };

    syncMode();
    revealHash();
    // Capture runs before the browser's anchor navigation, opening the target first.
    root.addEventListener('click', onLink, true);
    root.addEventListener('toggle', onToggle, true);
    media.addEventListener('change', syncMode);
    window.addEventListener('hashchange', revealHash);
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener('click', onLink, true);
      root.removeEventListener('toggle', onToggle, true);
      media.removeEventListener('change', syncMode);
      window.removeEventListener('hashchange', revealHash);
    };
  }, [rootRef]);
}