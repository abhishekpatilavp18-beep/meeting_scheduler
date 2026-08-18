import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, LayoutDashboard, Clock, Users, Building2, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import NotificationBell from './NotificationBell';


const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();

  const allNavItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['member', 'host', 'admin'] },
    { name: 'Meetings', path: '/meetings', icon: <Users size={20} />, roles: ['member', 'host', 'admin'] },
    { name: 'Availability', path: '/availability', icon: <Clock size={20} />, roles: ['member', 'host', 'admin'] },
    { name: 'Schedule', path: '/book/me', icon: <Calendar size={20} />, roles: ['member', 'host', 'admin'] },
    { name: 'Organizations', path: '/organizations', icon: <Building2 size={20} />, roles: ['admin'] },
  ];

  const navItems = allNavItems.filter(item => !item.roles || item.roles.includes(role));

  return (
    <nav className="navbar glass-card">
      <Link to="/" className="logo">
        <img src="/kite-logo.png" alt="Kite" className="logo-img" style={{ height: '40px', objectFit: 'contain' }} />
      </Link>
      
      <div className="nav-links">
        {navItems.map((item) => (
          <Link 
            key={item.path} 
            to={item.path} 
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.name}</span>
            {location.pathname === item.path && (
              <motion.div 
                layoutId="nav-glow"
                className="nav-glow"
                initial={false}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </Link>
        ))}
      </div>

      <div className="nav-auth">
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div className="user-role-badge">{role}</div>
            <NotificationBell />
            <Link to="/profile" style={{ fontWeight: '600', fontSize: '0.9rem', color: 'white', textDecoration: 'none' }} className="nav-profile-link">
              {user.name}
            </Link>
            <button className="btn-secondary" onClick={logout}>Logout</button>
          </div>

        ) : (
          <>
            <button className="btn-secondary" onClick={() => navigate('/login')}>Login</button>
            <button className="btn-primary" onClick={() => navigate('/login')}>Get Started</button>
          </>
        )}
      </div>
      <style>{`
        .user-role-badge {
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          padding: 0.2rem 0.6rem;
          border-radius: 100px;
          background: rgba(255,255,255,0.1);
          border: 1px solid var(--border);
          color: var(--text-muted);
          letter-spacing: 0.05em;
        }
      `}</style>
    </nav>
  );
};

export default Navbar;
