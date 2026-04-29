import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthCtx = createContext(null);

// Normalize user object so both old (uid/displayName) and new (user_id/display_name) fields work
function normalize(u) {
  if (!u) return null;
  const user_id = u.user_id || u.uid || u.username || '';
  return {
    ...u,
    user_id,
    display_name:   u.display_name  || u.displayName || '',
    uid:            user_id,
    displayName:    u.display_name  || u.displayName || '',
    username:       user_id,   // ← the missing alias that broke the @ display
    participant_id: u.participant_id || user_id,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('compiledoc_user');
      if (saved) setUser(normalize(JSON.parse(saved)));
    } catch {}
    setLoading(false);
  }, []);

  const login = (userData) => {
    const u = normalize(userData);
    setUser(u);
    try { sessionStorage.setItem('compiledoc_user', JSON.stringify(u)); } catch {}
  };

  const logout = () => {
    setUser(null);
    try { sessionStorage.removeItem('compiledoc_user'); } catch {}
  };

  return (
    <AuthCtx.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
