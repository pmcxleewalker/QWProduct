import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import LiveSheet from './pages/LiveSheet';
import StatusUpdate from './pages/StatusUpdate';
import Bookings from './pages/Bookings';
import Assistance from './pages/Assistance';
import Admin from './pages/Admin';
import Navigation from './components/Navigation';
import MessageAcknowledgmentModal from './components/MessageAcknowledgmentModal';
import './App.css';

// Wrapper component that handles message acknowledgment
const AppContent = () => {
  const { user, isAuthenticated } = useAuth();
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [checkingMessages, setCheckingMessages] = useState(false);

  useEffect(() => {
    // Reset acknowledgment state when user changes
    if (isAuthenticated && user) {
      setHasAcknowledged(false);
      setCheckingMessages(true);
    } else {
      setHasAcknowledged(false);
      setCheckingMessages(false);
    }
  }, [isAuthenticated, user]);

  const handleAcknowledgmentComplete = () => {
    setHasAcknowledged(true);
    setCheckingMessages(false);
  };

  // Show blocking modal for authenticated users who haven't acknowledged
  const showBlockingModal = isAuthenticated && checkingMessages && !hasAcknowledged;

  return (
    <div className="App min-h-screen bg-gray-50">
      {/* Blocking Message Acknowledgment Modal - Must acknowledge before using app */}
      {showBlockingModal && (
        <MessageAcknowledgmentModal onComplete={handleAcknowledgmentComplete} />
      )}

      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/status-update" element={<StatusUpdate />} />
        
        {/* Protected routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Navigation />
              <div className="pt-14 pb-20 md:pt-0 md:pb-0">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/live-sheet" element={<LiveSheet />} />
                  <Route path="/bookings" element={<Bookings />} />
                  <Route path="/assistance" element={<Assistance />} />
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute adminOnly={true}>
                        <Admin />
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </div>
            </ProtectedRoute>
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
