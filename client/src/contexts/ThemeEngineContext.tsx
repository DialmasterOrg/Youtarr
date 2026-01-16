import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'playful' | 'neumorphic';

interface ThemeEngineState {
  themeMode: ThemeMode;
  motionEnabled: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setMotionEnabled: (enabled: boolean) => void;
}

const THEME_STORAGE_KEY = 'uiThemeMode';
const MOTION_STORAGE_KEY = 'uiMotionEnabled';
const LEGACY_WIGGLE_KEY = 'uiWiggleEnabled';

const ThemeEngineContext = createContext<ThemeEngineState | undefined>(undefined);

export function ThemeEngineProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'playful';
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'neumorphic' ? 'neumorphic' : 'playful';
  });

  const [motionEnabled, setMotionEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(MOTION_STORAGE_KEY);
    if (stored === null) {
      return localStorage.getItem(LEGACY_WIGGLE_KEY) !== 'false';
    }
    return stored !== 'false';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.body.dataset.theme = themeMode;
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.body.dataset.motion = motionEnabled ? 'on' : 'off';
    localStorage.setItem(MOTION_STORAGE_KEY, String(motionEnabled));
  }, [motionEnabled]);

  const value = useMemo(
    () => ({
      themeMode,
      motionEnabled,
      setThemeMode,
      setMotionEnabled,
    }),
    [themeMode, motionEnabled]
  );

  return <ThemeEngineContext.Provider value={value}>{children}</ThemeEngineContext.Provider>;
}

export function useThemeEngine() {
  const context = useContext(ThemeEngineContext);
  if (!context) {
    throw new Error('useThemeEngine must be used within ThemeEngineProvider');
  }
  return context;
}
