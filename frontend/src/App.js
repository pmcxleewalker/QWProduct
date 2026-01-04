import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
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
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="App min-h-screen bg-gray-50">
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
                  <div className="pb-20 md:pb-0">
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
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
