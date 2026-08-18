import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Users, ArrowUpRight, Plus, TrendingUp, Link2, Copy, ExternalLink, Building2, Zap } from 'lucide-react';
import api from '../services/api';
import MeetingPreviewBanner from '../components/MeetingPreviewBanner';
import { useAuth } from '../hooks/useAuth';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };
const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

const Dashboard = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [copiedLink, setCopiedLink] = useState(null);

  const copyLink = (key) => {
    setCopiedLink(key);
    setTimeout(() => setCopiedLink(null), 1800);
  };

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([
    { label: 'Total Meetings', value: '0', icon: <Users size={22} />, trend: 'Loading...', color: '#3b82f6' },
    { label: 'Upcoming', value: '0', icon: <Calendar size={22} />, trend: 'Loading...', color: '#8b5cf6' },
    { label: 'Avg. Duration', value: '0m', icon: <Clock size={22} />, trend: 'Loading...', color: '#10b981' },
  ]);
  const [weeklyActivity, setWeeklyActivity] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [now, setNow] = useState(dayjs());

  // Update current time every 30 seconds to refresh button states
  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 30000);
    return () => clearInterval(timer);
  }, []);

  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Core data — available to all authenticated roles
        const [meetingsRes, userRes] = await Promise.all([
          api.get('/meetings'),
          api.get('/auth/me')
        ]);

        if (meetingsRes.success) {
          setMeetings(meetingsRes.data.meetings || []);
        }

        if (userRes.success && userRes.data?.user) {
          const hostId = userRes.data.user._id;
          try {
            const recsRes = await api.get(`/slots/recommend?hostId=${hostId}&maxResults=3`);
            if (recsRes.success) {
              setRecommendations(recsRes.data.recommendations || []);
            }
          } catch (_) { /* recommendations are non-critical */ }
        }

        // Admin-only analytics — only fetch if the user has the admin role
        if (role === 'admin') {
          try {
            const [analyticsRes, usageRes] = await Promise.all([
              api.get('/analytics/overview'),
              api.get('/analytics/usage?period=7')
            ]);

            if (analyticsRes.success && analyticsRes.data) {
              const { meetings: mStats, duration } = analyticsRes.data;
              setStats([
                { 
                  label: 'Total Meetings', 
                  value: mStats.total.toString(), 
                  icon: <Users size={22} />, 
                  trend: `Cancelled: ${mStats.cancelled}`, 
                  color: '#3b82f6' 
                },
                { 
                  label: 'Upcoming', 
                  value: mStats.upcoming.toString(), 
                  icon: <Calendar size={22} />, 
                  trend: mStats.upcoming > 0 ? 'Action required' : 'Clear schedule', 
                  color: '#8b5cf6' 
                },
                { 
                  label: 'Avg. Duration', 
                  value: `${duration.avgMinutes}m`, 
                  icon: <Clock size={22} />, 
                  trend: `Max: ${duration.maxMinutes}m`, 
                  color: '#10b981' 
                },
              ]);
            }

            if (usageRes.success && usageRes.data?.weeklyStats?.daily) {
              const daily = usageRes.data.weeklyStats.daily;
              const activity = [0, 0, 0, 0, 0, 0, 0];
              daily.slice(-7).forEach((day, idx) => {
                activity[idx] = day.meetings;
              });
              const maxVal = Math.max(...activity, 5);
              setWeeklyActivity(activity.map(v => (v / maxVal) * 100));
            }
          } catch (analyticsErr) {
            console.warn("Analytics data unavailable:", analyticsErr.message);
          }
        } else {
          // For non-admin users, show meeting count from their own data
          const userMeetings = meetingsRes.success ? (meetingsRes.data.meetings || []) : [];
          const now = new Date();
          const upcomingCount = userMeetings.filter(m => new Date(m.startTime) > now && m.status !== 'cancelled').length;
          setStats([
            { label: 'My Meetings', value: userMeetings.length.toString(), icon: <Users size={22} />, trend: 'Your meetings', color: '#3b82f6' },
            { label: 'Upcoming', value: upcomingCount.toString(), icon: <Calendar size={22} />, trend: upcomingCount > 0 ? 'Action required' : 'Clear schedule', color: '#8b5cf6' },
            { label: 'Avg. Duration', value: '30m', icon: <Clock size={22} />, trend: 'Default', color: '#10b981' },
          ]);
        }

      } catch (e) {
        if (e.isCancelled) return;
        console.error("Failed to load dashboard data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [role]);

  const upcomingMeetings = meetings
    .filter(m => new Date(m.startTime) > new Date() && m.status !== 'cancelled')
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  const upcoming = upcomingMeetings.slice(0, 5).map(m => {
    const start = new Date(m.startTime);
    return {
      _id: m._id,
      title: m.title || 'Meeting',
      with: m.participants?.length > 0 ? (m.participants[0].user?.email || m.participants[0].user) : 'Guest',
      time: start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      date: start.toLocaleDateString(),
      type: 'Video',
      color: '#3b82f6',
      status: m.status,
      link: m.meetingLink,
      startTime: m.startTime
    };
  });


  const eventTypes = [
    { name: '15 Min Coffee Chat', slug: 'coffee', duration: '15 min', bookings: 23 },
    { name: 'Design Consultation', slug: 'design', duration: '60 min', bookings: 11 },
    { name: 'Technical Interview', slug: 'interview', duration: '45 min', bookings: 8 },
  ];

  // Quick Schedule modal state
  const [showQuickSchedule, setShowQuickSchedule] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDate, setQuickDate] = useState('');
  const [quickStartTime, setQuickStartTime] = useState('10:00');
  const [quickEndTime, setQuickEndTime] = useState('10:30');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState(null);

  // Meeting Preview State
  const [showPreview, setShowPreview] = useState(false);
  const [previewMeetingId, setPreviewMeetingId] = useState(null);

  const handleJoinClick = (meetingId) => {
    setPreviewMeetingId(meetingId);
    setShowPreview(true);
  };

  const handleFinalJoin = (link) => {
    setShowPreview(false);
    navigate(link);
  };

  const handleQuickSchedule = async () => {
    if (!quickTitle || !quickDate || !quickStartTime || !quickEndTime) return;
    
    // Construct dates in local time
    const startTime = new Date(`${quickDate}T${quickStartTime}`);
    const endTime = new Date(`${quickDate}T${quickEndTime}`);

    if (endTime <= startTime) {
      setQuickError('End time must be after start time');
      return;
    }

    if (startTime < new Date()) {
      setQuickError('Cannot schedule a meeting in the past');
      return;
    }

    setQuickLoading(true);
    setQuickError(null);
    try {
      const res = await api.post('/meetings/book', {
        title: quickTitle,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      if (res.success) {
        setShowQuickSchedule(false);
        setQuickTitle('');
        // Refresh meetings
        const meetingsRes = await api.get('/meetings');
        if (meetingsRes.success) setMeetings(meetingsRes.data.meetings || []);
        
        // Success notification or immediate join
        if (res.data?.meeting?.meetingLink) {
          navigate(res.data.meeting.meetingLink);
        }
      }
    } catch (err) {
      setQuickError(err.message || 'Failed to schedule meeting');
    } finally {
      setQuickLoading(false);
    }
  };

  return (
    <div className="dash">
      {/* Quick Schedule Modal */}
      {showQuickSchedule && (
        <div className="qs-overlay" onClick={() => setShowQuickSchedule(false)}>
          <motion.div
            className="qs-modal glass-card"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.3rem' }}>⚡ Quick Schedule</h3>
            {quickError && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>{quickError}</div>}
            <div className="qs-field">
              <label>Meeting Title</label>
              <input type="text" placeholder="Team Standup" value={quickTitle} onChange={e => setQuickTitle(e.target.value)} />
            </div>
            <div className="qs-field">
              <label>Date</label>
              <input type="date" value={quickDate} onChange={e => setQuickDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
            </div>
            <div className="qs-row">
              <div className="qs-field">
                <label>Start Time</label>
                <input type="time" value={quickStartTime} onChange={e => setQuickStartTime(e.target.value)} />
              </div>
              <div className="qs-field">
                <label>End Time</label>
                <input type="time" value={quickEndTime} onChange={e => setQuickEndTime(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowQuickSchedule(false)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleQuickSchedule} disabled={quickLoading || !quickTitle || !quickDate}>
                {quickLoading ? 'Scheduling...' : 'Schedule & Join'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Header */}
      <div className="dash-header">
        <div>
          <h1 className="page-title">Welcome <span className="glow-text">back</span> 👋</h1>
          <p className="page-subtitle">Here's your scheduling overview for today.</p>
        </div>
        <div className="header-actions">
          {role === 'admin' && (
            <button className="btn-ghost" onClick={() => navigate('/organizations')}>
              <Building2 size={18} /> Organizations
            </button>
          )}
          {(role === 'host' || role === 'admin') && (
            <button className="btn-primary" onClick={() => setShowQuickSchedule(true)}>
              <Plus size={18} /> Schedule Meeting
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <motion.div className="stats-row" variants={container} initial="hidden" animate="show">
        {stats.map((s, i) => (
          <motion.div key={i} variants={item} className="stat-card glass-card" whileHover={{ y: -4 }}>
            <div className="stat-icon-wrap" style={{ background: s.color + '18', color: s.color }}>{s.icon}</div>
            <div className="stat-body">
              <span className="stat-val">{s.value}</span>
              <span className="stat-lbl">{s.label}</span>
              <span className="stat-trend">{s.trend}</span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Main grid */}
      <div className="dash-grid">
        {/* Upcoming meetings */}
        <div className="dash-card glass-card">
          <div className="card-head">
            <h3>Upcoming Meetings</h3>
            <button className="btn-link" onClick={() => navigate('/meetings')}>View all <ArrowUpRight size={14} /></button>
          </div>
          <div className="meetings-feed">
            {upcoming.map((m, i) => (
              <motion.div
                key={i}
                className="meeting-row"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <div className="m-accent" style={{ background: m.color }} />
                <div className="m-time">
                  <span className="m-time-val">{m.time}</span>
                  <span className="m-date">{m.date}</span>
                </div>
                <div className="m-info">
                  <span className="m-title">{m.title}</span>
                  <span className="m-with">with {m.with}</span>
                </div>

                <div className="m-status">
                  <span className={`status-pill-sm ${m.status.toLowerCase()}`}>{m.status}</span>
                </div>
                {m.status !== 'Pending' && m.link && (() => {
                  const startTime = dayjs(m.startTime);
                  const canJoin = startTime.subtract(10, 'minute').isBefore(now);
                  
                  return (
                    <button 
                      className={`btn-join-now-sm ${!canJoin ? 'disabled' : ''}`} 
                      onClick={() => canJoin && handleJoinClick(m._id)}
                      title={!canJoin ? `Available 10 minutes before meeting (${startTime.subtract(10, 'minute').from(now)})` : 'Join Meeting'}
                    >
                      {canJoin ? 'Join Now' : 'Locked'}
                    </button>
                  );
                })()}
              </motion.div>
            ))}
            {loading && <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>}
            {!loading && upcoming.length === 0 && <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>No upcoming meetings</div>}
          </div>

          <div className="ai-recs-section">
             <div className="ai-header">
                <Zap size={16} fill="var(--primary)" color="var(--primary)" />
                <h4>Smart Suggestions</h4>
                <span className="ai-badge">AI Powered</span>
             </div>
             <p className="ai-desc">Optimal slots based on your preferred hours and peak performance times.</p>
             <div className="ai-grid">
                {recommendations.length > 0 ? recommendations.map((rec, i) => (
                  <div key={i} className="ai-card" onClick={() => copyLink(rec.startTime)}>
                    <div className="ai-score">
                      <TrendingUp size={12} /> {rec.score}% match
                    </div>
                    <span className="ai-time">{new Date(rec.startTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}, {rec.startTimeStr}</span>
                    <span className="ai-label">{rec.score > 90 ? 'Sweet Spot' : rec.score > 80 ? 'High Energy' : 'Productive'}</span>
                  </div>
                )) : (
                  <div className="ai-card" style={{ gridColumn: 'span 3', textAlign: 'center', opacity: 0.5 }}>
                    Set your availability to see smart suggestions.
                  </div>
                )}
             </div>
          </div>
        </div>


        {/* Right column */}
        <div className="dash-right">
          {/* Event type links */}
          <div className="dash-card glass-card">
            <div className="card-head">
              <h3>Your Event Links</h3>
              <button className="btn-link" onClick={() => navigate('/book/me')}>Preview <ExternalLink size={14} /></button>
            </div>
            <div className="links-list">
              {eventTypes.map((e, i) => (
                <div key={i} className="link-row">
                  <Link2 size={16} color="var(--primary)" />
                  <div className="link-details">
                    <span className="link-name">{e.name}</span>
                    <span className="link-meta">{e.duration} · {e.bookings} bookings</span>
                  </div>
                  <button className="btn-copy glass-card" onClick={() => copyLink(e.slug)}>
                    {copiedLink === e.slug ? '✓ Copied' : <><Copy size={14} /> Copy</>}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Chart placeholder */}
          <div className="dash-card glass-card">
            <div className="card-head"><h3>Weekly Activity</h3></div>
            <div className="chart-area">
              {weeklyActivity.map((h, i) => (
                <div key={i} className="bar-col">
                  <motion.div
                    className="bar"
                    style={{ height: `${h}%` }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: i * 0.06, duration: 0.4 }}
                  />
                  <span className="bar-label">{ ['M','T','W','T','F','S','S'][i] }</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      <MeetingPreviewBanner 
        isOpen={showPreview} 
        meetingId={previewMeetingId}
        onClose={() => setShowPreview(false)}
        onJoin={handleFinalJoin}
      />

      <style>{`
        .dash { padding-bottom: 4rem; }
        .dash-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
        .header-actions { display: flex; gap: 1rem; align-items: center; }
        .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2.5rem; }
        .stat-card { padding: 1.75rem 2rem; display: flex; align-items: center; gap: 1.5rem; cursor: default; }
        .stat-icon-wrap { width: 56px; height: 56px; min-width: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; }
        .stat-body { display: flex; flex-direction: column; gap: 0.25rem; }
        .stat-val { font-size: 2.2rem; font-weight: 800; font-family: 'Outfit', sans-serif; line-height: 1; }
        .stat-lbl { font-size: 0.85rem; color: var(--text-muted); }
        .stat-trend { font-size: 0.75rem; color: #10b981; }
        .dash-grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 1.5rem; }
        .dash-card { padding: 1.75rem; }
        .dash-right { display: flex; flex-direction: column; gap: 1.5rem; }
        .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .card-head h3 { font-size: 1.05rem; font-weight: 700; }
        .btn-link { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 0.25rem; transition: color 0.2s; }
        .btn-link:hover { color: var(--primary); }
        .meetings-feed { display: flex; flex-direction: column; gap: 0.75rem; }
        .meeting-row { display: flex; align-items: center; gap: 1rem; padding: 1rem; border-radius: 14px; background: var(--surface); border: 1px solid var(--border); transition: all 0.2s; }
        .meeting-row:hover { background: var(--surface-hover); border-color: var(--primary-glow); }
        .m-accent { width: 3px; height: 40px; border-radius: 3px; flex-shrink: 0; }
        .m-time { display: flex; flex-direction: column; min-width: 70px; }
        .m-time-val { font-weight: 700; font-size: 0.95rem; font-family: 'Outfit', sans-serif; }
        .m-date { font-size: 0.75rem; color: var(--text-muted); }
        .m-info { flex: 1; display: flex; flex-direction: column; }
        .m-title { font-weight: 600; font-size: 0.95rem; }
        .m-with { font-size: 0.8rem; color: var(--text-muted); }
        .m-type-badge { padding: 0.25rem 0.75rem; border-radius: 100px; font-size: 0.75rem; font-weight: 700; }
        .btn-join { padding: 0.4rem 0.9rem; background: none; border: 1px solid var(--border); color: var(--text); border-radius: 8px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .btn-join:hover { background: var(--primary); border-color: var(--primary); color: white; }
        .links-list { display: flex; flex-direction: column; gap: 1rem; }
        .link-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-radius: 12px; background: var(--surface); border: 1px solid var(--border); }
        .link-details { flex: 1; display: flex; flex-direction: column; }
        .link-name { font-weight: 600; font-size: 0.9rem; }
        .link-meta { font-size: 0.75rem; color: var(--text-muted); }
        .btn-copy { padding: 0.35rem 0.75rem; border-radius: 8px; border: 1px solid var(--border); color: var(--text-muted); font-size: 0.75rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.3rem; transition: all 0.2s; white-space: nowrap; background: transparent; }
        .btn-copy:hover { color: var(--primary); border-color: var(--primary); }
        .chart-area { display: flex; align-items: flex-end; gap: 0.5rem; height: 100px; padding: 0 0.5rem; }
        .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; height: 100%; justify-content: flex-end; }
        .bar { width: 100%; border-radius: 6px 6px 0 0; background: linear-gradient(180deg, var(--primary), var(--secondary)); transform-origin: bottom; min-height: 4px; }
        .bar-label { font-size: 0.7rem; color: var(--text-muted); font-weight: 600; }
        .btn-ghost { background: transparent; color: var(--text); border: 1px solid var(--glass-border); padding: 10px 18px; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
        .btn-ghost:hover { background: var(--surface-hover); border-color: var(--primary); }
        
        .status-pill-sm { padding: 0.2rem 0.6rem; border-radius: 100px; font-size: 0.7rem; font-weight: 700; display: inline-block; }
        .status-pill-sm.confirmed { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-pill-sm.pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        
        .btn-join-now-sm {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          padding: 0.35rem 0.85rem;
          border-radius: 8px;
          border: none;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          white-space: nowrap;
          box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);
        }
        .btn-join-now-sm:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 15px rgba(16, 185, 129, 0.3);
          filter: brightness(1.1);
        }
        .btn-join-now-sm.disabled {
          background: var(--surface-hover);
          color: var(--text-muted);
          cursor: not-allowed;
          box-shadow: none;
          border: 1px solid var(--border);
          opacity: 0.7;
        }
        .btn-join-now-sm.disabled:hover {
          transform: none;
          filter: none;
        }
        .m-status { min-width: 80px; text-align: center; }

        /* AI RECS */
        .ai-recs-section { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px dashed var(--border); }
        .ai-header { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem; }
        .ai-header h4 { font-size: 0.95rem; font-weight: 700; color: #fff; margin: 0; }
        .ai-badge { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; padding: 0.1rem 0.4rem; border-radius: 4px; background: var(--primary); color: white; letter-spacing: 0.05em; }
        .ai-desc { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.25rem; }
        .ai-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
        .ai-card { padding: 1rem; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); transition: all 0.2s; cursor: pointer; display: flex; flex-direction: column; gap: 0.4rem; }
        .ai-card:hover { background: rgba(59,130,246,0.05); border-color: var(--primary); transform: translateY(-2px); }
        .ai-score { font-size: 0.7rem; font-weight: 700; color: #10b981; display: flex; align-items: center; gap: 0.3rem; }
        .ai-time { font-size: 0.85rem; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ai-label { font-size: 0.75rem; color: var(--text-muted); }

        /* Quick Schedule Modal */
        .qs-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .qs-modal { width: 100%; max-width: 420px; padding: 2.5rem; }
        .qs-field { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
        .qs-field label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); }
        .qs-field input { padding: 0.75rem 1rem; border-radius: 10px; background: var(--surface); border: 1px solid var(--border); color: var(--text); outline: none; font-size: 0.95rem; }
        .qs-field input:focus { border-color: var(--primary); box-shadow: 0 0 10px var(--primary-glow); }
        .qs-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

        @media (max-width: 1024px) {
          .stats-row { grid-template-columns: repeat(2, 1fr); }
          .dash-grid { grid-template-columns: 1fr; }
          .ai-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .stats-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
