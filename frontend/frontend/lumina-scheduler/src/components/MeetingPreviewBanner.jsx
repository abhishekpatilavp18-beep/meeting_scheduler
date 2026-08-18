import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Clock, Calendar, Users, AlignLeft, Globe, Video, Building2 } from 'lucide-react';
import dayjs from 'dayjs';
import api from '../services/api';

const MeetingPreviewBanner = ({ meetingId, isOpen, onClose, onJoin }) => {
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && meetingId) {
      const fetchMeetingDetails = async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await api.get(`/meetings/${meetingId}`);
          if (res.success) {
            setMeeting(res.data.meeting);
          } else {
            setError(res.message || 'Failed to fetch meeting details');
          }
        } catch (err) {
          setError(err.message || 'An error occurred while fetching meeting details');
        } finally {
          setLoading(false);
        }
      };
      fetchMeetingDetails();
    }
  }, [isOpen, meetingId]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="preview-overlay">
        <motion.div 
          className="preview-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        
        <motion.div 
          className="preview-banner glass-card"
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>

          {loading ? (
            <div className="preview-loading">
              <div className="spinner"></div>
              <p>Fetching meeting details...</p>
            </div>
          ) : error ? (
            <div className="preview-error">
              <p>{error}</p>
              <button className="btn-secondary" onClick={onClose}>Close</button>
            </div>
          ) : meeting ? (
            <>
              <div className="preview-header">
                <div className="host-section">
                  <div className="host-avatar">
                    {meeting.organizer?.profileImage ? (
                      <img src={meeting.organizer.profileImage} alt={meeting.organizer.name} />
                    ) : (
                      <User size={24} />
                    )}
                  </div>
                  <div className="host-info">
                    <span className="host-label">Hosted by</span>
                    <h3 className="host-name">{meeting.organizer?.name || 'Meeting Host'}</h3>
                    {meeting.organization && (
                      <div className="host-org">
                        <Building2 size={14} style={{ color: meeting.organization.color || 'var(--primary)' }} />
                        <span>{meeting.organization.name}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="meeting-badge">
                  <Video size={14} />
                  <span>Jitsi Video</span>
                </div>
              </div>

              <div className="preview-body">
                <h2 className="meeting-title">{meeting.title || 'Untitled Meeting'}</h2>
                
                <div className="meeting-meta-grid">
                  <div className="meta-item">
                    <Calendar size={16} />
                    <span>{dayjs(meeting.startTime).format('MMMM D, YYYY')}</span>
                  </div>
                  <div className="meta-item">
                    <Clock size={16} />
                    <span>{dayjs(meeting.startTime).format('hh:mm A')} ({dayjs(meeting.endTime).diff(dayjs(meeting.startTime), 'minute')} min)</span>
                  </div>
                  <div className="meta-item">
                    <Users size={16} />
                    <span>{meeting.participants?.length || 0} Participants</span>
                  </div>
                  <div className="meta-item">
                    <Globe size={16} />
                    <span>{meeting.timezone || 'UTC'}</span>
                  </div>
                </div>

                {meeting.description && (
                  <div className="meeting-description">
                    <div className="desc-label">
                      <AlignLeft size={14} />
                      <span>Agenda</span>
                    </div>
                    <p>{meeting.description}</p>
                  </div>
                )}
              </div>

              <div className="preview-actions">
                <button className="btn-secondary" onClick={onClose}>
                  Maybe Later
                </button>
                <button className="btn-primary join-btn" onClick={() => onJoin(meeting.meetingLink)}>
                  Join Now
                </button>
              </div>
            </>
          ) : null}
        </motion.div>

        <style>{`
          .preview-overlay {
            position: fixed;
            inset: 0;
            z-index: 2000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
          }
          .preview-backdrop {
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(8px);
          }
          .preview-banner {
            position: relative;
            width: 100%;
            max-width: 540px;
            padding: 2.5rem;
            background: rgba(15, 15, 25, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.1);
            overflow: hidden;
          }
          .close-btn {
            position: absolute;
            top: 1.25rem;
            right: 1.25rem;
            background: rgba(255, 255, 255, 0.05);
            border: none;
            color: var(--text-muted);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
          }
          .close-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            color: white;
            transform: rotate(90deg);
          }
          .preview-loading, .preview-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 3rem 0;
            gap: 1.5rem;
            text-align: center;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(59, 130, 246, 0.2);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .preview-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 2rem;
          }
          .host-section {
            display: flex;
            align-items: center;
            gap: 1rem;
          }
          .host-avatar {
            width: 52px;
            height: 52px;
            border-radius: 16px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            overflow: hidden;
            border: 2px solid rgba(255, 255, 255, 0.1);
          }
          .host-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .host-info {
            display: flex;
            flex-direction: column;
          }
          .host-label {
            font-size: 0.75rem;
            color: var(--text-muted);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .host-name {
            font-size: 1.1rem;
            font-weight: 700;
            margin: 0.1rem 0;
          }
          .host-org {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            font-size: 0.85rem;
            color: var(--text-muted);
          }
          .meeting-badge {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.4rem 0.8rem;
            background: rgba(59, 130, 246, 0.1);
            color: var(--primary);
            border-radius: 100px;
            font-size: 0.75rem;
            font-weight: 700;
            border: 1px solid rgba(59, 130, 246, 0.2);
          }
          .meeting-title {
            font-size: 1.75rem;
            font-weight: 800;
            margin-bottom: 1.5rem;
            line-height: 1.2;
            background: linear-gradient(to right, #fff, rgba(255,255,255,0.7));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .meeting-meta-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1.25rem;
            margin-bottom: 2rem;
          }
          .meta-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            color: rgba(255, 255, 255, 0.7);
            font-size: 0.9rem;
            font-weight: 500;
          }
          .meta-item svg {
            color: var(--primary);
            opacity: 0.8;
          }
          .meeting-description {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 1.25rem;
            margin-bottom: 2.5rem;
          }
          .desc-label {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.75rem;
            color: var(--text-muted);
            font-weight: 700;
            text-transform: uppercase;
            margin-bottom: 0.75rem;
          }
          .meeting-description p {
            font-size: 0.95rem;
            line-height: 1.6;
            color: rgba(255, 255, 255, 0.8);
            margin: 0;
          }
          .preview-actions {
            display: flex;
            gap: 1rem;
          }
          .preview-actions button {
            flex: 1;
            padding: 1.1rem;
            font-weight: 700;
            font-size: 1rem;
            border-radius: 14px;
          }
          .join-btn {
            background: linear-gradient(135deg, #10b981, #059669);
            box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
          }
          .join-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
          }
          
          @media (max-width: 480px) {
            .meeting-meta-grid {
              grid-template-columns: 1fr;
            }
            .preview-banner {
              padding: 1.75rem;
            }
            .preview-actions {
              flex-direction: column-reverse;
            }
          }
        `}</style>
      </div>
    </AnimatePresence>
  );
};

export default MeetingPreviewBanner;
