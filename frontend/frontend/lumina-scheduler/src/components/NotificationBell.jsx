import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { socketService } from '../services/socketService';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // ── Fetch persisted notifications from the dedicated endpoint ──
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      if (res.success && res.data?.notifications) {
        setNotifications(res.data.notifications);
      }
    } catch (e) {
      // Fallback: try /auth/me if /notifications fails
      if (!e.isCancelled) {
        try {
          const meRes = await api.get('/auth/me');
          if (meRes.success && meRes.data?.user) {
            setNotifications(meRes.data.user.notifications || []);
          }
        } catch (fallbackErr) {
          if (!fallbackErr.isCancelled) {
            console.error("Failed to fetch notifications", fallbackErr);
          }
        }
      }
    }
  }, []);

  useEffect(() => {
    // Initial fetch on mount
    fetchNotifications();

    // Listen for real-time notifications
    const handleNotification = (notif) => {
      setNotifications(prev => {
        // Deduplicate: if a notification with the same message + meeting
        // already exists and was added within the last 5 seconds, skip
        const isDupe = prev.some(n =>
          n.message === notif.message &&
          n.relatedMeeting === notif.relatedMeeting &&
          Math.abs(new Date(n.createdAt) - new Date(notif.createdAt)) < 5000
        );
        if (isDupe) return prev;
        return [{ ...notif, read: false, createdAt: notif.createdAt || new Date() }, ...prev];
      });
    };

    // Re-fetch when dashboard updates (meeting created/cancelled/updated)
    const handleDashboardUpdate = () => {
      fetchNotifications();
    };

    socketService.on('notification', handleNotification);
    socketService.on('dashboard:update', handleDashboardUpdate);

    // Re-fetch when window regains focus (user comes back from another tab)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Re-fetch when auth state changes (user logs in)
    const handleAuthChange = () => {
      const token = localStorage.getItem('token');
      if (token) {
        // Small delay to ensure token is set before fetching
        setTimeout(fetchNotifications, 500);
      } else {
        setNotifications([]);
      }
    };
    window.addEventListener('auth-change', handleAuthChange);

    // Close dropdown on click outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      socketService.off('notification', handleNotification);
      socketService.off('dashboard:update', handleDashboardUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('auth-change', handleAuthChange);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [fetchNotifications]);

  const markAsRead = async (id) => {
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    try {
      await api.put(`/notifications/${id}/read`);
    } catch (e) {
      console.error('Failed to mark notification as read', e);
    }
  };

  const clearAll = async () => {
    setNotifications([]);
    try {
      await api.delete('/notifications');
    } catch (e) {
      console.error('Failed to clear notifications', e);
    }
  };

  return (
    <div className="notif-bell-wrap" ref={dropdownRef}>
      <button className="bell-btn" onClick={() => setShowDropdown(!showDropdown)}>
        <Bell size={20} />
        {unreadCount > 0 && (
          <motion.span 
            className="unread-badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div 
            className="notif-dropdown glass-card"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
          >
            <div className="notif-header">
              <h3>Notifications</h3>
              <div className="notif-actions">
                <button onClick={clearAll} title="Clear all"><Trash2 size={14} /></button>
                <button onClick={() => setShowDropdown(false)}><X size={14} /></button>
              </div>
            </div>

            <div className="notif-list">
              {notifications.length > 0 ? (
                notifications.map((n, i) => (
                  <div key={n._id || i} className={`notif-item ${n.read ? 'read' : ''}`}>
                    <div className="notif-dot" />
                    <div className="notif-content">
                      <p>{n.message}</p>
                      <span className="notif-time">{new Date(n.createdAt).toLocaleString()}</span>
                    </div>
                    {!n.read && (
                      <button className="mark-read-btn" onClick={() => markAsRead(n._id)}>
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="notif-empty">
                  <Bell size={32} opacity={0.2} />
                  <p>No notifications yet</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .notif-bell-wrap { position: relative; }
        .bell-btn { background: none; border: none; color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; transition: background 0.2s; }
        .bell-btn:hover { background: rgba(255,255,255,0.05); }
        .unread-badge { position: absolute; top: 6px; right: 6px; background: #ef4444; color: white; font-size: 0.65rem; font-weight: 800; min-width: 16px; height: 16px; border-radius: 10px; display: flex; align-items: center; justify-content: center; border: 2px solid var(--background); padding: 0 2px; }
        
        .notif-dropdown { position: absolute; top: 50px; right: 0; width: 320px; max-height: 400px; z-index: 1000; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 40px rgba(0,0,0,0.4); border: 1px solid var(--glass-border); }
        .notif-header { padding: 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); }
        .notif-header h3 { font-size: 0.95rem; font-weight: 700; margin: 0; }
        .notif-actions { display: flex; gap: 0.5rem; }
        .notif-actions button { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 4px; }
        .notif-actions button:hover { color: var(--text); background: rgba(255,255,255,0.05); }

        .notif-list { overflow-y: auto; flex: 1; }
        .notif-item { padding: 1rem; display: flex; gap: 0.75rem; border-bottom: 1px solid var(--border); transition: background 0.2s; position: relative; }
        .notif-item:hover { background: rgba(255,255,255,0.03); }
        .notif-item.read { opacity: 0.6; }
        .notif-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); margin-top: 5px; flex-shrink: 0; }
        .notif-item.read .notif-dot { background: var(--text-muted); }
        .notif-content { flex: 1; }
        .notif-content p { font-size: 0.85rem; line-height: 1.4; margin: 0 0 0.25rem 0; color: var(--text); }
        .notif-time { font-size: 0.7rem; color: var(--text-muted); }
        .mark-read-btn { opacity: 0; position: absolute; right: 10px; top: 10px; background: var(--primary); color: white; border: none; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; transition: opacity 0.2s; }
        .notif-item:hover .mark-read-btn { opacity: 1; }
        
        .notif-empty { padding: 3rem 1rem; text-align: center; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        .notif-empty p { font-size: 0.9rem; margin: 0; }
      `}</style>
    </div>
  );
};

export default NotificationBell;
