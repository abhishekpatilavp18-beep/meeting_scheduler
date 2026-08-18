import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Globe, Clock, Shield, Lock, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

dayjs.extend(utc);
dayjs.extend(timezone);

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [user, setUser] = useState(authUser);
  const [loading, setLoading] = useState(!authUser);
  const [currentTime, setCurrentTime] = useState('');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editData, setEditData] = useState({ 
    country: authUser?.country || '', 
    timezone: authUser?.timezone || 'UTC' 
  });

  useEffect(() => {
    if (authUser) {
      setUser(authUser);
      setEditData({ 
        country: authUser.country || '', 
        timezone: authUser.timezone || 'UTC' 
      });
      setLoading(false);
    }
  }, [authUser]);

  const handleUpdateProfile = async () => {
    try {
      const res = await api.put('/auth/profile', editData);
      if (res.success) {
        // Use the authoritative server response to avoid stripping fields
        const updatedUser = res.data?.user || { ...user, ...editData };
        setUser(updatedUser);
        
        // Update global storage so Navbar/other pages refresh
        localStorage.setItem('user', JSON.stringify(updatedUser));
        window.dispatchEvent(new Event('auth-change'));
        
        setIsEditingProfile(false);
        setSuccessMsg("Profile information updated!");
      }
    } catch (err) {
      setErrorMsg("Failed to update profile info");
    }
  };

  // Live clock for user's country/timezone
  useEffect(() => {
    const tz = user?.timezone || 'UTC';

    const updateTime = () => {
      const formatted = dayjs().tz(tz).format("dddd, MMMM D, YYYY — hh:mm:ss A");
      setCurrentTime(formatted);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [user?.timezone]);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg("Password must be at least 8 characters");
      return;
    }

    setIsUpdating(true);
    try {
      const res = await api.put('/auth/profile', { password: newPassword });
      if (res.success) {
        setSuccessMsg("Password updated successfully!");
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to update password");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return <div className="loading-screen">Loading your profile...</div>;

  return (
    <div className="profile-page">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="profile-container"
      >
        <button className="btn-text back-btn" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={18} /> Back to Dashboard
        </button>

        <div className="profile-grid">
          {/* Left: User Info */}
          <div className="profile-sidebar">
            <div className="profile-card glass-card">
              <div className="user-avatar-large">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <h1 className="user-name">{user?.name || 'User'}</h1>
              <p className="user-role">{user?.role === 'admin' ? 'Organization Admin' : 'Meeting Host'}</p>
              
              <div className="user-details-list">
                <div className="detail-item">
                  <Mail size={18} />
                  <span>{user?.email}</span>
                </div>
                
                {isEditingProfile ? (
                  <div className="edit-form-mini">
                    <div className="form-group-mini">
                      <label>Country</label>
                      <input 
                        className="glass-card"
                        value={editData.country}
                        onChange={(e) => setEditData(prev => ({ ...prev, country: e.target.value }))}
                      />
                    </div>
                    <div className="form-group-mini">
                      <label>Timezone</label>
                      <select 
                        className="glass-card"
                        value={editData.timezone}
                        onChange={(e) => setEditData(prev => ({ ...prev, timezone: e.target.value }))}
                      >
                        <option value="Asia/Kolkata">India (IST)</option>
                        <option value="America/New_York">USA (EST)</option>
                        <option value="Europe/London">UK (GMT)</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                      <button className="btn-primary btn-sm" onClick={handleUpdateProfile}>Save</button>
                      <button className="btn-secondary btn-sm" onClick={() => setIsEditingProfile(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="detail-item">
                      <Globe size={18} />
                      <span>{user?.country || 'Not specified'}</span>
                    </div>
                    <div className="detail-item">
                      <Clock size={18} />
                      <span>{user?.timezone || 'UTC'}</span>
                    </div>
                    <button className="btn-text edit-profile-btn" onClick={() => setIsEditingProfile(true)}>
                      Edit Location Info
                    </button>
                  </>
                )}
              </div>

              <div className="live-clock-card glass-card">
                <div className="clock-header">
                  <Shield size={14} />
                  <span>Live Time in {user?.country || 'Your Zone'}</span>
                </div>
                <div className="clock-value">{currentTime}</div>
              </div>
            </div>
          </div>

          {/* Right: Settings */}
          <div className="profile-main">
            <div className="settings-card glass-card">
              <div className="settings-header">
                <Lock size={20} />
                <h2>Security Settings</h2>
              </div>
              <p className="settings-desc">Keep your account secure by updating your password regularly.</p>

              <form className="password-form" onSubmit={handleUpdatePassword}>
                <div className="form-group">
                  <label>New Password</label>
                  <input 
                    type="password" 
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="glass-card"
                  />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input 
                    type="password" 
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="glass-card"
                  />
                </div>

                {errorMsg && <div className="error-box">{errorMsg}</div>}
                {successMsg && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="success-box">
                    <CheckCircle2 size={18} /> {successMsg}
                  </motion.div>
                )}

                <button className="btn-primary update-btn" disabled={isUpdating}>
                  {isUpdating ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </motion.div>

      <style>{`
        .profile-page {
          min-height: calc(100vh - 80px);
          padding: 3rem 2rem;
          background: radial-gradient(circle at top right, rgba(59, 130, 246, 0.05), transparent 40%);
        }
        .profile-container {
          max-width: 1200px;
          margin: 0 auto;
        }
        .back-btn { margin-bottom: 2rem; padding-left: 0; }
        
        .profile-grid {
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 2.5rem;
        }
        
        .profile-card {
          padding: 3rem 2rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .user-avatar-large {
          width: 100px;
          height: 100px;
          border-radius: 30px;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.5rem;
          font-weight: 800;
          color: white;
          margin-bottom: 1.5rem;
          box-shadow: 0 20px 40px var(--primary-glow);
        }
        .user-name { font-size: 1.75rem; font-weight: 800; margin-bottom: 0.5rem; }
        .user-role { font-size: 0.9rem; color: var(--primary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2.5rem; }
        
        .user-details-list { width: 100%; display: flex; flex-direction: column; gap: 1.25rem; margin-bottom: 2.5rem; text-align: left; }
        .detail-item { display: flex; align-items: center; gap: 1rem; color: var(--text-muted); font-weight: 600; font-size: 0.95rem; }
        
        .live-clock-card { width: 100%; padding: 1.5rem; background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.2); }
        .clock-header { display: flex; align-items: center; gap: 0.5rem; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: var(--primary); margin-bottom: 0.5rem; }
        .clock-value { font-family: 'JetBrains Mono', monospace; font-size: 1rem; font-weight: 700; color: white; }
        
        .settings-card { padding: 3rem; }
        .settings-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
        .settings-header h2 { font-size: 1.5rem; font-weight: 800; }
        .settings-desc { color: var(--text-muted); margin-bottom: 2.5rem; }
        
        .password-form { display: flex; flex-direction: column; gap: 1.5rem; max-width: 500px; }
        .form-group { display: flex; flex-direction: column; gap: 0.75rem; }
        .form-group label { font-size: 0.9rem; font-weight: 700; color: var(--text-muted); }
        .form-group input { padding: 1rem; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); color: white; outline: none; }
        .form-group input:focus { border-color: var(--primary); }
        
        .update-btn { margin-top: 1rem; padding: 1rem; font-weight: 700; }
        .success-box { padding: 1rem; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); color: #10b981; border-radius: 12px; font-weight: 600; display: flex; align-items: center; gap: 0.75rem; }
        .error-box { padding: 1rem; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; border-radius: 12px; font-weight: 600; }
        
        .edit-form-mini { width: 100%; display: flex; flex-direction: column; gap: 1rem; margin-top: 0.5rem; text-align: left; background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 12px; }
        .form-group-mini { display: flex; flex-direction: column; gap: 0.4rem; }
        .form-group-mini label { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); }
        .form-group-mini input, .form-group-mini select { padding: 0.6rem; font-size: 0.85rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: white; outline: none; }
        .btn-sm { padding: 0.4rem 0.8rem; font-size: 0.75rem; border-radius: 6px; }
        .edit-profile-btn { margin-top: 1rem; font-size: 0.8rem; font-weight: 700; color: var(--primary); text-transform: none; padding: 0; }
        
        .loading-screen { height: 100vh; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-weight: 700; }
        
        @media (max-width: 900px) {
          .profile-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default ProfilePage;
