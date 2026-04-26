import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

const ROLE_HIERARCHY: Record<string, number> = { admin: 3, developer: 2, viewer: 1 };

export const RequireAuth: React.FC<{ children: React.ReactNode; role?: 'admin' | 'developer' | 'viewer' }> = ({ children, role }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }
  if (role && (ROLE_HIERARCHY[user.role] ?? 0) < (ROLE_HIERARCHY[role] ?? 0)) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        You do not have permission to view this page.
      </div>
    );
  }
  return <>{children}</>;
};
