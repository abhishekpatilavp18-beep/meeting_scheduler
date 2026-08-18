import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, MessageSquare, Bug, Zap, Layout, Activity, Send, Filter, ArrowUpDown, ChevronDown, Trash2 } from 'lucide-react';

const CATEGORIES = [
  { id: 'Bug Report', icon: <Bug size={14} />, color: '#ef4444' },
  { id: 'Feature Request', icon: <Zap size={14} />, color: '#8b5cf6' },
  { id: 'UI/UX Feedback', icon: <Layout size={14} />, color: '#0ea5e9' },
  { id: 'Performance', icon: <Activity size={14} />, color: '#10b981' },
  { id: 'General Feedback', icon: <MessageSquare size={14} />, color: '#94a3b8' }
];

const UserFeedback = () => {
  const [feedbacks, setFeedbacks] = useState([
    {
      id: 1,
      name: 'Sarah Chen',
      avatar: 'SC',
      rating: 5,
      category: 'Feature Request',
      text: 'Would love to see a "Round Robin" scheduling option for our sales team. The current platform is already miles ahead of anything else!',
      timestamp: '2 hours ago',
      reactions: { '👍': 12, '🔥': 5 }
    },
    {
      id: 2,
      name: 'Marcus Thorne',
      avatar: 'MT',
      rating: 4,
      category: 'Performance',
      text: 'Load times on the dashboard have improved significantly. Still seeing a slight lag when syncing 5+ calendars simultaneously.',
      timestamp: '5 hours ago',
      reactions: { '⚡': 8 }
    },
    {
      id: 3,
      name: 'Elena Rodriguez',
      avatar: 'ER',
      rating: 5,
      category: 'UI/UX Feedback',
      text: 'The new dark mode aesthetic is absolute perfection. It makes scheduling feel like a premium experience rather than a chore.',
      timestamp: '1 day ago',
      reactions: { '🎨': 15, '❤️': 7 }
    }
  ]);

  const [formData, setFormData] = useState({ text: '', rating: 5, category: 'General Feedback' });
  const [activeFilter, setActiveFilter] = useState('All');
  const [sortBy, setSortBy] = useState('Latest'); // Latest, Highest Rated
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const stats = useMemo(() => {
    const total = feedbacks.length;
    const avgRating = (feedbacks.reduce((acc, f) => acc + f.rating, 0) / total).toFixed(1);
    const topCategory = feedbacks.reduce((acc, f) => {
      acc[f.category] = (acc[f.category] || 0) + 1;
      return acc;
    }, {});
    const mostRequested = Object.entries(topCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    
    return [
      { label: 'Total Feedbacks', value: total, icon: <MessageSquare size={20} />, color: 'var(--primary)' },
      { label: 'Average Rating', value: `${avgRating}/5`, icon: <Star size={20} />, color: '#f59e0b' },
      { label: 'Most Requested', value: mostRequested, icon: <Zap size={20} />, color: '#8b5cf6' },
      { label: 'Active Insights', value: total + 12, icon: <Activity size={20} />, color: '#10b981' }
    ];
  }, [feedbacks]);

  const filteredFeedbacks = useMemo(() => {
    let result = activeFilter === 'All' 
      ? feedbacks 
      : feedbacks.filter(f => f.category === activeFilter);
    
    if (sortBy === 'Highest Rated') {
      return [...result].sort((a, b) => b.rating - a.rating);
    }
    return [...result].sort((a, b) => b.id - a.id); // Assuming ID increases with time
  }, [feedbacks, activeFilter, sortBy]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.text.trim()) return;

    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      const newFeedback = {
        id: Date.now(),
        name: 'You',
        avatar: 'U',
        rating: formData.rating,
        category: formData.category,
        text: formData.text,
        timestamp: 'Just now',
        reactions: {}
      };

      setFeedbacks([newFeedback, ...feedbacks]);
      setFormData({ text: '', rating: 5, category: 'General Feedback' });
      setIsSubmitting(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }, 800);
  };

  const deleteFeedback = (id) => {
    setFeedbacks(feedbacks.filter(f => f.id !== id));
  };

  return (
    <section className="feedback-section">
      <div className="section-header">
        <motion.div 
          className="section-label"
          initial={{ opacity: 0 }} 
          whileInView={{ opacity: 1 }}
        >
          USER FEEDBACK
        </motion.div>
        <motion.h2 
          className="section-title"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          Real-time insights from users using Kite.
        </motion.h2>
      </div>

      {/* Analytics Summary */}
      <div className="analytics-grid">
        {stats.map((s, i) => (
          <motion.div 
            key={i}
            className="stat-card glass-card"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ y: -5, borderColor: s.color }}
          >
            <div className="stat-icon-wrap" style={{ background: `${s.color}20`, color: s.color }}>
              {s.icon}
            </div>
            <div className="stat-content">
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="feedback-layout">
        {/* Input Card */}
        <div className="feedback-input-container">
          <motion.div 
            className="feedback-form-card glass-card"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
          >
            <h3>Share Your Thoughts</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <textarea 
                  placeholder="Share your experience, suggestions, or issues..."
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="rating-selector">
                  <span>Rating:</span>
                  <div className="stars-input">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFormData({ ...formData, rating: star })}
                        className={formData.rating >= star ? 'active' : ''}
                      >
                        <Star size={18} fill={formData.rating >= star ? '#f59e0b' : 'none'} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="category-selector">
                  <select 
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.id}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="select-icon" />
                </div>
              </div>

              <button 
                type="submit" 
                className="btn-primary submit-btn"
                disabled={isSubmitting || !formData.text.trim()}
              >
                {isSubmitting ? 'Submitting...' : <><Send size={18} /> Submit Feedback</>}
              </button>
            </form>
          </motion.div>
        </div>

        {/* Feed Display */}
        <div className="feedback-feed-container">
          <div className="feed-controls">
            <div className="filter-chips">
              <button 
                className={`filter-chip ${activeFilter === 'All' ? 'active' : ''}`}
                onClick={() => setActiveFilter('All')}
              >
                All
              </button>
              {CATEGORIES.map(cat => (
                <button 
                  key={cat.id}
                  className={`filter-chip ${activeFilter === cat.id ? 'active' : ''}`}
                  onClick={() => setActiveFilter(cat.id)}
                >
                  {cat.id}
                </button>
              ))}
            </div>
            
            <button className="sort-btn glass-card" onClick={() => setSortBy(sortBy === 'Latest' ? 'Highest Rated' : 'Latest')}>
              <ArrowUpDown size={14} />
              <span>{sortBy}</span>
            </button>
          </div>

          <div className="feed-list">
            <AnimatePresence mode="popLayout">
              {filteredFeedbacks.map((f, i) => (
                <motion.div 
                  key={f.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="feedback-card glass-card"
                >
                    <div className="card-header">
                      <div className="user-info">
                        <div className="avatar-circle">{f.avatar}</div>
                        <div className="user-meta">
                          <span className="username">{f.name}</span>
                          <span className="timestamp">{f.timestamp}</span>
                        </div>
                      </div>
                      <div className="card-actions-top">
                        <div className="rating-stars">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} size={12} fill={i < f.rating ? '#f59e0b' : 'none'} color={i < f.rating ? '#f59e0b' : 'var(--text-muted)'} />
                          ))}
                        </div>
                        {f.name === 'You' && (
                          <button className="btn-delete-feedback" onClick={() => deleteFeedback(f.id)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  
                  <div className="category-badge" style={{ 
                    borderColor: CATEGORIES.find(c => c.id === f.category)?.color + '40',
                    color: CATEGORIES.find(c => c.id === f.category)?.color
                  }}>
                    {f.category}
                  </div>

                  <p className="feedback-text">{f.text}</p>

                  <div className="feedback-footer">
                    <div className="reactions">
                      {Object.entries(f.reactions).map(([emoji, count]) => (
                        <button key={emoji} className="reaction-btn glass-card">
                          <span>{emoji}</span>
                          <span>{count}</span>
                        </button>
                      ))}
                      <button className="reaction-btn glass-card add-reaction">+</button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {filteredFeedbacks.length === 0 && (
              <div className="empty-feed">
                <p>No feedback in this category yet. Be the first to share!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showToast && (
          <motion.div 
            className="success-toast glass-card"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
          >
            <div className="check-icon">✓</div>
            <span>Feedback submitted successfully!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .feedback-section { padding: 8rem 0; position: relative; }
        .analytics-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
          gap: 1.5rem; 
          margin-bottom: 4rem; 
        }
        .stat-card { 
          padding: 1.5rem; 
          display: flex; 
          align-items: center; 
          gap: 1.25rem; 
          border: 1px solid var(--border);
          transition: all 0.3s ease;
        }
        .stat-icon-wrap { 
          width: 48px; 
          height: 48px; 
          border-radius: 12px; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
        }
        .stat-content { display: flex; flex-direction: column; gap: 0.15rem; }
        .stat-value { font-size: 1.5rem; font-weight: 800; color: #fff; }
        .stat-label { font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

        .feedback-layout { 
          display: grid; 
          grid-template-columns: 400px 1fr; 
          gap: 3rem; 
          align-items: flex-start;
        }

        .feedback-form-card { 
          padding: 2.5rem; 
          position: sticky; 
          top: 100px;
          border: 1px solid var(--border);
        }
        .feedback-form-card h3 { font-size: 1.5rem; margin-bottom: 2rem; color: #fff; }
        .form-group textarea {
          width: 100%;
          min-height: 150px;
          padding: 1.25rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border);
          border-radius: 16px;
          color: #fff;
          font-family: inherit;
          resize: none;
          outline: none;
          transition: border-color 0.3s;
        }
        .form-group textarea:focus { border-color: var(--primary); }
        
        .form-row { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          margin: 1.5rem 0 2rem; 
          gap: 1rem;
        }
        .rating-selector { display: flex; align-items: center; gap: 0.75rem; }
        .stars-input { display: flex; gap: 0.25rem; }
        .stars-input button { 
          background: none; border: none; cursor: pointer; color: var(--text-muted); 
          transition: transform 0.2s;
        }
        .stars-input button:hover { transform: scale(1.2); }
        .stars-input button.active { color: #f59e0b; }

        .category-selector { position: relative; flex: 1; }
        .category-selector select {
          width: 100%;
          padding: 0.6rem 1rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border);
          border-radius: 10px;
          color: #fff;
          appearance: none;
          outline: none;
          cursor: pointer;
          font-size: 0.9rem;
        }
        .select-icon { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--text-muted); }

        .submit-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.75rem; padding: 1rem; font-size: 1rem; }

        .feed-controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
        .filter-chips { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .filter-chip {
          padding: 0.5rem 1rem;
          border-radius: 100px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border);
          color: var(--text-muted);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }
        .filter-chip:hover { border-color: var(--primary); color: var(--primary); }
        .filter-chip.active { background: var(--primary); border-color: var(--primary); color: white; box-shadow: 0 4px 15px var(--primary-glow); }
        
        .sort-btn { 
          display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; 
          border-radius: 10px; font-size: 0.85rem; font-weight: 600; color: #fff; cursor: pointer;
        }

        .feed-list { display: flex; flex-direction: column; gap: 1.5rem; }
        .feedback-card { 
          padding: 2rem; 
          border: 1px solid var(--border);
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .feedback-card:hover { 
          transform: translateY(-5px); 
          border-color: var(--primary);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 20px var(--primary-glow);
        }
        .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
        .user-info { display: flex; align-items: center; gap: 1rem; }
        .avatar-circle {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1.1rem;
        }
        .user-meta { display: flex; flex-direction: column; }
        .username { font-weight: 700; color: #fff; font-size: 1.05rem; }
        .timestamp { font-size: 0.8rem; color: var(--text-muted); }
        
        .card-actions-top { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; }
        .btn-delete-feedback {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
          padding: 0.35rem;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-delete-feedback:hover {
          background: #ef4444;
          color: white;
          transform: scale(1.1);
        }
        
        .category-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 100px;
          font-size: 0.75rem;
          font-weight: 700;
          border: 1px solid;
          margin-bottom: 1rem;
        }
        .feedback-text { color: rgba(255,255,255,0.85); line-height: 1.7; font-size: 1rem; }
        
        .feedback-footer { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.05); }
        .reactions { display: flex; gap: 0.5rem; }
        .reaction-btn {
          padding: 0.4rem 0.75rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.85rem;
          color: var(--text-muted);
          border: 1px solid var(--border);
          transition: all 0.2s;
        }
        .reaction-btn:hover { border-color: var(--primary); color: #fff; }
        .add-reaction { opacity: 0.5; }

        .success-toast {
          position: fixed;
          bottom: 30px;
          right: 30px;
          padding: 1rem 2rem;
          background: #10b981;
          color: white;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 1rem;
          z-index: 1000;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .success-toast .check-icon { font-weight: 900; font-size: 1.2rem; }

        .empty-feed { padding: 4rem; text-align: center; color: var(--text-muted); }

        @media (max-width: 1024px) {
          .feedback-layout { grid-template-columns: 1fr; }
          .feedback-form-card { position: static; margin-bottom: 2rem; }
        }
        @media (max-width: 640px) {
          .analytics-grid { grid-template-columns: 1fr 1fr; }
          .form-row { flex-direction: column; align-items: flex-start; }
          .category-selector { width: 100%; }
        }
      `}</style>
    </section>
  );
};

export default UserFeedback;
