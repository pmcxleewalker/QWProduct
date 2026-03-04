import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import TenantLogin from './pages/TenantLogin';
import Register from './pages/Register';
import TenantDashboard from './pages/TenantDashboard';
import Dashboard from './pages/Dashboard';
import LiveSheet from './pages/LiveSheet';
import Bookings from './pages/Bookings';
import Assistance from './pages/Assistance';
import Admin from './pages/Admin';
import MileageUpdate from './pages/MileageUpdate';
import Setup from './pages/Setup';
import SetupWizard from './pages/SetupWizard';
import TermsOfService from './pages/TermsOfService';
import TenantSelector from './pages/TenantSelector';
import PlatformAdmin from './pages/PlatformAdmin';
import Reports from './pages/Reports';
import RequestLift from './pages/RequestLift';
import Navigation from './components/Navigation';
import MobileBottomNav from './components/MobileBottomNav';
import Footer from './components/Footer';
import MessageAcknowledgmentModal from './components/MessageAcknowledgmentModal';
import './App.css';

// Redirect old status-update URLs to mileage page
const StatusUpdateRedirect = () => {
  const [searchParams] = useSearchParams();
  const carId = searchParams.get('car');
  return <Navigate to={carId ? `/mileage?car=${carId}` : '/dashboard'} replace />;
};

// Login page with redirect for already logged-in users
const LoginRedirect = () => {
  const { isAuthenticated, user, hasTenantContext, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  // If authenticated, redirect based on role
  if (isAuthenticated && user) {
    const isPlatformAdminUser = user.role === 'super_admin' || user.role === 'master_admin';
    
    if (isPlatformAdminUser && !hasTenantContext) {
      return <Navigate to="/platform" replace />;
    }
    if (hasTenantContext) {
      return <Navigate to="/" replace />;
    }
    return <Navigate to="/select-tenant" replace />;
  }
  
  return <Login />;
};

// Protected route that requires tenant context
const TenantProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, user, hasTenantContext, needsTenantSelection, activeTenant, loading } = useAuth();

  // Direct role checks to avoid function call timing issues
  const isPlatformAdminUser = user?.role === 'super_admin' || user?.role === 'master_admin';
  const isTenantAdminUser = activeTenant?.role === 'admin' || activeTenant?.role === 'master_admin' || isPlatformAdminUser;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Platform admins without tenant context should go to platform page
  if (isPlatformAdminUser && !hasTenantContext) {
    return <Navigate to="/platform" replace />;
  }

  // Regular users need to select tenant first
  if (needsTenantSelection && !hasTenantContext) {
    return <Navigate to="/select-tenant" replace />;
  }

  // Check tenant context for regular routes (non-platform admins)
  if (!hasTenantContext && !isPlatformAdminUser) {
    return <Navigate to="/select-tenant" replace />;
  }

  // Admin only check
  if (adminOnly && !isTenantAdminUser) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Platform admin route protection
const PlatformProtectedRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if user is platform admin using direct role check
  const isPlatformAdminUser = user?.role === 'super_admin' || user?.role === 'master_admin';
  
  if (!isPlatformAdminUser) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Tenant Routes - handles /{tenant-slug}/* routes
const TenantRoutes = () => {
  const { tenantSlug } = useParams();
  const { isAuthenticated, activeTenant, selectTenant, user, loading } = useAuth();
  const [tenantLoading, setTenantLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const setupTenantContext = async () => {
      if (!isAuthenticated) {
        setTenantLoading(false);
        return;
      }

      // If we already have the right tenant selected, we're good
      if (activeTenant?.tenant_slug === tenantSlug) {
        setTenantLoading(false);
        setAccessDenied(false);
        return;
      }

      // Super Admins and Master Admins have access to ALL franchises
      const isPlatformAdminUser = user?.role === 'super_admin' || user?.role === 'master_admin';

      // Try to find and select the tenant from user's memberships
      if (user?.memberships) {
        const membership = user.memberships.find(m => m.tenant_slug === tenantSlug);
        if (membership) {
          try {
            await selectTenant(membership.tenant_id);
            setAccessDenied(false);
          } catch (err) {
            console.error('Failed to select tenant:', err);
            // Platform admins should still have access even if select fails
            setAccessDenied(!isPlatformAdminUser);
          }
        } else if (isPlatformAdminUser) {
          // Platform admin without direct membership - allow access anyway
          // They can impersonate any tenant
          setAccessDenied(false);
        } else {
          // Regular user doesn't have membership to this tenant
          setAccessDenied(true);
        }
      } else {
        // No memberships loaded yet - wait
        setAccessDenied(false);
      }
      setTenantLoading(false);
    };

    setupTenantContext();
  }, [isAuthenticated, tenantSlug, activeTenant, selectTenant, user]);

  if (loading || tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/${tenantSlug}/login`} replace />;
  }

  // Super Admins and Master Admins have access to ALL franchises
  const isPlatformAdmin = user?.role === 'super_admin' || user?.role === 'master_admin';
  
  // Check if user has access - platform admins have universal access
  const hasAccess = isPlatformAdmin ||
                    activeTenant?.tenant_slug === tenantSlug || 
                    user?.memberships?.some(m => m.tenant_slug === tenantSlug);
  
  if (accessDenied && !hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-7.636a9 9 0 11-12.728 0" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">
            You don't have access to this franchise.
          </p>
          <a href="/login" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Return to Login
          </a>
        </div>
      </div>
    );
  }

  const isTenantAdmin = activeTenant?.role === 'admin' || activeTenant?.role === 'master_admin' || user?.role === 'super_admin';

  return (
    <>
      <Navigation tenantSlug={tenantSlug} />
      <div className="pt-16 pb-20 sm:pb-4 flex-grow">
        <Routes>
          <Route path="/" element={<TenantDashboard />} />
          <Route path="/legacy-dashboard" element={<Dashboard />} />
          <Route path="/live-sheet" element={<LiveSheet />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/assistance" element={<Assistance />} />
          <Route path="/mileage" element={<MileageUpdate />} />
          <Route path="/setup-wizard" element={<SetupWizard />} />
          <Route
            path="/reports"
            element={
              isTenantAdmin ? <Reports /> : <Navigate to={`/${tenantSlug}`} replace />
            }
          />
          <Route
            path="/admin"
            element={
              isTenantAdmin ? <Admin /> : <Navigate to={`/${tenantSlug}`} replace />
            }
          />
        </Routes>
      </div>
      <Footer />
      <MobileBottomNav tenantSlug={tenantSlug} />
    </>
  );
};

// Wrapper component that handles message acknowledgment
const AppContent = () => {
  const { user, isAuthenticated, hasTenantContext, isPlatformAdmin } = useAuth();
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Show modal when user logs in and has tenant context (not for platform admins)
    if (isAuthenticated && user && hasTenantContext && !hasAcknowledged && !isPlatformAdmin()) {
      setShowModal(true);
    }
  }, [isAuthenticated, user, hasTenantContext, hasAcknowledged, isPlatformAdmin]);

  const handleAcknowledgmentComplete = () => {
    setHasAcknowledged(true);
    setShowModal(false);
  };

  return (
    <div className="App min-h-screen bg-gray-50 flex flex-col">
      {/* Blocking Message Acknowledgment Modal */}
      {showModal && isAuthenticated && hasTenantContext && (
        <MessageAcknowledgmentModal onComplete={handleAcknowledgmentComplete} />
      )}

      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginRedirect />} />
        <Route path="/register" element={<Register />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/status-update" element={<StatusUpdateRedirect />} />
        
        {/* Tenant Selection */}
        <Route path="/select-tenant" element={
          <ProtectedRoute>
            <TenantSelector />
          </ProtectedRoute>
        } />
        
        {/* Setup Wizard for new Master Admins */}
        <Route path="/setup-wizard" element={
          <TenantProtectedRoute>
            <SetupWizard />
          </TenantProtectedRoute>
        } />
        
        {/* Platform Admin - No tenant context needed */}
        <Route path="/platform" element={
          <PlatformProtectedRoute>
            <PlatformAdmin />
          </PlatformProtectedRoute>
        } />
        
        {/* Path-based Tenant Routes: /{tenant-slug}/... */}
        <Route path="/:tenantSlug/login" element={<TenantLogin />} />
        
        <Route path="/:tenantSlug/*" element={<TenantRoutes />} />
        
        {/* Legacy tenant-scoped routes (for backward compatibility) */}
        <Route
          path="/*"
          element={
            <TenantProtectedRoute>
              <Navigation />
              <div className="pt-16 pb-20 sm:pb-4 flex-grow">
                <Routes>
                  <Route path="/" element={<TenantDashboard />} />
                  <Route path="/legacy-dashboard" element={<Dashboard />} />
                  <Route path="/live-sheet" element={<LiveSheet />} />
                  <Route path="/bookings" element={<Bookings />} />
                  <Route path="/assistance" element={<Assistance />} />
                  <Route path="/mileage" element={<MileageUpdate />} />
                  <Route
                    path="/admin"
                    element={
                      <TenantProtectedRoute adminOnly={true}>
                        <Admin />
                      </TenantProtectedRoute>
                    }
                  />
                </Routes>
              </div>
              <Footer />
              <MobileBottomNav />
            </TenantProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
