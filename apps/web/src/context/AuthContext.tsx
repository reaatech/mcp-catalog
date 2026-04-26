import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, authStore, type AuthUser } from '../lib/api.js';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => authStore.getUser());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onStorage = () => setUser(authStore.getUser());
    const onAuthCleared = () => setUser(null);
    window.addEventListener('storage', onStorage);
    window.addEventListener('mcp-catalog:auth-cleared', onAuthCleared);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('mcp-catalog:auth-cleared', onAuthCleared);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.login(email, password);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
