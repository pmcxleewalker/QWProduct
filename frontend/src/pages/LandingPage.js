import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LANDING_HTML } from './landing/content';
import { useLandingInteractions } from './landing/useLandingInteractions';
import { useMobileSections } from './landing/useMobileSections';
import './landing/LandingPage.css';
import './landing/MobileSections.css';
import './landing/Showcase.css';
import './landing/Pricing.css';
import { PublicPricing } from '../components/subscriptions/PublicPricing';
import { useSubscriptionData } from '../components/subscriptions/useSubscriptionData';

// Static, trusted site content keeps the supplied copy and assets intact.
// Interaction is delegated to the root; no submitted values enter the markup.
export default function LandingPage() {
  const rootRef = useRef(null);
  // A stable prop prevents React 19 from replacing this interactive DOM on rerenders.
  const markup = useMemo(() => ({ __html: LANDING_HTML }), []);
  useMobileSections(rootRef);
  const { onChoosePlan, onSyncPricing, ...handlers } = useLandingInteractions(rootRef);
  const pricing = useSubscriptionData('/public/subscription-catalog');
  const [pricingMount, setPricingMount] = useState(null);

  useEffect(() => { onSyncPricing(pricing.data); }, [pricing.data, onSyncPricing]);

  useEffect(() => {
    setPricingMount(rootRef.current.querySelector('[data-pricing-mount]'));
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('qw-home');
    return () => document.documentElement.classList.remove('qw-home');
  }, []);

  return <><div id="qw-landing" data-testid="landing-page" ref={rootRef}
    {...handlers} dangerouslySetInnerHTML={markup} />
    {pricingMount && createPortal(<PublicPricing catalog={pricing.data} loading={pricing.loading}
      error={pricing.error} retry={pricing.reload} onChoose={onChoosePlan} />, pricingMount)}</>;
}