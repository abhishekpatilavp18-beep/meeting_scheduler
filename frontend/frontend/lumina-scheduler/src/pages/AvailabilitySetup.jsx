import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Save, Globe, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

// ── Default template (used ONLY when user has never saved) ────
const DEFAULT_DAYS = [
  { name: 'Monday', active: true, slots: [{ from: '09:00', to: '17:00' }] },
  { name: 'Tuesday', active: true, slots: [{ from: '09:00', to: '17:00' }] },
  { name: 'Wednesday', active: true, slots: [{ from: '09:00', to: '17:00' }] },
  { name: 'Thursday', active: true, slots: [{ from: '09:00', to: '17:00' }] },
  { name: 'Friday', active: true, slots: [{ from: '09:00', to: '17:00' }] },
  { name: 'Saturday', active: false, slots: [] },
  { name: 'Sunday', active: false, slots: [] },
];

const AvailabilitySetup = () => {
  const { user } = useAuth();

  // ── Core state ──────────────────────────────────────────────
  const [days, setDays] = useState(null);        // null = not yet hydrated
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);       // { type: 'success'|'error', message }
  const toastTimer = useRef(null);

  // ── Toast helper ────────────────────────────────────────────
  const showToast = useCallback((type, message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  // ── Hydration: Fetch fresh user data on mount ───────────────
  // We fetch from /auth/me directly instead of relying on
  // potentially stale localStorage data. This is the single
  // source of truth for the availability configuration.
  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      setIsLoading(true);
      try {
        const res = await api.get('/auth/me');
        if (cancelled) return;

        const freshUser = res?.data?.user;
        if (freshUser?.availabilityConfig && Array.isArray(freshUser.availabilityConfig)) {
          setDays(freshUser.availabilityConfig);
        } else {
          setDays(DEFAULT_DAYS.map(d => ({ ...d, slots: d.slots.map(s => ({ ...s })) })));
        }

        // Sync localStorage with fresh data
        if (freshUser) {
          localStorage.setItem('user', JSON.stringify(freshUser));
          window.dispatchEvent(new Event('auth-change'));
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch user availability:', err);
        // Fallback: try localStorage user
        if (user?.availabilityConfig && Array.isArray(user.availabilityConfig)) {
          setDays(user.availabilityConfig);
        } else {
          setDays(DEFAULT_DAYS.map(d => ({ ...d, slots: d.slots.map(s => ({ ...s })) })));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    hydrate();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Immutable state helpers ─────────────────────────────────
  const toggleDay = (index) => {
    setDays(prev => prev.map((day, i) => {
      if (i !== index) return day;
      const nowActive = !day.active;
      return {
        ...day,
        active: nowActive,
        slots: nowActive && day.slots.length === 0
          ? [{ from: '09:00', to: '17:00' }]
          : [...day.slots],
      };
    }));
  };

  const addSlot = (index) => {
    setDays(prev => prev.map((day, i) =>
      i !== index ? day : { ...day, slots: [...day.slots, { from: '09:00', to: '17:00' }] }
    ));
  };

  const removeSlot = (dayIndex, slotIndex) => {
    setDays(prev => prev.map((day, i) =>
      i !== dayIndex ? day : { ...day, slots: day.slots.filter((_, si) => si !== slotIndex) }
    ));
  };

  const updateSlotTime = (dayIndex, slotIndex, field, value) => {
    setDays(prev => prev.map((day, i) =>
      i !== dayIndex ? day : {
        ...day,
        slots: day.slots.map((slot, si) =>
          si !== slotIndex ? slot : { ...slot, [field]: value }
        ),
      }
    ));
  };

  // ── Save handler ────────────────────────────────────────────
  const saveSettings = async () => {
    if (isSaving || !days) return;
    setIsSaving(true);

    try {
      // ── Step 1: Save the configuration template to user profile ──
      // This is the CRITICAL persistence step. Even if slot generation
      // fails, the user's schedule template is permanently saved.
      const profileRes = await api.put('/auth/profile', { availabilityConfig: days });
      if (profileRes.success && profileRes.data?.user) {
        localStorage.setItem('user', JSON.stringify(profileRes.data.user));
        window.dispatchEvent(new Event('auth-change'));
      }

      // ── Step 2: Generate 30-minute time slots for the next 4 weeks ──
      const generatedSlots = [];
      const now = new Date();

      for (let i = 0; i < 28; i++) {
        const currentDate = new Date(now);
        currentDate.setDate(now.getDate() + i);

        // getDay(): 0=Sun, 1=Mon ... 6=Sat → our index: 0=Mon, 6=Sun
        let dayIndex = currentDate.getDay() - 1;
        if (dayIndex === -1) dayIndex = 6;

        const dayConfig = days[dayIndex];
        if (!dayConfig?.active) continue;

        for (const slot of dayConfig.slots) {
          if (!slot.from || !slot.to) continue;

          const [startHour, startMin] = slot.from.split(':').map(Number);
          const [endHour, endMin] = slot.to.split(':').map(Number);

          const start = new Date(currentDate);
          start.setHours(startHour, startMin, 0, 0);

          const end = new Date(currentDate);
          end.setHours(endHour, endMin, 0, 0);

          // Validate: end must be after start
          if (end <= start) continue;

          let currentSlotStart = new Date(start);
          while (currentSlotStart < end) {
            const currentSlotEnd = new Date(currentSlotStart);
            currentSlotEnd.setMinutes(currentSlotEnd.getMinutes() + 30);

            if (currentSlotEnd <= end && currentSlotStart > now) {
              generatedSlots.push({
                startTime: currentSlotStart.toISOString(),
                endTime: currentSlotEnd.toISOString(),
              });
            }
            currentSlotStart = currentSlotEnd;
          }
        }
      }

      // ── Step 3: Send slots to backend ──
      if (generatedSlots.length > 0) {
        const maxSlots = 200;
        const slotsToSend = generatedSlots.slice(0, maxSlots);

        try {
          await api.post('/slots/bulk', { slots: slotsToSend, clearExisting: true });
          showToast('success', `Availability saved! ${slotsToSend.length} slots are now live.`);
        } catch (slotErr) {
          // Profile was already saved — inform about partial success
          console.error('Slot generation had issues:', slotErr);
          showToast('success', `Schedule template saved. Some slots could not be generated — they'll sync on next save.`);
        }
      } else {
        showToast('success', 'Schedule template saved. No future slots to generate right now.');
      }
    } catch (error) {
      console.error('Save failed:', error);
      showToast('error', error.message || 'Failed to save availability');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Loading state ───────────────────────────────────────────
  if (isLoading || !days) {
    return (
      <div className="availability-page">
        <header className="page-header">
          <h1 className="page-title">Availability Settings</h1>
          <p className="page-subtitle">Loading your schedule...</p>
        </header>
        <div className="availability-container glass-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem' }}>
          <Loader2 size={32} className="spin" style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="availability-page">
      <header className="page-header">
        <h1 className="page-title">Availability Settings</h1>
        <p className="page-subtitle">Configure your default working hours and time zone.</p>
      </header>

      {/* ── Toast notifications ──────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`availability-toast ${toast.type}`}
          >
            {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="availability-container glass-card">
        <div className="settings-header">
          <div className="timezone-setting">
            <Globe size={18} />
            <span>{user?.timezone || 'UTC'}</span>
          </div>
          <button className="btn-primary" onClick={saveSettings} disabled={isSaving}>
            {isSaving ? <Loader2 size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={18} />}
            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>

        <div className="days-list">
          {days.map((day, i) => (
            <div key={day.name} className={`day-row ${day.active ? 'active' : ''}`}>
              <div className="day-info">
                <div className={`checkbox ${day.active ? 'checked' : ''}`} onClick={() => toggleDay(i)}>
                  {day.active && <div className="check-mark" />}
                </div>
                <span className="day-name">{day.name}</span>
              </div>
              
              <div className="slots-container">
                {day.active ? (
                    day.slots.map((slot, si) => (
                      <div key={si} className="time-slot-row">
                        <input 
                          type="time" 
                          value={slot.from} 
                          onChange={(e) => updateSlotTime(i, si, 'from', e.target.value)}
                          className="time-input glass-card" 
                        />
                        <span>-</span>
                        <input 
                          type="time" 
                          value={slot.to} 
                          onChange={(e) => updateSlotTime(i, si, 'to', e.target.value)}
                          className="time-input glass-card" 
                        />
                        <button className="btn-icon-danger" onClick={() => removeSlot(i, si)}><Trash2 size={16} /></button>
                      </div>
                    ))
                ) : (
                  <span className="unavailable">Unavailable</span>
                )}
              </div>

              {day.active && (
                <button className="btn-icon-plus" onClick={() => addSlot(i)}>
                  <Plus size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .availability-page {
          padding-bottom: 4rem;
        }
        .availability-toast {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          margin-bottom: 1.5rem;
          font-weight: 500;
          font-size: 0.95rem;
          backdrop-filter: blur(12px);
        }
        .availability-toast.success {
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #22c55e;
        }
        .availability-toast.error {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }
        .availability-container {
          padding: 2rem;
          text-align: left;
        }
        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 2rem;
          border-bottom: 1px solid var(--border);
          margin-bottom: 1rem;
        }
        .timezone-setting {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: var(--text-muted);
        }
        .day-row {
          display: grid;
          grid-template-columns: 150px 1fr 50px;
          align-items: center;
          padding: 1.5rem 0;
          border-bottom: 1px solid var(--border);
        }
        .day-row.active {
          background: var(--surface);
        }
        .day-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .checkbox {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: 2px solid var(--border);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .checkbox.checked {
          background: var(--primary);
          border-color: var(--primary);
          box-shadow: 0 0 10px var(--primary-glow);
        }
        .check-mark {
          width: 10px;
          height: 6px;
          border-left: 2px solid white;
          border-bottom: 2px solid white;
          transform: rotate(-45deg);
          margin-bottom: 2px;
        }
        .day-name {
          font-weight: 600;
          font-size: 1.1rem;
        }
        .slots-container {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .time-slot-row {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .time-input {
          padding: 0.5rem 1rem;
          border-radius: 8px;
          color: var(--text);
          font-weight: 500;
          border: 1px solid var(--border);
          background: var(--glass);
        }
        .unavailable {
          color: var(--text-muted);
          font-style: italic;
        }
        .btn-icon-plus {
          background: none;
          border: none;
          color: var(--primary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .btn-icon-danger {
          background: none;
          border: none;
          color: #ef4444;
          cursor: pointer;
          opacity: 0.6;
          transition: opacity 0.2s;
        }
        .btn-icon-danger:hover {
          opacity: 1;
        }
      `}</style>
    </div>
  );
};

export default AvailabilitySetup;
