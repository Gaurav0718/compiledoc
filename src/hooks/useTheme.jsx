import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSetting, setSetting } from '../db/database';

const ThemeCtx = createContext({ theme: 'light', toggle: () => {} });

export function ThemeProvider({ children, uid }) {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const apply = (t) => {
      setTheme(t);
      document.documentElement.setAttribute('data-theme', t);
    };
    if (uid) {
      getSetting(uid, 'theme', 'light').then(apply);
    } else {
      try {
        const t = localStorage.getItem('cd_theme') || 'light';
        apply(t);
      } catch { apply('light'); }
    }
  }, [uid]);

  const toggle = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('cd_theme', next); } catch {}
    if (uid) await setSetting(uid, 'theme', next);
  };

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
