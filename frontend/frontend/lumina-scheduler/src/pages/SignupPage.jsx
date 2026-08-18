import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Globe, ArrowRight, Clock, ShieldCheck, Briefcase } from 'lucide-react';
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import api from '../services/api';
import GradientText from '../components/GradientText';

dayjs.extend(utc);
dayjs.extend(timezone);

const API_KEY = "dc7aa71928604bb895448983315e91cd";

const COUNTRY_TIMEZONE_MAP = {
  "India": "Asia/Kolkata",
  "United States": "America/New_York",
  "United Kingdom": "Europe/London",
  "Australia": "Australia/Sydney",
  "Canada": "America/Toronto",
  "Germany": "Europe/Berlin",
  "France": "Europe/Paris",
  "Japan": "Asia/Tokyo",
  "Singapore": "Asia/Singapore",
  "Brazil": "America/Sao_Paulo"
};

const SignupPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    country: 'United States',
    role: 'member'
  });
  const [currentTime, setCurrentTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiTimeData, setApiTimeData] = useState(null);

  // Auto-detect user location via IP Geolocation API
  useEffect(() => {
    const detectLocation = async () => {
      try {
        const res = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${API_KEY}`);
        const data = await res.json();
        if (data.country_name) {
          const matchedCountry = Object.keys(COUNTRY_TIMEZONE_MAP).find(
            c => c.toLowerCase() === data.country_name.toLowerCase()
          );
          if (matchedCountry) {
            setFormData(prev => ({ ...prev, country: matchedCountry }));
          }
        }
      } catch (err) {
        console.error("Location detection failed", err);
      }
    };
    detectLocation();
  }, []);

  const [timeOffset, setTimeOffset] = useState(0);

  // Fetch live time data whenever country changes
  useEffect(() => {
    const fetchTime = async () => {
      const tz = COUNTRY_TIMEZONE_MAP[formData.country] || "UTC";
      try {
        const res = await fetch(`https://api.ipgeolocation.io/timezone?apiKey=${API_KEY}&tz=${tz}`);
        const data = await res.json();
        setApiTimeData(data);
        
        // Calculate offset between local machine time and API time
        const apiMoment = dayjs(data.date_time_wti);
        const localMoment = dayjs();
        setTimeOffset(apiMoment.diff(localMoment));
      } catch (err) {
        console.error("Time fetch failed", err);
      }
    };
    fetchTime();
  }, [formData.country]);

  // Real-time clock update (synced with API data if available)
  useEffect(() => {
    const updateTime = () => {
      const tz = COUNTRY_TIMEZONE_MAP[formData.country] || "UTC";
      // Apply the offset to the local clock to get the true synced time
      const syncedMoment = dayjs().add(timeOffset, 'millisecond');
      const formatted = syncedMoment.tz(tz).format("dddd, MMMM D, YYYY — hh:mm:ss A");
      setCurrentTime(formatted);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [formData.country, timeOffset]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/register', {
        ...formData,
        timezone: COUNTRY_TIMEZONE_MAP[formData.country]
      });
      if (res.success) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        
        // Notify other components (like Navbar) that auth state changed
        window.dispatchEvent(new Event('auth-change'));
        
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="signup-card glass-card"
      >
        <div className="signup-header">
          <div className="logo-section">
             <img src="/kite-logo.png" alt="Kite" style={{ height: '60px', marginBottom: '1rem' }} />
          </div>
          <GradientText colors={["#3b82f6", "#8b5cf6", "#10b981"]}>
            <h1 className="signup-title">Create your workspace</h1>
          </GradientText>
          <p className="signup-subtitle">Experience the future of scheduling today.</p>
        </div>

        <form className="signup-form" onSubmit={handleSignup}>
          {error && <div className="error-box">{error}</div>}
          
          <div className="input-row">
            <div className="input-field">
              <label><User size={14} /> Full Name</label>
              <div className="input-wrap">
                <input 
                  type="text" 
                  placeholder="Alex Rivera" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required 
                />
              </div>
            </div>
            
            <div className="input-field">
              <label><Mail size={14} /> Email Address</label>
              <div className="input-wrap">
                <input 
                  type="email" 
                  placeholder="alex@example.com" 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  required 
                />
              </div>
            </div>
          </div>

          <div className="input-field">
            <label><Lock size={14} /> Secure Password</label>
            <div className="input-wrap">
              <input 
                type="password" 
                placeholder="••••••••••••" 
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                required 
              />
            </div>
          </div>

          <div className="input-field">
            <label><Briefcase size={14} /> Account Type</label>
            <div className="role-selection">
              <div 
                className={`role-card ${formData.role === 'host' ? 'active' : ''}`}
                onClick={() => setFormData({...formData, role: 'host'})}
              >
                <div className="role-icon">🎙️</div>
                <div className="role-details">
                  <h4>Host</h4>
                  <p>Create meetings, manage slots, and host sessions.</p>
                </div>
                <div className="radio-circle"></div>
              </div>
              
              <div 
                className={`role-card ${formData.role === 'member' ? 'active' : ''}`}
                onClick={() => setFormData({...formData, role: 'member'})}
              >
                <div className="role-icon">👥</div>
                <div className="role-details">
                  <h4>Member</h4>
                  <p>Join meetings, book slots, and manage availability.</p>
                </div>
                <div className="radio-circle"></div>
              </div>
            </div>
          </div>

          <div className="input-field">
            <label><Globe size={14} /> Country / Region</label>
            <div className="input-wrap">
              <select 
                value={formData.country}
                onChange={e => setFormData({...formData, country: e.target.value})}
              >
                {Object.keys(COUNTRY_TIMEZONE_MAP).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div 
              key={formData.country}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="time-preview glass-card"
            >
              <div className="time-header">
                <Clock size={16} />
                <span>Live Time in {formData.country}</span>
              </div>
              <div className="time-value">
                {currentTime || "Loading time..."}
              </div>
            </motion.div>
          </AnimatePresence>

          <button className="btn-primary signup-btn" disabled={isLoading}>
            {isLoading ? 'Creating Account...' : <>Create Account <ArrowRight size={18} /></>}
          </button>
        </form>

        <div className="signup-footer">
          <p>Already have an account? <Link to="/login">Sign In</Link></p>
          <div className="security-tag">
            <ShieldCheck size={14} />
            <span>Enterprise-grade encryption active</span>
          </div>
        </div>
      </motion.div>

      <style>{`
        .signup-container {
          min-height: 90vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: radial-gradient(circle at top right, rgba(59, 130, 246, 0.05), transparent 40%),
                      radial-gradient(circle at bottom left, rgba(139, 92, 246, 0.05), transparent 40%);
        }
        .signup-card {
          width: 100%;
          max-width: 580px;
          padding: 3rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 40px 100px rgba(0,0,0,0.4);
        }
        .signup-header {
          text-align: center;
          margin-bottom: 2.5rem;
        }
        .signup-title {
          font-size: 2.2rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: 0.5rem;
        }
        .signup-subtitle {
          color: var(--text-muted);
          font-size: 1rem;
        }
        .signup-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .input-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }
        .input-field {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }
        .input-field label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding-left: 0.25rem;
        }
        .input-wrap input, .input-wrap select {
          width: 100%;
          padding: 0.85rem 1.25rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          color: white;
          font-size: 0.95rem;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          outline: none;
          cursor: pointer;
        }
        .input-wrap select option {
          background-color: #0f172a;
          color: white;
        }
        .input-wrap input:focus, .input-wrap select:focus {
          border-color: var(--primary);
          background: rgba(255, 255, 255, 0.05);
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.15);
        }
        .role-selection {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-top: 0.25rem;
        }
        .role-card {
          padding: 1.25rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          cursor: pointer;
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }
        .role-card:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.15);
        }
        .role-card.active {
          background: rgba(59, 130, 246, 0.1);
          border-color: var(--primary);
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.15);
        }
        .role-icon {
          font-size: 1.5rem;
          line-height: 1;
        }
        .role-details {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          padding-right: 1.5rem;
        }
        .role-details h4 {
          font-size: 0.95rem;
          font-weight: 700;
          margin: 0;
          color: white;
        }
        .role-details p {
          font-size: 0.75rem;
          color: var(--text-muted);
          line-height: 1.4;
          margin: 0;
        }
        .radio-circle {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.2);
          position: absolute;
          top: 1.25rem;
          right: 1rem;
          transition: all 0.2s;
        }
        .role-card.active .radio-circle {
          border-color: var(--primary);
          border-width: 5px;
          background: white;
        }
        .time-preview {
          margin-top: 0.5rem;
          padding: 1.25rem;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1));
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          text-align: left;
        }
        .time-header {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--primary);
        }
        .time-value {
          font-family: 'JetBrains Mono', monospace;
          font-size: 1.1rem;
          font-weight: 600;
          color: #fff;
          text-shadow: 0 0 10px rgba(255,255,255,0.2);
        }
        .signup-btn {
          margin-top: 1rem;
          padding: 1rem;
          font-size: 1rem;
          font-weight: 700;
          border-radius: 14px;
          justify-content: center;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          box-shadow: 0 10px 25px rgba(59, 130, 246, 0.3);
        }
        .signup-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 35px rgba(59, 130, 246, 0.4);
        }
        .signup-footer {
          margin-top: 2rem;
          text-align: center;
        }
        .signup-footer p {
          color: var(--text-muted);
          font-size: 0.9rem;
          margin-bottom: 1.5rem;
        }
        .signup-footer a {
          color: var(--primary);
          text-decoration: none;
          font-weight: 700;
          margin-left: 0.5rem;
        }
        .security-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.7rem;
          color: rgba(16, 185, 129, 0.6);
          padding: 0.5rem 1rem;
          background: rgba(16, 185, 129, 0.05);
          border-radius: 100px;
          border: 1px solid rgba(16, 185, 129, 0.1);
        }
        .error-box {
          padding: 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #ef4444;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 600;
        }
        @media (max-width: 640px) {
          .input-row { grid-template-columns: 1fr; }
          .role-selection { grid-template-columns: 1fr; }
          .signup-card { padding: 2rem 1.5rem; }
        }
      `}</style>
    </div>
  );
};

export default SignupPage;
