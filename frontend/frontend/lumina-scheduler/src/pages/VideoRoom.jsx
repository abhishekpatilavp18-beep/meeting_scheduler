import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Video, ShieldAlert, Loader2 } from 'lucide-react';
import api from '../services/api';

const VideoRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [meeting, setMeeting] = useState(null);
  const [jitsiConfig, setJitsiConfig] = useState(null);

  useEffect(() => {
    const validateRoom = async () => {
      try {
        const res = await api.get(`/meetings/room/${roomId}`);
        if (res.success) {
          setMeeting(res.data.meeting);
          setJitsiConfig(res.data.jitsi);
        } else {
          setError('Failed to load meeting room.');
        }
      } catch (err) {
        if (err.isCancelled) return;
        setError(err.message || 'Room validation failed. The meeting may have ended or been cancelled.');
      } finally {
        setLoading(false);
      }
    };
    
    validateRoom();
  }, [roomId]);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <Loader2 size={40} className="spinner" />
        <p style={{ marginTop: '1rem' }}>Connecting to secure meeting room...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        <ShieldAlert size={64} color="#ef4444" style={{ marginBottom: '1.5rem' }} />
        <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#fff' }}>Access Denied</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '400px' }}>{error}</p>
        <button className="btn-primary" onClick={() => navigate('/dashboard')}>Return to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="video-room-container">
      <div className="room-header glass-card">
        <button className="btn-icon" onClick={() => navigate('/dashboard')} title="Leave Meeting">
          <ArrowLeft size={20} />
        </button>
        <div className="room-info">
          <h2 className="room-title">{meeting?.title || 'Kite Meeting'}</h2>
          <span className="room-meta">End-to-end encrypted session</span>
        </div>
        <div className="live-badge">
          <span className="live-dot" /> LIVE
        </div>
      </div>

      <div className="jitsi-container">
        {jitsiConfig && (
            <iframe
              src={`https://${jitsiConfig.domain}/${jitsiConfig.roomName}#userInfo.displayName="${encodeURIComponent(meeting?.organizer?.name || 'Guest')}"`}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        )}
      </div>

      <style>{`
        .video-room-container {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: var(--background);
          display: flex;
          flex-direction: column;
        }
        .room-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 2rem;
          border-bottom: 1px solid var(--border);
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(12px);
        }
        .room-info {
          text-align: center;
        }
        .room-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 0.25rem;
        }
        .room-meta {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .live-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          padding: 0.4rem 0.8rem;
          border-radius: 100px;
          font-weight: 700;
          font-size: 0.8rem;
          letter-spacing: 1px;
        }
        .live-dot {
          width: 8px;
          height: 8px;
          background: #ef4444;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        .jitsi-container {
          flex: 1;
          background: #000;
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
};

export default VideoRoom;
