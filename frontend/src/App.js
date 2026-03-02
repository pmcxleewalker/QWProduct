import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import LiveSheet from './pages/LiveSheet';
import Bookings from './pages/Bookings';
import Assistance from './pages/Assistance';
import Admin from './pages/Admin';
import MileageUpdate from './pages/MileageUpdate';
import Setup from './pages/Setup';
import TermsOfService from './pages/TermsOfService';
import TenantSelector from './pages/TenantSelector';
import PlatformAdmin from './pages/PlatformAdmin';
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

// Protected route that requires tenant context
const TenantProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, hasTenantContext, needsTenantSelection, isPlatformAdmin, isTenantAdmin, loading } = useAuth();

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

  // Platform admins can access platform admin page without tenant context
  if (isPlatformAdmin() && !hasTenantContext) {
    return <Navigate to="/platform" replace />;
  }

  // Regular users need to select tenant first
  if (needsTenantSelection && !hasTenantContext) {
    return <Navigate to="/select-tenant" replace />;
  }

  // Check tenant context for regular routes
  if (!hasTenantContext && !isPlatformAdmin()) {
    return <Navigate to="/select-tenant" replace />;
  }

  // Admin only check
  if (adminOnly && !isTenantAdmin()) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Platform admin route protection
const PlatformProtectedRoute = ({ children }) => {
  const { isAuthenticated, isPlatformAdmin, loading } = useAuth();

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

  if (!isPlatformAdmin()) {
    return <Navigate to="/" replace />;
  }

  return children;
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
        <Route path="/login" element={<Login />} />
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
        
        {/* Platform Admin - No tenant context needed */}
        <Route path="/platform" element={
          <PlatformProtectedRoute>
            <PlatformAdmin />
          </PlatformProtectedRoute>
        } />
        
        {/* Tenant-scoped routes */}
        <Route
          path="/*"
          element={
            <TenantProtectedRoute>
              <Navigation />
              <div className="pt-16 pb-20 sm:pb-4 flex-grow">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
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
