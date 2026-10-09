import { useEffect, useRef } from 'react';
import { LANDING_HTML } from './landing/content';
import { useLandingInteractions } from './landing/useLandingInteractions';
import './landing/LandingPage.css';

// Static, trusted site content keeps the supplied copy and assets intact.
// Interaction is delegated to the root; no submitted values enter the markup.
export default function LandingPage() {
  const rootRef = useRef(null);
  const handlers = useLandingInteractions(rootRef);

  useEffect(() => {
    document.documentElement.classList.add('qw-home');
    return () => document.documentElement.classList.remove('qw-home');
  }, []);

  return <div id="qw-landing" data-testid="landing-page" ref={rootRef}
    {...handlers} dangerouslySetInnerHTML={{ __html: LANDING_HTML }} />;
}