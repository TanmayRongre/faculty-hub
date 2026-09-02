import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

const TOKEN_KEY = 'facultyhub_token';
const USER_KEY = 'facultyhub_user';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  // Persist token + user in localStorage
  const saveSession = (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setToken(token);
    setUser(user);
  };

  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  // On mount — verify stored token is still valid
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setLoading(false);
        return;
      }
      try {
        const data = await authService.getMe();
        if (data.success) {
          setUser(data.user);
          setToken(storedToken);
        } else {
          clearSession();
        }
      } catch {
        clearSession();
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await authService.login(credentials);
    if (data.success) {
      saveSession(data.token, data.user);
    }
    return data;
  }, []);

  const register = useCallback(async (userData) => {
    const data = await authService.register(userData);
    if (data.success) {
      saveSession(data.token, data.user);
    }
    return data;
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, []);

  const isAuthenticated = !!user && !!token;
  const isFaculty = user?.role === 'faculty';
  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';
  const isFacultyOrAdmin = isFaculty || isAdmin;

  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    isFaculty,
    isAdmin,
    isStudent,
    isFacultyOrAdmin,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
