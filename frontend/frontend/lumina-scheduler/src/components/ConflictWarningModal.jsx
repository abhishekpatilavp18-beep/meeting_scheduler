import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, ChevronRight, User, Calendar, Clock, ShieldAlert, Shield } from 'lucide-react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const ConflictWarningModal = ({ isOpen, onClose, conflicts, slot, onConfirm, deviceTimezone }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="conflict-modal glass-card"
          >
            {/* Animated warning glow strip */}
            <div className="modal-glow-strip" />

            <div className="modal-header">
              <div className="warning-icon-bg">
                <ShieldAlert size={24} className="warning-icon" />
              </div>
              <div className="header-text">
                <h3>Scheduling Conflict Detected</h3>
                <p>Some priority participants are unavailable during this time. Continue anyway?</p>
              </div>
              <button className="close-btn" onClick={onClose} aria-label="Close modal">
                <X size={20} />
              </button>
            </div>

            <div className="modal-content">
              {/* Time Slot Preview */}
              <div className="slot-preview">
                <div className="preview-item">
                  <Calendar size={16} />
                  <span>{dayjs(slot?.startTime).format('MMMM D, YYYY')}</span>
                </div>
                <div className="preview-item">
                  <Clock size={16} />
                  <span>
                    {dayjs(slot?.startTime).tz(deviceTimezone).format('hh:mm A')} – {dayjs(slot?.endTime).tz(deviceTimezone).format('hh:mm A')}
                  </span>
                </div>
              </div>

              {/* Conflict Explanation */}
              <div className="conflict-explanation">
                <div className="explanation-icon-row">
                  <AlertTriangle size={16} color="#f97316" />
                  <span>Priority participants have existing commitments or are outside their working hours during this window.</span>
                </div>
              </div>

              {/* Unavailable Members List */}
              <div className="unavailable-list">
                <label className="list-label">Unavailable Priority Members</label>
                <div className="members-grid">
                  {conflicts?.map((member) => (
                    <motion.div 
                      key={member.id} 
                      className="member-conflict-tag"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <div className="member-avatar-sm">
                        <User size={12} />
                      </div>
                      <span>{member.name}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Override Notice */}
              <div className="override-notice">
                <Shield size={14} />
                <span>As an authorized user, you can override this conflict. Affected members will receive an <strong>urgent notification</strong> about this meeting.</span>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary modal-btn" onClick={onClose} id="conflict-choose-different">
                Choose Different Slot
              </button>
              <button className="btn-primary override-btn modal-btn" onClick={onConfirm} id="conflict-continue-scheduling">
                Continue Scheduling <ChevronRight size={18} />
              </button>
            </div>
          </motion.div>

          <style dangerouslySetInnerHTML={{ __html: `
            .modal-overlay {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(2, 6, 23, 0.88);
              backdrop-filter: blur(12px);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 9999;
              padding: 2rem;
            }
            .conflict-modal {
              width: 100%;
              max-width: 520px;
              background: rgba(15, 23, 42, 0.95);
              border: 1px solid rgba(249, 115, 22, 0.25);
              box-shadow: 
                0 25px 60px -15px rgba(0, 0, 0, 0.6), 
                0 0 50px rgba(249, 115, 22, 0.08),
                inset 0 1px 0 rgba(255, 255, 255, 0.05);
              padding: 0;
              overflow: hidden;
              position: relative;
            }
            
            /* Animated glow strip at top */
            .modal-glow-strip {
              height: 3px;
              background: linear-gradient(90deg, #f97316, #fb923c, #f97316, #ea580c, #f97316);
              background-size: 300% 100%;
              animation: glowSlide 3s ease-in-out infinite;
            }
            @keyframes glowSlide {
              0%, 100% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
            }
            
            .modal-header {
              padding: 1.5rem 2rem;
              display: flex;
              align-items: flex-start;
              gap: 1.25rem;
              border-bottom: 1px solid rgba(255, 255, 255, 0.06);
              position: relative;
            }
            .warning-icon-bg {
              width: 48px;
              height: 48px;
              min-width: 48px;
              background: rgba(249, 115, 22, 0.12);
              border: 1px solid rgba(249, 115, 22, 0.2);
              border-radius: 14px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .warning-icon {
              color: #f97316;
              filter: drop-shadow(0 0 8px rgba(249, 115, 22, 0.4));
            }
            .header-text { flex: 1; padding-right: 2rem; }
            .header-text h3 {
              margin: 0;
              font-size: 1.15rem;
              font-weight: 700;
              color: white;
              letter-spacing: -0.01em;
            }
            .header-text p {
              margin: 0.4rem 0 0;
              font-size: 0.82rem;
              color: var(--text-muted);
              line-height: 1.4;
            }
            .close-btn {
              position: absolute;
              top: 1.25rem;
              right: 1.5rem;
              background: rgba(255, 255, 255, 0.05);
              border: 1px solid rgba(255, 255, 255, 0.08);
              border-radius: 8px;
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: var(--text-muted);
              cursor: pointer;
              transition: all 0.2s;
            }
            .close-btn:hover { 
              color: white; 
              background: rgba(255, 255, 255, 0.1);
              border-color: rgba(255, 255, 255, 0.15);
            }
            
            .modal-content {
              padding: 1.75rem 2rem;
              display: flex;
              flex-direction: column;
              gap: 1.25rem;
            }
            .slot-preview {
              display: flex;
              gap: 1.5rem;
              padding: 0.85rem 1rem;
              background: rgba(255, 255, 255, 0.03);
              border-radius: 10px;
              border: 1px solid rgba(255, 255, 255, 0.06);
            }
            .preview-item {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              font-size: 0.85rem;
              font-weight: 600;
              color: var(--text);
            }
            .preview-item svg { color: var(--primary); flex-shrink: 0; }
            
            .conflict-explanation {
              font-size: 0.88rem;
              line-height: 1.6;
              color: var(--text-muted);
            }
            .explanation-icon-row {
              display: flex;
              align-items: flex-start;
              gap: 0.6rem;
            }
            .explanation-icon-row svg { flex-shrink: 0; margin-top: 2px; }
            
            .unavailable-list {
              display: flex;
              flex-direction: column;
              gap: 0.6rem;
            }
            .list-label {
              font-size: 0.7rem;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: #f97316;
            }
            .members-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 0.5rem;
            }
            .member-conflict-tag {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              padding: 0.4rem 0.7rem;
              background: rgba(249, 115, 22, 0.08);
              border: 1px solid rgba(249, 115, 22, 0.18);
              border-radius: 8px;
              font-size: 0.82rem;
              font-weight: 600;
              color: #fb923c;
              transition: all 0.2s;
            }
            .member-conflict-tag:hover {
              background: rgba(249, 115, 22, 0.14);
              border-color: rgba(249, 115, 22, 0.3);
            }
            .member-avatar-sm {
              width: 22px;
              height: 22px;
              border-radius: 6px;
              background: rgba(249, 115, 22, 0.15);
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }
            .member-avatar-sm svg { color: #f97316; }
            
            .override-notice {
              display: flex;
              align-items: flex-start;
              gap: 0.5rem;
              padding: 0.75rem 1rem;
              border-radius: 8px;
              background: rgba(59, 130, 246, 0.06);
              border: 1px solid rgba(59, 130, 246, 0.12);
              font-size: 0.78rem;
              color: rgba(148, 163, 184, 0.9);
              line-height: 1.5;
            }
            .override-notice svg { color: var(--primary); flex-shrink: 0; margin-top: 1px; }
            .override-notice strong { color: #f97316; font-weight: 600; }
            
            .modal-footer {
              padding: 1.25rem 2rem;
              background: rgba(0, 0, 0, 0.25);
              border-top: 1px solid rgba(255, 255, 255, 0.04);
              display: flex;
              gap: 0.75rem;
            }
            .modal-btn { 
              flex: 1; 
              height: 46px; 
              font-weight: 600; 
              font-size: 0.9rem;
              border-radius: 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 0.4rem;
              transition: all 0.25s;
            }
            .override-btn {
              background: linear-gradient(135deg, #f97316, #ea580c) !important;
              box-shadow: 0 4px 18px rgba(249, 115, 22, 0.3) !important;
              border: none !important;
              color: white !important;
            }
            .override-btn:hover {
              box-shadow: 0 6px 24px rgba(249, 115, 22, 0.45) !important;
              transform: translateY(-1px);
            }
          `}} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConflictWarningModal;
