import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

const readStoredJson = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
};

// oxlint-disable-next-line react/only-export-components -- colocated app context hook
export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('dg_logged_in') === 'true';
  });
  
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('dg_theme') || 'dark'; // Dark mode is default matching premium dark UI
  });

  const [sensitivity, setSensitivity] = useState(() => {
    const saved = localStorage.getItem('dg_sensitivity');
    const parsed = Number.parseFloat(saved);
    return Number.isFinite(parsed) ? Math.min(0.95, Math.max(0.05, parsed)) : 0.38;
  });

  const [alvinModel, setAlvinModel] = useState(() => {
    return localStorage.getItem('dg_alvin_model') || 'B4';
  });

  const [fawwasModel, setFawwasModel] = useState(() => {
    return localStorage.getItem('dg_fawwas_model') || 'rerec_knn_5';
  });

  const [defaultResearcher, setDefaultResearcher] = useState(() => {
    return localStorage.getItem('dg_default_researcher') || 'alvin';
  });

  const [history, setHistory] = useState(() => readStoredJson('dg_history', []));

  const [user, setUser] = useState(() => readStoredJson(
    'dg_user',
    { name: 'Analis Forensik', id: 'DG-7782' },
  ));

  // Keep HTML root class in sync with theme for CSS styling
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('dg_theme', theme);
  }, [theme]);

  // Persist history changes
  useEffect(() => {
    localStorage.setItem('dg_history', JSON.stringify(history));
  }, [history]);

  // Persist sensitivity
  useEffect(() => {
    localStorage.setItem('dg_sensitivity', sensitivity.toString());
  }, [sensitivity]);

  // Persist researcher model choices
  useEffect(() => {
    localStorage.setItem('dg_alvin_model', alvinModel);
  }, [alvinModel]);

  useEffect(() => {
    localStorage.setItem('dg_fawwas_model', fawwasModel);
  }, [fawwasModel]);

  useEffect(() => {
    localStorage.setItem('dg_default_researcher', defaultResearcher);
  }, [defaultResearcher]);

  const login = (email) => {
    setIsLoggedIn(true);
    localStorage.setItem('dg_logged_in', 'true');
    const defaultUser = { name: 'Analis Forensik', id: 'DG-7782', email };
    setUser(defaultUser);
    localStorage.setItem('dg_user', JSON.stringify(defaultUser));
  };

  const register = (name, email) => {
    const newUser = { name, id: `DG-${Math.floor(1000 + Math.random() * 9000)}`, email };
    setUser(newUser);
    localStorage.setItem('dg_user', JSON.stringify(newUser));
    setIsLoggedIn(true);
    localStorage.setItem('dg_logged_in', 'true');
  };

  const logout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('dg_logged_in');
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const addHistory = (item) => {
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      analyzedAt: new Date().toISOString(),
      ...item
    };
    setHistory(prev => [newItem, ...prev]);
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const resolvedBackendUrl = (() => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    if (typeof window !== 'undefined' && window.location.origin && window.location.port !== '5173') {
      return window.location.origin;
    }
    return 'http://127.0.0.1:5001';
  })();

  const value = {
    isLoggedIn,
    theme,
    sensitivity,
    alvinModel,
    setAlvinModel,
    fawwasModel,
    setFawwasModel,
    defaultResearcher,
    setDefaultResearcher,
    history,
    user,
    login,
    register,
    logout,
    toggleTheme,
    setSensitivity,
    addHistory,
    clearHistory,
    backendUrl: resolvedBackendUrl
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
