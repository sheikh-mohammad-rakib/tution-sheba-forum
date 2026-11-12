import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { clearTeachersCache, abortOngoingSync } from '../services/teacherStorage';

const AuthContext = createContext(null);
const AUTH_CHANNEL_NAME = 'tsf_auth_channel';
const AUTH_SYNC_STORAGE_KEY = 'tsf_auth_sync';

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [lockedUntil, setLockedUntil] = useState(null);

  const channelRef = useRef(null);
  const lastAuthEventTsRef = useRef(0);
  const lastLogoutTsRef = useRef(0);
  const isAuthenticatedRef = useRef(false);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const broadcastAuthEvent = useCallback((type) => {
    const payload = { type, ts: Date.now() };
    lastAuthEventTsRef.current = payload.ts;
    if (type === 'LOGOUT') {
      lastLogoutTsRef.current = payload.ts;
    }

    try {
      localStorage.setItem(AUTH_SYNC_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage errors in restricted environments
    }

    try {
      channelRef.current?.postMessage(payload);
    } catch {
      // Ignore BroadcastChannel errors
    }

    return payload.ts;
  }, []);

  // Check existing session on mount or cross-tab login sync
  const checkAuth = useCallback(async ({ silent = false } = {}) => {
    const requestStartTs = Date.now();
    try {
      if (!silent) {
        setIsLoading(true);
      }
      const res = await fetch('/.netlify/functions/auth/verify', {
        credentials: 'include',
      });

      // Ignore stale verification results if a logout occurred during/since request start
      if (lastLogoutTsRef.current >= requestStartTs) {
        return;
      }

      if (res.ok) {
        const data = await res.json();
        if (lastLogoutTsRef.current >= requestStartTs) {
          return;
        }
        const authed = Boolean(data.authenticated);
        if (authed) {
          lastAuthEventTsRef.current = Math.max(lastAuthEventTsRef.current, requestStartTs);
        }
        setIsAuthenticated(authed);
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      if (lastLogoutTsRef.current < requestStartTs) {
        setIsAuthenticated(false);
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  const handleRemoteLogout = useCallback((ts) => {
    const eventTs = ts || Date.now();
    lastAuthEventTsRef.current = eventTs;
    lastLogoutTsRef.current = eventTs;
    abortOngoingSync();
    setIsAuthenticated(false);
    setAuthError(null);
    setLockedUntil(null);
  }, []);

  const processSyncPayload = useCallback(
    (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const { type, ts } = payload;
      if (ts && ts <= lastAuthEventTsRef.current) return;

      if (type === 'LOGOUT') {
        handleRemoteLogout(ts);
      } else if (type === 'LOGIN') {
        lastAuthEventTsRef.current = ts || Date.now();
        if (!isAuthenticatedRef.current) {
          checkAuth({ silent: true });
        }
      }
    },
    [handleRemoteLogout, checkAuth]
  );

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Synchronize auth state (especially logout) across all open tabs
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
      channelRef.current = channel;
      channel.onmessage = (event) => {
        processSyncPayload(event.data);
      };
    }

    const handleStorage = (event) => {
      if (event.key !== AUTH_SYNC_STORAGE_KEY || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue);
        processSyncPayload(payload);
      } catch {
        // Ignore malformed payloads
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const raw = localStorage.getItem(AUTH_SYNC_STORAGE_KEY);
        if (!raw) return;
        const payload = JSON.parse(raw);
        processSyncPayload(payload);
      } catch {
        // Ignore storage read errors
      }
    };

    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (channelRef.current) {
        channelRef.current.close();
        channelRef.current = null;
      }
    };
  }, [processSyncPayload]);

  // Login handler
  const login = async (password) => {
    setAuthError(null);
    try {
      const res = await fetch('/.netlify/functions/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });

      let data = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          data = await res.json();
        } catch {
          // ignore
        }
      }

      if (res.ok) {
        setIsAuthenticated(true);
        setLockedUntil(null);
        setAuthError(null);
        broadcastAuthEvent('LOGIN');
        return { success: true };
      }

      if (res.status === 500) {
        const msg = data.error || 'Server configuration error: missing ADMIN_PASSWORD or JWT_SECRET on Netlify.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

      if (res.status === 429) {
        setLockedUntil(data.lockedUntil || Date.now() + (data.remainingSeconds || 300) * 1000);
        setAuthError(data.error || 'Too many failed attempts. Try again later.');
        return { success: false, locked: true, remainingSeconds: data.remainingSeconds };
      }

      const msg = data.remainingAttempts != null
        ? `${data.error}. ${data.remainingAttempts} attempts remaining.`
        : (data.error || `Login failed (${res.status} ${res.statusText || 'Error'})`);

      setAuthError(msg);
      return { success: false, error: msg };
    } catch {
      const msg = 'Network error during login. Please try again.';
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  // Logout handler (clears session, notifies all tabs, and purges local offline database)
  const logout = async () => {
    // 1. Immediately abort any in-flight teacher sync requests and lock all other tabs
    abortOngoingSync();
    broadcastAuthEvent('LOGOUT');

    try {
      await fetch('/.netlify/functions/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Continue cleanup even if network request fails
    }

    try {
      // Wipe IndexedDB cache completely for maximum privacy
      await clearTeachersCache();
    } catch (err) {
      console.warn('Failed to clear teacher storage during logout:', err);
    }

    setIsAuthenticated(false);
    setAuthError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        authError,
        lockedUntil,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
