import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Shield, Globe, CheckCircle2 } from 'lucide-react';
import GradientText from '../components/GradientText';
import api from '../services/api';

const LoginPage = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const endpoint = isRegistering ? '/auth/register' : '/auth/login';
      const payload = isRegistering ? { name, email, password, country } : { email, password };
      const response = await api.post(endpoint, payload);
      if (response.success && response.data) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        window.dispatchEvent(new Event('auth-change'));
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-split">
        {/* Left Side: Visual/Branding */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="login-visual glass-card"
        >
          <div className="visual-content">
            <div className="brand-badge">Kite Premium</div>
            <h2>Elevate your <br /><span className="glow-text">Scheduling Flow.</span></h2>
            <div className="feature-list">
              <div className="f-item"><CheckCircle2 size={18} /> <span>Smart Availability Detection</span></div>
              <div className="f-item"><CheckCircle2 size={18} /> <span>One-click Calendar Sync</span></div>
              <div className="f-item"><CheckCircle2 size={18} /> <span>Enterprise-grade Security</span></div>
            </div>
          </div>
          <div className="visual-bg-glow" />
        </motion.div>

        {/* Right Side: Form */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="login-card-container"
        >
          <div className="login-card glass-card">
            <div className="login-header">
              <img src="/kite-logo.png" alt="Kite" style={{ height: '80px', margin: '0 auto 1.5rem', display: 'block', objectFit: 'contain' }} />
              <GradientText colors={["#0ea5e9", "#6366f1", "#2dd4bf", "#0ea5e9"]} animationSpeed={3}>
                <h1 className="login-title">{isRegistering ? 'Create Account' : 'Sign In'}</h1>
              </GradientText>
              <p className="login-subtitle">
                {isRegistering ? 'Join Kite and simplify scheduling' : 'Access your Kite dashboard'}
              </p>
            </div>

            <form className="login-form" onSubmit={handleAuth}>
              {error && <div className="error-message" style={{ color: '#ef4444', fontSize: '0.9rem', marginBottom: '1rem' }}>{error}</div>}
              
              {isRegistering && (
                <>
                  <div className="input-group">
                    <label><Shield size={16} /> Full Name</label>
                    <input type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
                  </div>
                  
                  <div className="input-group">
                    <label><Globe size={16} /> Country</label>
                    <select 
                      value={country} 
                      onChange={e => setCountry(e.target.value)} 
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        outline: 'none',
                        appearance: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="" disabled>Select your country</option>
                      <option value="US">United States</option>
                      <option value="GB">United Kingdom</option>
                      <option value="CA">Canada</option>
                      <option value="AU">Australia</option>
                      <option value="IN">India</option>
                      <option value="DE">Germany</option>
                      <option value="FR">France</option>
                      <option value="JP">Japan</option>
                    </select>
                  </div>
                </>
              )}

              <div className="input-group">
                <label><Mail size={16} /> Email</label>
                <input type="email" placeholder="name@kite.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              
              <div className="input-group">
                <div className="label-row">
                  <label><Lock size={16} /> Password</label>
                  {!isRegistering && <a href="#" className="forgot-link">Forgot?</a>}
                </div>
                <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>

              <button className="btn-primary login-btn" disabled={isLoading}>
                {isLoading ? 'Processing...' : <>{isRegistering ? 'Sign Up' : 'Continue'} <ArrowRight size={18} /></>}
              </button>
            </form>

            <div className="login-divider"><span>or</span></div>

            <div className="social-login">
              <button className="btn-ghost social-btn"><Globe size={18} /> Google</button>
              <button className="btn-ghost social-btn"><Shield size={18} /> SSO</button>
            </div>

            <p className="login-footer">
              {isRegistering ? 'Already have an account? ' : 'New to Kite? '}
              <Link to={isRegistering ? "/login" : "/signup"}>
                {isRegistering ? 'Sign In' : 'Get Started'}
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

      <style>{`
        .login-page {
          min-height: calc(100vh - 100px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }
        .login-split {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          width: 100%;
          max-width: 1000px;
          min-height: 600px;
        }
        .login-visual {
          position: relative;
          padding: 4rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.4);
        }
        .visual-content {
          position: relative;
          z-index: 2;
        }
        .brand-badge {
          display: inline-block;
          padding: 0.4rem 1rem;
          border-radius: 100px;
          background: var(--primary);
          color: white;
          font-size: 0.8rem;
          font-weight: 700;
          margin-bottom: 2rem;
        }
        .login-visual h2 {
          font-size: 2.5rem;
          line-height: 1.2;
          margin-bottom: 2.5rem;
        }
        .feature-list {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .f-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          font-weight: 500;
          color: var(--text-muted);
        }
        .f-item svg {
          color: #10b981;
        }
        .visual-bg-glow {
          position: absolute;
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, var(--primary-glow) 0%, transparent 70%);
          top: -50px;
          left: -50px;
          opacity: 0.5;
        }
        .login-card-container {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .login-card {
          width: 100%;
          max-width: 420px;
          padding: 3rem;
          text-align: center;
        }
        .login-header {
          margin-bottom: 2rem;
        }
        .login-logo {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1rem;
          font-weight: 800;
          color: var(--primary);
        }
        .login-title {
          font-size: 1.8rem;
        }
        .login-subtitle {
          color: var(--text-muted);
          font-size: 0.9rem;
          margin-top: 0.5rem;
        }
        .login-form {
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .label-row {
          display: flex;
          justify-content: space-between;
        }
        .input-group label {
          font-size: 0.85rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .input-group input {
          padding: 0.75rem 1rem;
          border-radius: 10px;
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text);
          transition: all 0.2s;
        }
        .input-group input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 10px var(--primary-glow);
        }
        .forgot-link {
          font-size: 0.8rem;
          color: var(--primary);
          text-decoration: none;
        }
        .login-btn {
          width: 100%;
          justify-content: center;
          margin-top: 0.5rem;
          padding: 0.8rem;
        }
        .login-divider {
          margin: 1.5rem 0;
          position: relative;
        }
        .login-divider::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: var(--border);
        }
        .login-divider span {
          background: var(--surface);
          padding: 0 0.75rem;
          color: var(--text-muted);
          font-size: 0.75rem;
          position: relative;
          z-index: 1;
        }
        .social-login {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .social-btn {
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem;
          font-size: 0.85rem;
        }
        .login-footer {
          font-size: 0.9rem;
          color: var(--text-muted);
        }
        .login-footer a {
          color: var(--primary);
          text-decoration: none;
          font-weight: 600;
        }
        @media (max-width: 850px) {
          .login-visual { display: none; }
          .login-split { grid-template-columns: 1fr; max-width: 450px; }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
