import { useEffect, useMemo, useRef } from 'react';
import { LANDING_HTML } from './landing/content';
import { useLandingInteractions } from './landing/useLandingInteractions';
import { useMobileSections } from './landing/useMobileSections';
import './landing/LandingPage.css';
import './landing/MobileSections.css';
import './landing/Showcase.css';

// Static, trusted site content keeps the supplied copy and assets intact.
// Interaction is delegated to the root; no submitted values enter the markup.
export default function LandingPage() {
  const rootRef = useRef(null);
  // A stable prop prevents React 19 from replacing this interactive DOM on rerenders.
  const markup = useMemo(() => ({ __html: LANDING_HTML }), []);
  useMobileSections(rootRef);
  const handlers = useLandingInteractions(rootRef);

  useEffect(() => {
    document.documentElement.classList.add('qw-home');
    return () => document.documentElement.classList.remove('qw-home');
  }, []);

  return <div id="qw-landing" data-testid="landing-page" ref={rootRef}
    {...handlers} dangerouslySetInnerHTML={markup} />;
}