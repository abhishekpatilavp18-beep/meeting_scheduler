import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Users, Calendar, Clock, Check, ArrowRight, ArrowLeft, 
  Plus, X, Search, Building2, MessageSquare, Star, 
  ShieldCheck, Loader2, Sparkles, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import dayjs from 'dayjs';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];

const getInitials = (name) => {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

const OrgDetail = () => {
  const { id } = useParams(); // 'new' or an existing org ID
  const navigate = useNavigate();
  const { role, user: currentUser } = useAuth();

  // -- Workflow State --
  const [step, setStep] = useState(id === 'new' ? 1 : 2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // -- Data State --
  const [organization, setOrganization] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  
  // Step 1: Org Data
  const [orgForm, setOrgForm] = useState({ name: '', description: '', color: COLORS[0] });
  
  // Step 2 & 3: Members
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [priorityMembers, setPriorityMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Step 4: Time Slots
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Step 5: Meeting Details
  const [meetingDetails, setMeetingDetails] = useState({ 
    title: '', 
    agenda: '', 
    duration: 30, 
    type: 'Video',
    notes: '' 
  });

  // Step 6: Success
  const [finalMeeting, setFinalMeeting] = useState(null);

  // -- Fetch Initial Data --
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const usersRes = await api.get('/auth/users');
        if (usersRes.success) setAllUsers(usersRes.data.users || []);

        if (id !== 'new') {
          const orgRes = await api.get(`/organizations/${id}`);
          if (orgRes.success) {
            setOrganization(orgRes.data.organization);
            setOrgForm({
              name: orgRes.data.organization.name,
              description: orgRes.data.organization.description,
              color: orgRes.data.organization.color
            });
            // Auto-select existing members from the org
            const org = orgRes.data.organization;
            const memberIds = (org.members || []).map(m => {
              // Handle both populated objects and raw IDs
              if (m.user && typeof m.user === 'object') return m.user._id;
              return m.user;
            }).filter(Boolean);
            setSelectedMembers(memberIds);
          }
        }
      } catch (err) {
        if (!err.isCancelled) setError(err.message || 'Failed to initialize workflow');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id]);

  // -- Step Transitions --
  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => prev - 1);

  // -- Handlers --
  const handleCreateOrg = async () => {
    try {
      setIsSubmitting(true);
      const res = await api.post('/organizations', orgForm);
      if (res.success) {
        setOrganization(res.data.organization);
        nextStep();
      }
    } catch (err) {
      alert(err.message || 'Failed to create organization');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMember = (uId) => {
    setSelectedMembers(prev => 
      prev.includes(uId) ? prev.filter(i => i !== uId) : [...prev, uId]
    );
    // Remove from priority if unselected
    setPriorityMembers(prev => prev.filter(i => i !== uId || selectedMembers.includes(uId)));
  };

  const togglePriority = (uId) => {
    setPriorityMembers(prev => 
      prev.includes(uId) ? prev.filter(i => i !== uId) : [...prev, uId]
    );
  };

  // Persist selected members to the organization document in MongoDB
  const persistMembersAndAdvance = async () => {
    if (!organization) return;
    try {
      setIsSubmitting(true);
      const res = await api.put(`/organizations/${organization._id}`, {
        members: selectedMembers.map(mId => ({ user: mId, role: 'member' }))
      });
      if (res.success) {
        setOrganization(res.data.organization);
        nextStep();
      }
    } catch (err) {
      alert(err.message || 'Failed to save members');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchSmartSlots = async () => {
    try {
      setIsSubmitting(true);
      // In a real app, this would use a complex availability API
      // For this demo, we'll fetch host's available slots as a baseline
      const res = await api.get(`/slots/available?hostId=${currentUser?._id || ''}&limit=10`);
      if (res.success) {
        setAvailableSlots(res.data.slots || []);
        nextStep();
      }
    } catch (err) {
      alert(err.message || 'Failed to generate smart slots');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalSubmit = async () => {
    try {
      setIsSubmitting(true);
      
      const payload = {
        title: meetingDetails.title,
        description: `${meetingDetails.agenda}\n\nNotes: ${meetingDetails.notes}`,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        organization: organization._id,
        participants: selectedMembers.map(mId => ({
          user: mId,
          role: 'participant',
          isPriority: priorityMembers.includes(mId)
        })),
        meetingType: meetingDetails.type,
        duration: meetingDetails.duration
      };

      const res = await api.post('/meetings/book', payload);
      if (res.success) {
        setFinalMeeting(res.data.meeting);
        nextStep();
      }
    } catch (err) {
      alert(err.message || 'Failed to create meeting');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { n: 1, label: 'Organization' },
    { n: 2, label: 'Members' },
    { n: 3, label: 'Priority' },
    { n: 4, label: 'Smart Slots' },
    { n: 5, label: 'Details' },
    { n: 6, label: 'Confirm' }
  ];

  if (loading) return (
    <div className="loading-screen">
      <Loader2 className="spinner" size={48} />
      <p>Initializing Intelligent Workflow...</p>
    </div>
  );

  return (
    <div className="org-detail-page">
      <header className="page-header">
        <div className="header-left">
          <button className="btn-icon-circle" onClick={() => navigate('/organizations')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="page-title">{organization?.name || 'New Intelligent Meeting'}</h1>
            <p className="page-subtitle">{organization ? 'Guided Creation Flow' : 'Step 1: Setup Workspace'}</p>
          </div>
        </div>
        
        {step < 6 && (
          <div className="step-indicator glass-card">
            {steps.map((s) => (
              <div key={s.n} className={`step-dot ${step >= s.n ? 'active' : ''}`}>
                <div className="dot-inner">
                  {step > s.n ? <Check size={12} /> : s.n}
                </div>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </header>

      <main className="org-main">
        <AnimatePresence mode="wait">
          
          {/* STEP 1: CREATE ORGANIZATION */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="step-container">
              <div className="step-header">
                <Building2 size={48} className="step-icon" />
                <h2>Create Organization</h2>
                <p>Establish a collaborative workspace for your intelligent meeting.</p>
              </div>

              <div className="details-form glass-card">
                <div className="form-field">
                  <label>Organization Name</label>
                  <input 
                    type="text" placeholder="e.g. Innovation Labs" 
                    value={orgForm.name} onChange={e => setOrgForm({...orgForm, name: e.target.value})}
                  />
                </div>
                <div className="form-field">
                  <label>Description</label>
                  <textarea 
                    placeholder="What is the purpose of this workspace?" 
                    value={orgForm.description} onChange={e => setOrgForm({...orgForm, description: e.target.value})}
                  />
                </div>
              </div>

              <div className="step-actions">
                <button 
                  className="btn-primary btn-xl" 
                  disabled={!orgForm.name || isSubmitting}
                  onClick={handleCreateOrg}
                >
                  {isSubmitting ? 'Saving Workspace...' : 'Create & Continue'} <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: SELECT MEMBERS */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="step-container">
              <div className="step-header">
                <Users size={48} className="step-icon" />
                <h2>Select Participants</h2>
                <p>Choose who should attend this session from the platform.</p>
              </div>

              <div className="search-bar-wrap glass-card">
                <Search size={18} />
                <input 
                  type="text" placeholder="Search by name or email..." 
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="member-selection-grid">
                {allUsers
                  .filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((u, i) => {
                    const isSelected = selectedMembers.includes(u._id);
                    return (
                      <div 
                        key={u._id} 
                        className={`member-select-card glass-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleMember(u._id)}
                      >
                        <div className="member-avatar" style={{ background: COLORS[i % COLORS.length] }}>{getInitials(u.name)}</div>
                        <div className="member-info">
                          <span className="name">{u.name}</span>
                          <span className="role">{u.role}</span>
                        </div>
                        <div className="custom-checkbox">
                          {isSelected && <Check size={14} />}
                        </div>
                      </div>
                    );
                  })
                }
              </div>

              <div className="step-actions">
                <button className="btn-ghost btn-xl" onClick={id === 'new' ? prevStep : () => navigate('/organizations')}>Back</button>
                <button 
                  className="btn-primary btn-xl" 
                  disabled={selectedMembers.length === 0 || isSubmitting}
                  onClick={persistMembersAndAdvance}
                >
                  {isSubmitting ? 'Saving Members...' : 'Next: Choose Priority'} <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: CHOOSE PRIORITY MEMBERS */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="step-container">
              <div className="step-header">
                <Star size={48} className="step-icon" style={{ color: '#f59e0b' }} />
                <h2>Priority Members</h2>
                <p>Mark essential participants. The system will prioritize their availability.</p>
              </div>

              <div className="member-selection-grid">
                {selectedMembers.map((mId, i) => {
                  const u = allUsers.find(user => user._id === mId);
                  if (!u) return null;
                  const isPriority = priorityMembers.includes(mId);
                  return (
                    <div 
                      key={mId} 
                      className={`member-select-card glass-card priority-toggle ${isPriority ? 'is-priority' : ''}`}
                      onClick={() => togglePriority(mId)}
                    >
                      <div className="member-avatar" style={{ background: COLORS[i % COLORS.length] }}>{getInitials(u.name)}</div>
                      <div className="member-info">
                        <span className="name">{u.name}</span>
                        <span className="role">{isPriority ? 'Essential' : 'Optional'}</span>
                      </div>
                      <div className={`priority-star ${isPriority ? 'active' : ''}`}>
                        <Star size={20} fill={isPriority ? '#f59e0b' : 'transparent'} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="step-actions">
                <button className="btn-ghost btn-xl" onClick={prevStep}>Back</button>
                <button className="btn-primary btn-xl" onClick={fetchSmartSlots} disabled={isSubmitting}>
                  {isSubmitting ? 'Analyzing Availability...' : 'Generate Smart Slots'} <Sparkles size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: SMART TIME SLOTS */}
          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="step-container">
              <div className="step-header">
                <Sparkles size={48} className="step-icon" style={{ color: 'var(--primary)' }} />
                <h2>Smart Availability</h2>
                <p>AI-recommended slots based on {priorityMembers.length} priority participants.</p>
              </div>

              <div className="slots-calendar-view">
                {availableSlots.length > 0 ? (
                  availableSlots.map(slot => {
                    const isSelected = selectedSlot?.startTime === slot.startTime;
                    return (
                      <div 
                        key={slot.startTime} 
                        className={`slot-card glass-card ${isSelected ? 'active' : ''}`}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        <div className="slot-time">
                          <Clock size={20} />
                          <span>{dayjs(slot.startTime).format('hh:mm A')} - {dayjs(slot.endTime).format('hh:mm A')}</span>
                        </div>
                        <div className="slot-date">
                          <Calendar size={16} />
                          <span>{dayjs(slot.startTime).format('ddd, MMM D')}</span>
                        </div>
                        {isSelected && <div className="selected-badge"><Check size={14} /></div>}
                      </div>
                    );
                  })
                ) : (
                  <div className="no-slots glass-card">
                    <AlertTriangle size={32} color="#f59e0b" />
                    <p>No perfect matches found. Consider postponing or relaxing priority constraints.</p>
                  </div>
                )}
              </div>

              <div className="step-actions">
                <button className="btn-ghost btn-xl" onClick={prevStep}>Back</button>
                <button className="btn-primary btn-xl" disabled={!selectedSlot} onClick={nextStep}>
                  Enter Details <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 5: MEETING DETAILS */}
          {step === 5 && (
            <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="step-container">
              <div className="step-header">
                <MessageSquare size={48} className="step-icon" />
                <h2>Meeting Details</h2>
                <p>Finalize the objective and context for this session.</p>
              </div>

              <div className="details-form glass-card">
                <div className="form-field">
                  <label>Meeting Title</label>
                  <input 
                    type="text" placeholder="e.g. Quarterly Product Audit" 
                    value={meetingDetails.title} onChange={e => setMeetingDetails({...meetingDetails, title: e.target.value})}
                  />
                </div>
                <div className="form-field">
                  <label>Agenda</label>
                  <textarea 
                    placeholder="Key points to discuss..." 
                    value={meetingDetails.agenda} onChange={e => setMeetingDetails({...meetingDetails, agenda: e.target.value})}
                  />
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Duration</label>
                    <select value={meetingDetails.duration} onChange={e => setMeetingDetails({...meetingDetails, duration: e.target.value})}>
                      <option value={15}>15 Minutes</option>
                      <option value={30}>30 Minutes</option>
                      <option value={60}>1 Hour</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Type</label>
                    <select value={meetingDetails.type} onChange={e => setMeetingDetails({...meetingDetails, type: e.target.value})}>
                      <option value="Video">Video Call (Jitsi)</option>
                      <option value="In-Person">In-Person</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="step-actions">
                <button className="btn-ghost btn-xl" onClick={prevStep}>Back</button>
                <button 
                  className="btn-primary btn-xl" 
                  disabled={!meetingDetails.title || isSubmitting}
                  onClick={handleFinalSubmit}
                >
                  {isSubmitting ? 'Persisting Everything...' : 'Schedule Intelligent Meeting'} <ShieldCheck size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 6: SUCCESS */}
          {step === 6 && (
            <motion.div key="step6" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="success-container">
              <div className="success-badge">
                <CheckCircle2 size={64} />
              </div>
              <h2 className="success-title">Workflow Complete! 🎉</h2>
              <p className="success-subtitle">Organization created, participants linked, and meeting persisted.</p>

              <div className="final-summary glass-card">
                <div className="summary-row">
                  <label>Workspace</label>
                  <div className="org-tag" style={{ background: `${organization?.color}20`, color: organization?.color }}>
                    <Building2 size={14} /> {organization?.name}
                  </div>
                </div>
                <div className="summary-row">
                  <label>Meeting</label>
                  <span>{meetingDetails.title}</span>
                </div>
                <div className="summary-row">
                  <label>Time</label>
                  <span>{dayjs(selectedSlot?.startTime).format('MMM D, hh:mm A')}</span>
                </div>
                <div className="summary-row">
                  <label>Participants</label>
                  <div className="participant-count">
                    <Users size={14} /> {selectedMembers.length} Members ({priorityMembers.length} Priority)
                  </div>
                </div>
                <div className="summary-row">
                  <label>Jitsi Room</label>
                  <code className="room-link">{finalMeeting?.meetingLink}</code>
                </div>
              </div>

              <div className="step-actions centered">
                <button className="btn-primary btn-xl" onClick={() => navigate('/dashboard')}>
                  Go to Dashboard
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <style>{`
        .org-detail-page { padding: 2rem 0 6rem; min-height: 100vh; }
        .loading-screen { height: 70vh; display: flex; flexDirection: column; align-items: center; justify-content: center; gap: 1rem; color: var(--text-muted); }
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        .header-left { display: flex; align-items: center; gap: 1.5rem; }
        .btn-icon-circle { width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--border); background: var(--glass); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .btn-icon-circle:hover { background: var(--primary); border-color: var(--primary); }

        .step-indicator { display: flex; gap: 1.5rem; padding: 0.6rem 1.5rem; border-radius: 100px; }
        .step-dot { display: flex; align-items: center; gap: 0.5rem; opacity: 0.3; transition: all 0.3s; }
        .step-dot.active { opacity: 1; }
        .dot-inner { width: 22px; height: 22px; border-radius: 50%; background: var(--surface); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800; }
        .step-dot.active .dot-inner { background: var(--primary); border-color: var(--primary); box-shadow: 0 0 10px var(--primary-glow); }
        .step-dot span { font-size: 0.75rem; font-weight: 600; white-space: nowrap; }

        .org-main { max-width: 800px; margin: 3rem auto 0; padding: 0 1rem; }
        .step-header { margin-bottom: 3rem; text-align: center; }
        .step-icon { margin-bottom: 1.5rem; }
        .step-header h2 { font-size: 2.2rem; color: #fff; margin-bottom: 0.75rem; }
        .step-header p { color: var(--text-muted); font-size: 1.1rem; }

        .details-form { padding: 3rem; border: 1px solid var(--border); display: flex; flex-direction: column; gap: 2rem; max-width: 600px; margin: 0 auto; }
        .form-field { display: flex; flex-direction: column; gap: 0.75rem; text-align: left; }
        .form-field label { font-size: 0.95rem; color: #fff; font-weight: 600; }
        .form-field input, .form-field textarea, .form-field select { width: 100%; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; color: white; outline: none; font-size: 1rem; transition: all 0.2s; }
        .form-field textarea { min-height: 120px; resize: none; }
        .form-field input:focus, .form-field textarea:focus { border-color: var(--primary); background: rgba(59, 130, 246, 0.05); }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }

        .color-picker { display: flex; gap: 1rem; }
        .color-swatch { width: 40px; height: 40px; border-radius: 10px; cursor: pointer; border: 2px solid transparent; transition: all 0.2s; }
        .color-swatch.active { border-color: white; transform: scale(1.1); }

        .search-bar-wrap { margin-bottom: 2rem; padding: 0.75rem 1.25rem; display: flex; align-items: center; gap: 1rem; border: 1px solid var(--border); }
        .search-bar-wrap input { background: transparent; border: none; outline: none; color: white; width: 100%; font-size: 1rem; }

        .member-selection-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 3rem; }
        .member-select-card { padding: 1.25rem; display: flex; align-items: center; gap: 1rem; cursor: pointer; border: 1px solid var(--border); transition: all 0.2s; }
        .member-select-card:hover { border-color: var(--primary); background: var(--surface); }
        .member-select-card.selected { border-color: var(--primary); background: rgba(59, 130, 246, 0.05); }
        .member-avatar { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 800; color: white; }
        .member-info { flex: 1; }
        .member-info .name { display: block; font-weight: 600; color: #fff; }
        .member-info .role { font-size: 0.75rem; color: var(--text-muted); }
        .custom-checkbox { width: 22px; height: 22px; border-radius: 6px; border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; }
        .selected .custom-checkbox { background: var(--primary); border-color: var(--primary); }

        .priority-toggle.is-priority { border-color: #f59e0b; background: rgba(245, 158, 11, 0.05); }
        .priority-star { color: var(--border); transition: all 0.2s; }
        .priority-star.active { color: #f59e0b; }

        .slots-calendar-view { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
        .slot-card { padding: 1.5rem; cursor: pointer; border: 1px solid var(--border); position: relative; transition: all 0.2s; }
        .slot-card.active { border-color: var(--primary); background: rgba(59, 130, 246, 0.05); }
        .slot-time { display: flex; align-items: center; gap: 0.75rem; font-size: 1.2rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem; }
        .slot-date { display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); font-size: 0.9rem; }
        .selected-badge { position: absolute; top: 1rem; right: 1rem; background: var(--primary); color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }

        .no-slots { padding: 3rem; text-align: center; display: flex; flexDirection: column; align-items: center; gap: 1rem; border: 1px dashed var(--border); }

        .success-container { text-align: center; padding: 4rem 0; }
        .success-badge { width: 100px; height: 100px; border-radius: 50%; background: #10b981; color: white; display: flex; align-items: center; justify-content: center; margin: 0 auto 2rem; box-shadow: 0 0 40px rgba(16, 185, 129, 0.4); }
        .success-title { font-size: 2.5rem; margin-bottom: 1rem; }
        .success-subtitle { color: var(--text-muted); font-size: 1.2rem; margin-bottom: 3rem; }

        .final-summary { max-width: 500px; margin: 0 auto; padding: 2rem; text-align: left; border: 1px solid var(--border); display: flex; flexDirection: column; gap: 1.5rem; }
        .summary-row label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 0.5rem; }
        .summary-row span { font-size: 1.1rem; color: #fff; font-weight: 600; }
        .org-tag { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.8rem; borderRadius: 8px; font-weight: 700; font-size: 0.9rem; }
        .room-link { display: block; background: var(--surface); padding: 0.75rem; borderRadius: 8px; font-size: 0.8rem; border: 1px solid var(--border); color: var(--primary); overflow: hidden; textOverflow: ellipsis; }

        .step-actions { display: flex; justify-content: flex-end; gap: 1.5rem; margin-top: 4rem; }
        .step-actions.centered { justify-content: center; }
        .btn-xl { padding: 1.25rem 2.5rem; font-size: 1.1rem; border-radius: 16px; display: flex; align-items: center; gap: 0.75rem; }
      `}</style>
    </div>
  );
};

export default OrgDetail;
