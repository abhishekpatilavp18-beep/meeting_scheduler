import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    // Redirect to login but save the attempted url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Redirect to dashboard if user doesn't have the required role
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export const AdminRoute = ({ children }) => {
  return <ProtectedRoute allowedRoles={['admin']}>{children}</ProtectedRoute>;
};

export const HostRoute = ({ children }) => {
  return <ProtectedRoute allowedRoles={['host', 'admin']}>{children}</ProtectedRoute>;
};
