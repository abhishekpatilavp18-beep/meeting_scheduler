import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/MeetingsOverview';
import BookingPage from './pages/BookingPage';
import AvailabilitySetup from './pages/AvailabilitySetup';
import MeetingsManagement from './pages/MeetingsManagement';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import Organizations from './pages/Organizations';
import OrgDetail from './pages/OrgDetail';
import OrganizationView from './pages/OrganizationView';
import VideoRoom from './pages/VideoRoom';
import ProfilePage from './pages/ProfilePage';
import { ProtectedRoute, AdminRoute, HostRoute } from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import GridMotion from './components/GridMotion';
import RateLimitToast from './components/RateLimitToast';
import { socketService } from './services/socketService';
import './App.css';

function App() {
  useEffect(() => {
    socketService.connect();
    return () => socketService.disconnect();
  }, []);
  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <GridMotion />
          <div className="lumina-glow" style={{ top: '-10%', left: '-10%' }}></div>
          <div className="lumina-glow" style={{ bottom: '-10%', right: '-10%', background: 'radial-gradient(circle, var(--secondary-glow) 0%, transparent 70%)' }}></div>
          
          <Navbar />
          <RateLimitToast />
          
          <main className="content">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/book/:user" element={<ProtectedRoute><BookingPage /></ProtectedRoute>} />
              <Route path="/availability" element={<ProtectedRoute><AvailabilitySetup /></ProtectedRoute>} />
              <Route path="/meetings" element={<ProtectedRoute><MeetingsManagement /></ProtectedRoute>} />
              <Route path="/organizations" element={<ProtectedRoute><Organizations /></ProtectedRoute>} />
              <Route path="/organizations/view/:id" element={<ProtectedRoute><OrganizationView /></ProtectedRoute>} />
              <Route path="/organizations/:id" element={<HostRoute><OrgDetail /></HostRoute>} />
              <Route path="/room/:roomId" element={<ProtectedRoute><VideoRoom /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
