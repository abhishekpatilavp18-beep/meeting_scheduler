import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, Globe, ArrowLeft, ArrowRight, CheckCircle2, User, Building2, AlignLeft, Info, AlertTriangle } from 'lucide-react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import api from '../services/api';
import ConflictWarningModal from '../components/ConflictWarningModal';


dayjs.extend(utc);
dayjs.extend(timezone);

const BookingPage = () => {
  const { user: username } = useParams();
  const navigate = useNavigate();
  
  // -- State --
  const [loading, setLoading] = useState(true);
  const [host, setHost] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  
  const [step, setStep] = useState(1); // 1: Date, 2: Details/Time/Org
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [description, setDescription] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [hostCurrentTime, setHostCurrentTime] = useState('');
  
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [newMeeting, setNewMeeting] = useState(null);

  const [timeOffset, setTimeOffset] = useState(0);
  const [deviceTime, setDeviceTime] = useState('');
  const [orgTime, setOrgTime] = useState('');
  
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [priorityMembers, setPriorityMembers] = useState([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [conflictWarning, setConflictWarning] = useState(null);
  const [slotConflicts, setSlotConflicts] = useState({});
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [pendingSlot, setPendingSlot] = useState(null);
  const [hasConfirmedConflict, setHasConfirmedConflict] = useState(false);


  const [viewMonth, setViewMonth] = useState(dayjs().startOf('month'));
  const selectedOrg = organizations.find(o => o._id === selectedOrgId);
  const orgTimezone = selectedOrg?.timezone || host?.timezone || "UTC";
  const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const nextMonth = () => setViewMonth(viewMonth.add(1, 'month'));
  const prevMonth = () => {
    if (viewMonth.isAfter(dayjs(), 'month')) {
      setViewMonth(viewMonth.subtract(1, 'month'));
    }
  };

  // Real-time host clock synced with API
  useEffect(() => {
    const fetchSyncedTime = async () => {
      const tz = host?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      try {
        const res = await fetch(`https://api.ipgeolocation.io/timezone?apiKey=dc7aa71928604bb895448983315e91cd&tz=${tz}`);
        const data = await res.json();
        if (data.date_time_wti) {
          const apiMoment = dayjs(data.date_time_wti);
          const localMoment = dayjs();
          setTimeOffset(apiMoment.diff(localMoment));
        }
      } catch (err) {
        console.error("Failed to sync clock with API", err);
      }
    };

    if (host) fetchSyncedTime();
  }, [host?.timezone]);

  useEffect(() => {
    const updateTime = () => {
      const syncedMoment = dayjs().add(timeOffset, 'millisecond');
      
      // Host timezone
      const hostTz = host?.timezone || deviceTimezone;
      setHostCurrentTime(syncedMoment.tz(hostTz).format('hh:mm:ss A (z)'));

      // Device timezone
      setDeviceTime(dayjs().tz(deviceTimezone).format('hh:mm:ss A (z)'));
      
      // Organization timezone
      setOrgTime(syncedMoment.tz(orgTimezone).format('hh:mm:ss A (z)'));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [host?.timezone, timeOffset, orgTimezone, deviceTimezone]);

  // Reset selected members when organization changes
  useEffect(() => {
    setSelectedMembers([]);
    setPriorityMembers([]);
    setMemberSearchQuery('');
    setConflictWarning(null);
    setSlotConflicts({});
    setHasConfirmedConflict(false);
  }, [selectedOrgId]);


  useEffect(() => {
    const checkConflicts = async () => {
      if (priorityMembers.length > 0 && availableSlots.length > 0) {
        try {
          const res = await api.post('/slots/check-conflicts', {
            slots: availableSlots,
            participants: priorityMembers
          });
          if (res.success) {
            setSlotConflicts(res.data.conflicts || {});
          }
        } catch (e) {
          console.warn("Failed to check conflicts");
        }
      } else {
        setSlotConflicts({});
      }
    };
    checkConflicts();
  }, [priorityMembers, availableSlots, host]);


  useEffect(() => {
    const fetchData = async () => {
      try {
        // Try getting user from localStorage first (avoids duplicate /auth/me that gets cancelled)
        let userData = null;
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try { userData = JSON.parse(storedUser); } catch(e) {}
        }
        
        // Fallback to API if no stored user
        if (!userData) {
          const userRes = await api.get('/auth/me');
          if (userRes.success) userData = userRes.data.user;
        }

        if (userData) {
          setHost(userData);
          try {
            const slotsRes = await api.get(`/slots/available?hostId=${userData._id}&limit=100`);
            if (slotsRes.success) {
              setAvailableSlots(slotsRes.data.slots || []);
            }
          } catch (slotErr) {
            console.warn("Failed to load slots:", slotErr.message);
          }
        }
        
        try {
          const [orgsRes, usersRes] = await Promise.all([
            api.get('/organizations'),
            api.get('/auth/users')
          ]);
          
          if (orgsRes.success) {
            setOrganizations(orgsRes.data.organizations || []);
            setSelectedOrgId('');
          }
          if (usersRes.success) {
            setAllUsers(usersRes.data.users || []);
          }
        } catch (orgErr) {
          if (!orgErr.isCancelled) {
            console.warn("Failed to load organizations/users:", orgErr.message);
          }
        }
      } catch (err) {
        console.error("Failed to load booking data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [username]);

  // Group slots by date string (YYYY-MM-DD)
  const slotsByDate = {};
  availableSlots.forEach(slot => {
    const dateKey = dayjs(slot.startTime).format('YYYY-MM-DD');
    if (!slotsByDate[dateKey]) slotsByDate[dateKey] = [];
    slotsByDate[dateKey].push(slot);
  });

  const handleBook = async (force = false) => {
    if (!selectedSlot) return;
    setIsBooking(true);
    setConflictWarning(null);
    try {
      const payload = {
        title: `Meeting with ${host.name}`,
        description: description,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        slotId: String(selectedSlot._id).startsWith('custom-') ? undefined : selectedSlot._id,
        participants: selectedMembers.map(id => ({ user: id, isPriority: priorityMembers.includes(id) })),
        timezone: orgTimezone,
        force
      };
      if (selectedOrgId) {
        payload.organization = selectedOrgId;
      }
      
      const res = await api.post('/meetings/book', payload);
      
      if (res.success) {
        setNewMeeting(res.data.meeting);
        setBookingSuccess(true);
      }
    } catch (err) {
      if (err.error === "PRIORITY_CONFLICT") {
        setConflictWarning({
          message: err.message,
          members: err.unavailableMembers || []
        });
      } else {
        alert(err.message || "Booking failed");
      }
    } finally {
      setIsBooking(false);
    }
  };

  const [blockedToast, setBlockedToast] = useState(null);

  const handleSlotClick = (slot) => {
    const conflicts = slotConflicts[slot._id];
    const isAdminOrHost = host?.role === 'admin' || host?.role === 'host';

    if (conflicts && isAdminOrHost) {
      // Admin/Host: open override confirmation modal
      setPendingSlot(slot);
      setIsConflictModalOpen(true);
    } else if (conflicts && !isAdminOrHost) {
      // Regular member: show a temporary blocked toast
      const names = conflicts.map(c => c.name).join(', ');
      setBlockedToast(`This slot is unavailable — priority participants (${names}) have conflicts. Only admins or hosts can override.`);
      setTimeout(() => setBlockedToast(null), 4000);
      return;
    } else {
      setSelectedSlot(slot);
      setHasConfirmedConflict(false);
    }
  };

  const confirmConflictOverride = () => {
    setSelectedSlot(pendingSlot);
    setHasConfirmedConflict(true);
    setIsConflictModalOpen(false);
    setPendingSlot(null);
  };


  if (loading) return <div className="loading-screen">Preparing your scheduling experience...</div>;

  return (
    <div className="booking-page">
      <div className="booking-container glass-card">
        {/* Sidebar Info */}
        <div className="booking-sidebar">
          <div className="host-info">
            <div className="host-avatar">
              <User size={32} />
            </div>
            <div>
              <span className="host-label">Scheduling with</span>
              <h2 className="host-name">{host?.name || 'Vedant'}</h2>
            </div>
          </div>

          <div className="event-details">
            <h1 className="event-title">Schedule Meeting</h1>
            <div className="detail-item">
              <Clock size={18} />
              <span>30 Minute Meeting</span>
            </div>
            
            <div className="timezone-card glass-card" style={{ padding: '1rem', marginTop: '1rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)' }}>Your Device Time</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <Globe size={14} color="var(--text-muted)" />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{deviceTime || "Loading..."}</span>
                </div>
              </div>
              
              {selectedOrg && (
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--secondary)' }}>{selectedOrg.name} Time</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <Globe size={14} color="var(--text-muted)" />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{orgTime || "Loading..."}</span>
                  </div>
                </div>
              )}
            </div>

            <p className="event-desc">
              A quick sync to discuss project updates, blockers, and next steps. 
              Please choose a time that works best for you.
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="booking-main">
          {(!host || (host.role !== 'admin' && host.role !== 'host')) ? (
            <div className="unauthorized-message glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '3rem', margin: 'auto' }}>
              <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '1.5rem' }} />
              <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Scheduling Access Restricted</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Only admins or hosts can schedule meetings.</p>
            </div>
          ) : !bookingSuccess ? (
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="step-container"
                >
                  <header className="selection-header">
                    <div className="month-display">
                      <h3 style={{ margin: 0 }}>{viewMonth.format('MMMM YYYY')}</h3>
                    </div>
                    <div className="month-nav">
                      <button 
                        className={`btn-icon ${!viewMonth.isAfter(dayjs(), 'month') ? 'disabled' : ''}`}
                        onClick={prevMonth}
                        disabled={!viewMonth.isAfter(dayjs(), 'month')}
                      >
                        <ArrowLeft size={16} />
                      </button>
                      <button className="btn-icon" onClick={nextMonth}>
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </header>
                  
                  <div className="calendar-grid">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(wd => (
                      <div key={wd} className="weekday">{wd}</div>
                    ))}
                    
                    {(() => {
                      const daysInMonth = viewMonth.daysInMonth();
                      const firstDayOfMonth = viewMonth.date(1).day(); // 0 (Sun) to 6 (Sat)
                      // Adjust to start with Monday (1)
                      const startPadding = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
                      
                      const days = [];
                      // Padding
                      for (let i = 0; i < startPadding; i++) {
                        days.push(<div key={`pad-${i}`} className="calendar-day empty" />);
                      }
                      
                      // Actual days
                      for (let d = 1; d <= daysInMonth; d++) {
                        const dateObj = viewMonth.date(d);
                        const dateKey = dateObj.format('YYYY-MM-DD');
                        const isPast = dateObj.isBefore(dayjs(), 'day');
                        const isSelected = selectedDate === dateKey;
                        
                        days.push(
                          <button 
                            key={d} 
                            disabled={isPast}
                            className={`calendar-day ${isSelected ? 'active' : ''} ${isPast ? 'disabled' : ''}`}
                            onClick={() => !isPast && setSelectedDate(dateKey)}
                          >
                            {d}
                          </button>
                        );
                      }
                      return days;
                    })()}
                  </div>

                  <button 
                    className="btn-primary confirm-btn" 
                    disabled={!selectedDate}
                    onClick={() => setStep(2)}
                  >
                    Confirm Date <ArrowRight size={18} />
                  </button>
                </motion.div>
              ) : (
                <motion.div 
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="step-container"
                >
                  <header className="selection-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
                    <button className="btn-text" onClick={() => setStep(1)} style={{ padding: 0 }}>
                      <ArrowLeft size={16} /> Back to Calendar
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <CalendarIcon size={24} className="glow-text" style={{ color: 'var(--primary)' }} />
                      <h2 style={{ fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
                        {dayjs(selectedDate).format('MMMM D, YYYY')}
                      </h2>
                    </div>
                  </header>

                  <div className="form-sections">
                    {/* Time Selection */}
                    <div className="form-section">
                      <label className="section-label"><Clock size={16} /> Meeting Time ({deviceTimezone})</label>
                      {slotsByDate[selectedDate]?.length > 0 ? (
                        <div className="slots-grid-mini">
                          {slotsByDate[selectedDate].map(slot => {
                            const conflicts = slotConflicts[slot._id];
                            const hasConflict = !!conflicts;
                            const isAdminOrHost = host?.role === 'admin' || host?.role === 'host';
                            const isBlocked = hasConflict && !isAdminOrHost;
                            return (
                              <div key={slot._id} className={`slot-wrapper ${hasConflict ? 'has-conflict' : ''}`}>
                                <button 
                                  id={`slot-${slot._id}`}
                                  className={`slot-card-mini ${selectedSlot?._id === slot._id ? 'active' : ''} ${hasConflict ? 'conflict' : ''} ${isBlocked ? 'blocked' : ''}`}
                                  onClick={() => handleSlotClick(slot)}
                                  title={hasConflict 
                                    ? `⚠ Conflict: ${conflicts.map(c => c.name).join(', ')} unavailable${isBlocked ? ' (Admin override required)' : ' (Click to override)'}` 
                                    : `Available: ${dayjs(slot.startTime).tz(deviceTimezone).format('hh:mm A')}`
                                  }
                                >
                                  <span className="slot-time-text">{dayjs(slot.startTime).tz(deviceTimezone).format('hh:mm A')}</span>
                                  {hasConflict && (
                                    <AlertTriangle size={13} className="slot-conflict-icon" />
                                  )}
                                </button>
                                {hasConflict && (
                                  <div className="conflict-badge-dot">
                                    <span>!</span>
                                  </div>
                                )}
                                {hasConflict && isAdminOrHost && (
                                  <div className="override-hint">Override</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="manual-time-input glass-card" style={{ padding: '1.5rem' }}>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            No pre-defined slots for this day. Please specify a custom time ({deviceTimezone}):
                          </p>
                          <input 
                            type="time" 
                            className="glass-card"
                            style={{ width: '100%', padding: '0.75rem', color: 'white' }}
                            onChange={(e) => {
                              // Create a dummy slot object for custom time, interpreted in device timezone
                              const [h, m] = e.target.value.split(':');
                              const start = dayjs.tz(`${selectedDate} ${h}:${m}`, 'YYYY-MM-DD HH:mm', deviceTimezone);
                              setSelectedSlot({
                                startTime: start.toISOString(),
                                endTime: start.add(30, 'minute').toISOString(),
                                _id: 'custom-' + Date.now()
                              });
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Organization Selection */}
                    <div className="form-section">
                      <label className="section-label"><Building2 size={16} /> Select Organization</label>
                      <div className="input-wrap">
                        <select 
                          value={selectedOrgId} 
                          onChange={(e) => setSelectedOrgId(e.target.value)}
                          className="glass-card"
                        >
                          <option value="">Personal Meeting (No Organization)</option>
                          {organizations.map(org => (
                            <option key={org._id} value={org._id}>{org.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Member Selection */}
                    <div className="form-section">
                      <label className="section-label"><User size={16} /> Add Team Members</label>
                      <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <input 
                          type="text" 
                          placeholder="Search members..." 
                          value={memberSearchQuery}
                          onChange={(e) => setMemberSearchQuery(e.target.value)}
                          className="glass-card"
                          style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem' }}
                        />
                        
                        <div className="member-list" style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {(() => {
                            let usersToDisplay = allUsers;
                            if (selectedOrgId) {
                              const org = organizations.find(o => o._id === selectedOrgId);
                              if (org && org.members) {
                                const orgMemberIds = org.members.map(m => m.user?._id || m.user);
                                usersToDisplay = allUsers.filter(u => orgMemberIds.includes(u._id));
                              } else {
                                usersToDisplay = [];
                              }
                            }
                            return usersToDisplay
                              .filter(u => u._id !== host?._id) // exclude host
                              .filter(u => u.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) || u.email.toLowerCase().includes(memberSearchQuery.toLowerCase()))
                              .map(u => {
                                const isSelected = selectedMembers.includes(u._id);
                                return (
                                  <label key={u._id} className="member-checkbox-item" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px', background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>
                                    <input 
                                      type="checkbox" 
                                      checked={isSelected}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedMembers(prev => [...prev, u._id]);
                                        } else {
                                          setSelectedMembers(prev => prev.filter(id => id !== u._id));
                                          setPriorityMembers(prev => prev.filter(id => id !== u._id));
                                        }
                                      }}
                                      style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                                    />
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.name}</span>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</span>
                                    </div>
                                    {isSelected && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={(e) => e.stopPropagation()}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                                          <input 
                                            type="checkbox"
                                            checked={priorityMembers.includes(u._id)}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setPriorityMembers(prev => [...prev, u._id]);
                                              } else {
                                                setPriorityMembers(prev => prev.filter(id => id !== u._id));
                                              }
                                            }}
                                            style={{ width: '14px', height: '14px', accentColor: '#ef4444' }}
                                          />
                                          Priority
                                        </label>
                                      </div>
                                    )}
                                  </label>
                                );
                              });
                          })()}
                          
                          {(() => {
                            let usersToDisplay = allUsers;
                            if (selectedOrgId) {
                              const org = organizations.find(o => o._id === selectedOrgId);
                              if (org && org.members) {
                                const orgMemberIds = org.members.map(m => m.user?._id || m.user);
                                usersToDisplay = allUsers.filter(u => orgMemberIds.includes(u._id));
                              } else {
                                usersToDisplay = [];
                              }
                            }
                            if (usersToDisplay.filter(u => u._id !== host?._id).length === 0) {
                              return <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>No members found.</p>;
                            }
                            return null;
                          })()}
                        </div>
                        
                        {selectedMembers.length > 0 && (
                          <div className="selected-members-summary" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                              {selectedMembers.map(id => {
                                const u = allUsers.find(user => user._id === id);
                                const isPriority = priorityMembers.includes(id);
                                return (
                                  <span key={id} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '12px', background: isPriority ? 'rgba(239, 68, 68, 0.2)' : 'var(--primary)', color: isPriority ? '#ef4444' : 'white', fontWeight: 600, border: isPriority ? '1px solid #ef4444' : 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    {u?.name?.split(' ')[0]} {isPriority && '★'}
                                  </span>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <div className="form-section">
                      <label className="section-label"><AlignLeft size={16} /> Meeting Description</label>
                      <textarea 
                        placeholder="Add some details about the meeting..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="glass-card"
                        rows={3}
                      />
                    </div>
                    {/* Conflict Warning Banner */}
                    <AnimatePresence>
                      {conflictWarning && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0, marginTop: 0 }}
                          animate={{ opacity: 1, height: 'auto', marginTop: '1rem' }}
                          exit={{ opacity: 0, height: 0, marginTop: 0 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div className="conflict-banner">
                            <div className="conflict-header">
                              <AlertTriangle size={20} color="#ef4444" />
                              <h4 style={{ margin: 0, color: '#ef4444' }}>Priority Members Unavailable</h4>
                            </div>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0.5rem 0' }}>
                              The following priority members have conflicts during this time:
                            </p>
                            <ul style={{ fontSize: '0.85rem', paddingLeft: '1.5rem', color: 'white', marginBottom: '1rem' }}>
                              {conflictWarning.members.map(m => (
                                <li key={m.id}><strong>{m.name}</strong></li>
                              ))}
                            </ul>
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                              <button 
                                className="btn-secondary" 
                                style={{ flex: 1, borderColor: '#ef4444', color: '#ef4444' }}
                                onClick={() => { setConflictWarning(null); setStep(1); }}
                              >
                                Postpone Meeting
                              </button>
                              {(host?.role === 'admin' || host?.role === 'host') && (
                                <button 
                                  className="btn-primary" 
                                  style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' }}
                                  onClick={() => handleBook(true)}
                                >
                                  Continue Anyway
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Blocked Slot Toast (for regular members) */}
                  <AnimatePresence>
                    {blockedToast && (
                      <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="blocked-toast"
                      >
                        <AlertTriangle size={16} color="#f97316" />
                        <span>{blockedToast}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!conflictWarning && (
                    <button 
                      className="btn-primary confirm-btn" 
                      disabled={!selectedSlot || isBooking}
                      onClick={() => handleBook(hasConfirmedConflict)}
                    >
                      {isBooking ? 'Finalizing...' : 'Complete Booking'}
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          ) : (

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="success-state"
            >
              <div className="success-icon">
                <CheckCircle2 size={64} color="#10b981" />
              </div>
              <h2>Booking Confirmed!</h2>
              <p>Your meeting has been scheduled and calendar invites have been sent.</p>
              
              <div className="meeting-summary glass-card">
                <div className="summary-item">
                  <CalendarIcon size={18} />
                  <span>{dayjs(selectedSlot.startTime).tz(deviceTimezone).format('MMMM D, YYYY')}</span>
                </div>
                <div className="summary-item">
                  <Clock size={18} />
                  <span>{dayjs(selectedSlot.startTime).tz(deviceTimezone).format('hh:mm A')} — {dayjs(selectedSlot.endTime).tz(deviceTimezone).format('hh:mm A')} ({deviceTimezone})</span>
                </div>
                {selectedOrgId && (
                  <div className="summary-item">
                    <Building2 size={18} />
                    <span>{organizations.find(o => o._id === selectedOrgId)?.name}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '2rem' }}>
                <button 
                  className="btn-secondary" 
                  style={{ flex: 1 }} 
                  onClick={() => navigate('/dashboard')}
                >
                  Dashboard
                </button>
                {(() => {
                  const startTime = dayjs(newMeeting?.startTime);
                  const canJoin = startTime.subtract(10, 'minute').isBefore(dayjs());
                  
                  return (
                    <button 
                      className={`btn-primary ${!canJoin ? 'disabled' : ''}`} 
                      style={{ flex: 1 }} 
                      disabled={!canJoin}
                      onClick={() => navigate(newMeeting?.meetingLink || '/dashboard')}
                      title={!canJoin ? `Available 10 minutes before meeting` : 'Join Meeting'}
                    >
                      {canJoin ? 'Join Now' : 'Locked'}
                    </button>
                  );
                })()}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <ConflictWarningModal 
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        conflicts={slotConflicts[pendingSlot?._id]}
        slot={pendingSlot}
        onConfirm={confirmConflictOverride}
        deviceTimezone={deviceTimezone}
      />

      <style>{`

        .booking-page {
          min-height: calc(100vh - 120px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }
        .booking-container {
          display: grid;
          grid-template-columns: 350px 1fr;
          width: 100%;
          max-width: 1100px;
          min-height: 700px;
          overflow: hidden;
        }
        .booking-sidebar {
          padding: 3rem;
          border-right: 1px solid var(--border);
          background: rgba(255,255,255,0.02);
        }
        .host-info {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 3rem;
        }
        .host-avatar {
          width: 64px;
          height: 64px;
          border-radius: 20px;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .host-name { font-size: 1.5rem; font-weight: 800; }
        .event-details { display: flex; flex-direction: column; gap: 1.5rem; }
        .event-title { font-size: 2rem; font-weight: 800; line-height: 1.1; }
        .detail-item { display: flex; align-items: center; gap: 0.75rem; font-weight: 600; color: var(--text-muted); }
        .event-desc { margin-top: 1rem; line-height: 1.6; color: var(--text-muted); font-size: 0.95rem; }
        
        .booking-main {
          padding: 3rem;
          background: rgba(0,0,0,0.2);
          display: flex;
          flex-direction: column;
        }
        .step-container { height: 100%; display: flex; flex-direction: column; }
        .selection-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem; margin-bottom: 2rem; }
        .weekday { text-align: center; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; padding: 0.5rem 0; }
        .calendar-day { aspect-ratio: 1; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); color: white; font-weight: 600; transition: all 0.2s; cursor: pointer; }
        .calendar-day.active { background: var(--primary); border-color: var(--primary); box-shadow: 0 0 15px var(--primary-glow); }
        .calendar-day.disabled { opacity: 0.2; cursor: not-allowed; }
        .calendar-day.empty { border: none; background: transparent; cursor: default; }
        .month-nav { display: flex; gap: 0.5rem; }
        .btn-icon.disabled { opacity: 0.3; cursor: not-allowed; pointer-events: none; }
        .section-label { font-size: 0.85rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
        
        .slots-grid-mini { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 0.75rem; }
        
        .slot-wrapper { position: relative; }
        .slot-wrapper.has-conflict { animation: conflictPulse 3s ease-in-out infinite; }
        @keyframes conflictPulse {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.05); }
        }
        
        .slot-card-mini { 
          padding: 0.75rem; 
          border-radius: 10px; 
          border: 1px solid var(--border); 
          background: var(--surface); 
          color: white; 
          font-weight: 700; 
          font-size: 0.9rem; 
          cursor: pointer; 
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); 
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
        }
        .slot-card-mini:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .slot-card-mini.active { border-color: var(--primary); color: var(--primary); background: rgba(59, 130, 246, 0.1); box-shadow: 0 0 20px rgba(59, 130, 246, 0.15); }
        
        /* ── Conflict Warning State (selectable by admin/host) ── */
        .slot-card-mini.conflict {
          border-color: #f97316;
          color: #f97316;
          background: rgba(249, 115, 22, 0.08);
          position: relative;
        }
        .slot-card-mini.conflict:hover {
          background: rgba(249, 115, 22, 0.18);
          box-shadow: 0 0 20px rgba(249, 115, 22, 0.2);
          border-color: #fb923c;
        }
        .slot-card-mini.conflict.active {
          border-color: #f97316;
          color: #f97316;
          background: rgba(249, 115, 22, 0.2);
          box-shadow: 0 0 25px rgba(249, 115, 22, 0.25);
        }
        .slot-conflict-icon { flex-shrink: 0; opacity: 0.8; }
        
        /* ── Blocked State (non-admin users) ── */
        .slot-card-mini.blocked {
          cursor: not-allowed;
          opacity: 0.45;
          border-color: rgba(249, 115, 22, 0.3);
          color: rgba(249, 115, 22, 0.6);
          background: rgba(249, 115, 22, 0.04);
        }
        .slot-card-mini.blocked:hover {
          transform: none;
          box-shadow: none;
          background: rgba(249, 115, 22, 0.08);
          opacity: 0.55;
        }
        
        /* ── Conflict Badge ── */
        .conflict-badge-dot {
          position: absolute;
          top: -5px;
          right: -5px;
          background: linear-gradient(135deg, #f97316, #ea580c);
          color: white;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 800;
          pointer-events: none;
          box-shadow: 0 0 8px rgba(249, 115, 22, 0.5);
          z-index: 2;
        }
        
        /* ── Override Hint (admin/host only) ── */
        .override-hint {
          position: absolute;
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(249, 115, 22, 0.9);
          color: white;
          font-size: 0.6rem;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 4px;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          pointer-events: none;
          white-space: nowrap;
          z-index: 2;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .slot-wrapper:hover .override-hint { opacity: 1; }
        
        /* ── Blocked Toast ── */
        .blocked-toast {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.85rem 1.25rem;
          border-radius: 10px;
          background: rgba(249, 115, 22, 0.12);
          border: 1px solid rgba(249, 115, 22, 0.25);
          color: #fdba74;
          font-size: 0.82rem;
          font-weight: 500;
          line-height: 1.4;
          margin-top: 0.75rem;
        }
        
        .input-wrap select, .form-section textarea { width: 100%; padding: 1rem; border-radius: 14px; border: 1px solid var(--border); background: var(--surface); color: white; font-size: 1rem; outline: none; }
        .input-wrap select:focus, .form-section textarea:focus { border-color: var(--primary); }
        
        .conflict-banner { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 1.5rem; }
        .conflict-header { display: flex; align-items: center; gap: 0.5rem; }

        .confirm-btn { width: 100%; padding: 1.1rem; font-weight: 700; font-size: 1.1rem; margin-top: auto; display: flex; align-items: center; justify-content: center; gap: 0.75rem; }
        .success-state { text-align: center; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .meeting-summary { width: 100%; padding: 2rem; margin-bottom: 2.5rem; display: flex; flex-direction: column; gap: 1rem; text-align: left; }
        .summary-item { display: flex; align-items: center; gap: 1rem; font-weight: 600; font-size: 1.1rem; }
        
        @media (max-width: 900px) { .booking-container { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
};

export default BookingPage;
