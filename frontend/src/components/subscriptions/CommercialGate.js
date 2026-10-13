import { useAuth } from '../../contexts/AuthContext';
import { useSubscriptionData } from './useSubscriptionData';

export const CommercialGate = ({ feature, children }) => {
  const { activeTenant } = useAuth();
  const state = useSubscriptionData('/tenant/subscription', activeTenant?.tenant_id);
  if (state.loading) return <p role="status" data-testid={`access-loading-${feature}`}>Checking plan access…</p>;
  if (state.error) return <div role="alert" data-testid={`access-error-${feature}`}><p>{state.error}</p><button data-testid={`access-retry-${feature}`} onClick={state.reload}>Retry</button></div>;
  if (state.data?.capabilities === null || state.data?.capabilities?.includes(feature)) return children;
  const pro = ['custom_documents', 'branded_pdf_headers', 'advanced_staff_usage', 'advanced_vehicle_usage'].includes(feature);
  const href = pro ? '/?interest=professional#contact' : activeTenant?.tenant_slug ? `/${activeTenant.tenant_slug}/subscription` : '/dashboard/subscription';
  return <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" data-testid={`access-notice-${feature}`}><p>{pro ? 'Planned for QuickWing Professional — coming soon.' : 'Included in QuickWing Essential. Your standard reports and existing records are unchanged.'}</p><a className="underline font-semibold inline-block mt-2" data-testid={`access-plans-${feature}`} href={href}>{pro ? 'Register interest' : 'View plan options'}</a></div>;
};