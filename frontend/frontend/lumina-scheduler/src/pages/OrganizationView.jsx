import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Users, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];

const getInitials = (name) => {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

const OrganizationView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/organizations/${id}`);
        if (res.success) {
          setOrganization(res.data.organization);
        }
      } catch (err) {
        if (!err.isCancelled) {
          setError(err.message || 'Failed to load organization details');
        }
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchOrganization();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="org-view-page loading-state">
        <Loader2 className="spinner" size={48} />
        <p>Loading Organization Details...</p>
        <style>{`.spinner { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } } .loading-state { height: 70vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; color: var(--text-muted); }`}</style>
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="org-view-page error-state" style={{ textAlign: 'center', padding: '4rem', color: '#f43f5e' }}>
        <p>{error || 'Organization not found.'}</p>
        <button className="btn-ghost" onClick={() => navigate('/organizations')} style={{ marginTop: '1rem' }}>
          <ArrowLeft size={16} style={{ marginRight: '0.5rem' }} /> Back to Organizations
        </button>
      </div>
    );
  }

  return (
    <div className="org-view-page">
      <header className="page-header">
        <div className="header-left">
          <button className="btn-icon-circle" onClick={() => navigate('/organizations')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="page-title">
              <Building2 size={28} className="title-icon" style={{ color: organization.color }} />
              {organization.name}
            </h1>
            <p className="page-subtitle">{organization.description}</p>
          </div>
        </div>
        <div className="header-right">
          {(role === 'admin' || role === 'host') && (
            <button 
              className="btn-primary" 
              onClick={() => navigate(`/organizations/${organization._id}`)}
            >
              Schedule Intelligent Meeting
            </button>
          )}
        </div>
      </header>

      <main className="org-main">
        <div className="members-section glass-card">
          <div className="section-header">
            <Users size={24} style={{ color: 'var(--primary)' }} />
            <h2>Organization Members</h2>
            <span className="member-count">{organization.members?.length || 0} Total</span>
          </div>

          {organization.members && organization.members.length > 0 ? (
            <div className="member-grid">
              {organization.members.map((m, i) => {
                const user = m.user;
                if (!user) return null;
                return (
                  <motion.div 
                    key={user._id || i}
                    className="member-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="member-avatar" style={{ background: COLORS[i % COLORS.length] }}>
                      {getInitials(user.name)}
                    </div>
                    <div className="member-info">
                      <span className="name">{user.name}</span>
                      <span className="email">{user.email}</span>
                      <span className={`role-badge ${m.role === 'admin' ? 'admin' : ''}`}>
                        {m.role === 'admin' ? 'Admin' : 'Member'}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <p className="no-members">No members found in this organization.</p>
          )}
        </div>
      </main>

      <style>{`
        .org-view-page { padding: 2rem 0 6rem; min-height: 100vh; }
        
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 2rem; flex-wrap: wrap; margin-bottom: 2rem; }
        .header-left { display: flex; align-items: flex-start; gap: 1.5rem; }
        .header-right { flex-shrink: 0; }
        .btn-icon-circle { width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--border); background: var(--glass); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; flex-shrink: 0; }
        .btn-icon-circle:hover { background: var(--primary); border-color: var(--primary); }
        
        .page-title { display: flex; align-items: center; gap: 0.75rem; font-size: 2.2rem; margin-bottom: 0.5rem; color: #fff; }
        .title-icon { opacity: 0.8; }
        .page-subtitle { color: var(--text-muted); font-size: 1.1rem; max-width: 600px; line-height: 1.5; }
        
        .org-main { max-width: 1000px; margin: 3rem auto 0; padding: 0 1rem; }
        
        .members-section { padding: 2.5rem; border-radius: 20px; border: 1px solid var(--border); }
        .section-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 2.5rem; }
        .section-header h2 { font-size: 1.5rem; color: #fff; margin: 0; }
        .member-count { background: rgba(59, 130, 246, 0.1); color: var(--primary); padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem; font-weight: 600; margin-left: auto; }
        
        .member-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
        .member-card { padding: 1.25rem; border-radius: 16px; background: rgba(15, 23, 42, 0.4); border: 1px solid var(--border); display: flex; align-items: center; gap: 1.25rem; transition: all 0.2s; }
        .member-card:hover { border-color: rgba(255, 255, 255, 0.2); background: rgba(15, 23, 42, 0.6); }
        
        .member-avatar { width: 50px; height: 50px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; font-weight: 700; color: white; flex-shrink: 0; }
        .member-info { display: flex; flex-direction: column; overflow: hidden; }
        .member-info .name { font-weight: 600; color: #fff; font-size: 1.05rem; margin-bottom: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .member-info .email { color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.5rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .role-badge { align-self: flex-start; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 6px; background: rgba(255, 255, 255, 0.05); color: var(--text-muted); border: 1px solid var(--border); }
        .role-badge.admin { background: rgba(16, 185, 129, 0.1); color: #10b981; border-color: rgba(16, 185, 129, 0.2); }
        
        .no-members { color: var(--text-muted); font-style: italic; text-align: center; padding: 2rem; }
      `}</style>
    </div>
  );
};

export default OrganizationView;
