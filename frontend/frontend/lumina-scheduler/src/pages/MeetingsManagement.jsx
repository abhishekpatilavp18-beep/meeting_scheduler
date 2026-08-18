import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Calendar, Filter, MoreVertical, ExternalLink, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import MeetingPreviewBanner from '../components/MeetingPreviewBanner';
import { useAuth } from '../hooks/useAuth';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const MeetingsManagement = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState('upcoming');

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState(dayjs());

  // Update current time every 30 seconds to refresh button states
  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 30000);
    return () => clearInterval(timer);
  }, []);

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

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        setLoading(true);
        const response = await api.get('/meetings?limit=50');
        if (response.success && response.data) {
          setMeetings(response.data.meetings || []);
          setError(null);
        }
      } catch (err) {
        if (!err.isCancelled) {
          setError(err.message || 'Failed to load meetings');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchMeetings();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete/cancel this meeting?')) return;
    try {
      const res = await api.delete(`/meetings/${id}`);
      if (res.success) {
        setMeetings(prev => prev.map(m => m._id === id ? { ...m, status: 'cancelled' } : m));
      }
    } catch (err) {
      alert(err.message || 'Failed to delete meeting');
    }
  };

  const filteredMeetings = useMemo(() => {
    const now = new Date();
    const q = searchQuery.toLowerCase().trim();
    
    return meetings.filter(m => {
      // 1. Tab Filter
      let matchesTab = true;
      if (activeTab === 'upcoming') matchesTab = m.status === 'scheduled' && new Date(m.startTime) > now;
      else if (activeTab === 'past') matchesTab = m.status === 'completed' || (m.status === 'scheduled' && new Date(m.endTime) < now);
      else if (activeTab === 'cancelled') matchesTab = m.status === 'cancelled';
      
      if (!matchesTab) return false;

      // 2. Search Filter
      if (!q) return true;
      
      const title = (m.title || '').toLowerCase();
      const orgName = (m.organization?.name || '').toLowerCase();
      const hostName = (m.organizer?.name || '').toLowerCase();
      
      const participantsMatch = (m.participants || []).some(p => {
        const u = p.user || {};
        return (u.name || '').toLowerCase().includes(q) || 
               (u.email || '').toLowerCase().includes(q);
      });

      return title.includes(q) || orgName.includes(q) || hostName.includes(q) || participantsMatch;
    });
  }, [meetings, activeTab, searchQuery]);

  return (
    <div className="meetings-page">
      <header className="page-header">
        <h1 className="page-title">Meetings</h1>
        <p className="page-subtitle">View and manage all your scheduled appointments.</p>
      </header>

      <div className="meetings-container glass-card">
        <div className="meetings-toolbar">
          <div className="tabs">
            <button 
              className={`tab ${activeTab === 'upcoming' ? 'active' : ''}`}
              onClick={() => setActiveTab('upcoming')}
            >
              Upcoming
            </button>
            <button 
              className={`tab ${activeTab === 'past' ? 'active' : ''}`}
              onClick={() => setActiveTab('past')}
            >
              Past
            </button>
            <button 
              className={`tab ${activeTab === 'cancelled' ? 'active' : ''}`}
              onClick={() => setActiveTab('cancelled')}
            >
              Cancelled
            </button>
          </div>
          <div className="actions">
            <div className="search-bar glass-card">
              <Search size={18} color="var(--text-muted)" />
              <input 
                type="text" 
                placeholder="Search meetings..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn-secondary">
              <Filter size={18} />
              <span>Filter</span>
            </button>
          </div>
        </div>

        <div className="meetings-table">
          <div className="table-header">
            <span>Attendee / Event</span>
            <span>Date & Time</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          <div className="table-body">
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading meetings...</div>
            ) : error ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>{error}</div>
            ) : filteredMeetings.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {searchQuery ? `No results found for "${searchQuery}"` : `No ${activeTab} meetings found.`}
              </div>
            ) : filteredMeetings.map((meeting, i) => {
              const startDate = new Date(meeting.startTime);
              const endDate = new Date(meeting.endTime);
              const dateStr = startDate.toLocaleDateString();
              const timeStr = `${startDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${endDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
              const guest = meeting.participants?.length > 0 
                ? (meeting.participants[0].user?.name || meeting.participants[0].user?.email || 'Participant') 
                : (meeting.organizer?.name || 'Host');
              
              return (
                <motion.div 
                  key={meeting._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="table-row"
                >
                  <div className="col-attendee">
                    <div className="attendee-info">
                      <span className="name">{guest}</span>
                      <span className="email">{meeting.title || 'Meeting'}</span>
                      {meeting.participants?.some(p => p.isPriority) && (
                        <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 'bold', marginTop: '4px' }}>★ Includes Priority Members</span>
                      )}
                    </div>
                    <div className="event-type">
                      <span className="badge glass-card">{meeting.title || 'Meeting'}</span>
                    </div>
                  </div>
                  <div className="col-time">
                    <span className="date">{dateStr}</span>
                    <span className="time">{timeStr}</span>
                  </div>
                  <div className="col-status">
                    <span className={`status-pill ${meeting.status.toLowerCase()}`}>
                      {meeting.status}
                    </span>
                    {meeting.meetingLink && meeting.status !== 'cancelled' && (() => {
                      const startTime = dayjs(meeting.startTime);
                      const canJoin = startTime.subtract(10, 'minute').isBefore(now);
                      
                      return (
                        <button 
                          className={`btn-join-now ${!canJoin ? 'disabled' : ''}`} 
                          onClick={() => canJoin && handleJoinClick(meeting._id)}
                          title={!canJoin ? `Available 10 minutes before meeting (${startTime.subtract(10, 'minute').from(now)})` : 'Join Meeting'}
                        >
                          {canJoin ? 'Join Now' : 'Locked'}
                        </button>
                      );
                    })()}
                  </div>
                  <div className="col-actions">
                    <button className="btn-icon"><ExternalLink size={18} /></button>
                    {(role === 'host' || role === 'admin') && (
                      <>
                        <button className="btn-icon" onClick={() => handleDelete(meeting._id)} title="Delete Meeting">
                          <Trash2 size={18} color="#ef4444" />
                        </button>
                        <button className="btn-icon"><MoreVertical size={18} /></button>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
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
        .meetings-page {
          padding-bottom: 4rem;
        }
        .meetings-container {
          overflow: hidden;
          text-align: left;
        }
        .meetings-toolbar {
          padding: 1.5rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border);
        }
        .tabs {
          display: flex;
          gap: 0.5rem;
          background: var(--surface);
          padding: 0.25rem;
          border-radius: 12px;
          border: 1px solid var(--border);
        }
        .tab {
          padding: 0.6rem 1.25rem;
          border: none;
          background: none;
          color: var(--text-muted);
          font-weight: 600;
          cursor: pointer;
          border-radius: 10px;
          transition: all 0.2s;
        }
        .tab.active {
          background: var(--background);
          color: var(--primary);
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        .actions {
          display: flex;
          gap: 1rem;
        }
        .search-bar {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0 1rem;
          height: 42px;
          border-radius: 10px;
        }
        .search-bar input {
          background: none;
          border: none;
          color: var(--text);
          outline: none;
          font-size: 0.9rem;
        }
        .meetings-table {
          width: 100%;
        }
        .table-header {
          display: grid;
          grid-template-columns: 2.2fr 1.5fr 1.8fr 100px;
          padding: 1rem 2rem;
          background: var(--surface);
          color: var(--text-muted);
          font-size: 0.85rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .table-row {
          display: grid;
          grid-template-columns: 2.2fr 1.5fr 1.8fr 100px;
          padding: 1.5rem 2rem;
          align-items: center;
          border-bottom: 1px solid var(--border);
          transition: background 0.2s;
        }
        .table-row:hover {
          background: var(--surface-hover);
        }
        .attendee-info {
          display: flex;
          flex-direction: column;
          margin-bottom: 0.5rem;
        }
        .attendee-info .name {
          font-weight: 700;
          font-size: 1.1rem;
        }
        .attendee-info .email {
          font-size: 0.85rem;
          color: var(--text-muted);
        }
        .col-time {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .col-time .date {
          font-weight: 600;
        }
        .col-time .time {
          font-size: 0.9rem;
          color: var(--text-muted);
        }
        .status-pill {
          padding: 0.4rem 0.8rem;
          border-radius: 100px;
          font-size: 0.8rem;
          font-weight: 700;
          display: inline-block;
        }
        .status-pill.confirmed {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }
        .status-pill.pending {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
        }
        .col-status {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .btn-join-now {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          padding: 0.5rem 1.25rem;
          border-radius: 12px;
          border: none;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          white-space: nowrap;
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.25);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .btn-join-now:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(16, 185, 129, 0.35);
          filter: brightness(1.1);
        }
        .btn-join-now.disabled {
          background: var(--surface-hover);
          color: var(--text-muted);
          cursor: not-allowed;
          box-shadow: none;
          border: 1px solid var(--border);
          opacity: 0.7;
        }
        .btn-join-now.disabled:hover {
          transform: none;
          filter: none;
        }
        .col-actions {
          display: flex;
          gap: 0.5rem;
        }
        .btn-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--glass);
          border: 1px solid var(--border);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-icon:hover {
          color: var(--primary);
          border-color: var(--primary);
        }
      `}</style>
    </div>
  );
};

export default MeetingsManagement;
