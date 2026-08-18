import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, ArrowRight, Plus, Search, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

const Organizations = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/organizations');
      if (res.success) {
        setOrganizations(res.data.organizations || []);
      }
    } catch (err) {
      if (!err.isCancelled) {
        setError(err.message || 'Failed to load organizations');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);



  const handleDeleteOrg = async (orgId, orgName) => {
    if (!window.confirm(`Are you sure you want to delete "${orgName}"? This action cannot be undone.`)) return;
    
    try {
      const res = await api.delete(`/organizations/${orgId}`);
      if (res.success) {
        fetchOrganizations();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete organization');
    }
  };

  return (
    <div className="orgs-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Your <span className="glow-text">Organizations</span></h1>
          <p className="page-subtitle">Manage teams and schedule collaborative meetings.</p>
        </div>
        {role === 'admin' && (
          <button 
            className="btn-primary" 
            onClick={() => navigate('/organizations/new')}
          >
            <Plus size={18} /> Create Intelligent Meeting
          </button>
        )}
      </header>

      <div className="search-bar-wrap glass-card">
        <Search size={18} className="search-icon" />
        <input 
          type="text" 
          placeholder="Search organizations..." 
          onChange={(e) => {
            clearTimeout(window.orgSearchTimer);
            window.orgSearchTimer = setTimeout(() => {
              console.log(`[SEARCH] Filtering organizations for: ${e.target.value}`);
            }, 500);
          }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Loading workspaces...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#f43f5e' }}>{error}</div>
      ) : organizations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <Building2 size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p>No organizations found. Create one to get started!</p>
        </div>
      ) : (
        <div className="org-grid">
          <AnimatePresence>
            {organizations.map((org, i) => (
              <motion.div
                key={org._id}
                layout
                className="org-card glass-card"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -5, borderColor: org.color }}
              >
                <div className="org-icon" style={{ background: `${org.color}20`, color: org.color }}>
                  <Building2 size={24} />
                </div>
                <h3>{org.name}</h3>
                <p>{org.description}</p>
                <div className="org-meta">
                  <div className="meta-item">
                    <Users size={16} />
                    <span>{org.members?.length || 1} Members</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button className="btn-open" style={{ flex: 1 }} onClick={() => navigate(`/organizations/view/${org._id}`)}>
                    View Members <ArrowRight size={16} />
                  </button>
                  {role === 'admin' && (
                    <button 
                      className="btn-icon" 
                      style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', width: 'auto', padding: '0 1rem', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                      onClick={(e) => { e.stopPropagation(); handleDeleteOrg(org._id, org.name); }}
                      title="Delete Organization"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}



      <style>{`
        .page-header { margin-bottom: 4rem; display: flex; flex-direction: column; align-items: flex-start; gap: 2rem; }
        .page-title { margin-bottom: 0.5rem; }
        .page-subtitle { color: var(--text-muted); font-size: 1.1rem; }
        .search-bar-wrap {
          margin-bottom: 3rem;
          display: flex;
          align-items: center;
          padding: 0.75rem 1.5rem;
          gap: 1rem;
          max-width: 500px;
        }
        .search-bar-wrap input {
          background: none;
          border: none;
          color: white;
          width: 100%;
          outline: none;
          font-size: 1rem;
        }
        .search-icon { color: var(--text-muted); }
        
        .org-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 2rem;
        }
        .org-card {
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          transition: all 0.3s ease;
        }
        .org-icon {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.5rem;
        }
        .org-card h3 { font-size: 1.4rem; color: #fff; }
        .org-card p { color: var(--text-muted); line-height: 1.6; min-height: 3rem; }
        .org-meta { border-top: 1px solid var(--border); padding-top: 1.25rem; margin-top: 0.5rem; }
        .meta-item { display: flex; align-items: center; gap: 0.75rem; color: var(--text-muted); font-size: 0.9rem; }
        
        .btn-open {
          margin-top: 1rem;
          background: var(--surface);
          border: 1px solid var(--border);
          color: white;
          padding: 0.75rem;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          transition: all 0.2s;
        }
        .btn-open:hover {
          background: var(--primary);
          border-color: var(--primary);
          color: white;
        }
        
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        .modal-content {
          padding: 2.5rem;
          width: 90%;
          max-width: 450px;
          border-radius: 20px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
      `}</style>
    </div>
  );
};

export default Organizations;
