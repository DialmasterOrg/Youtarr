import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ALL_THEMES, ThemeMode, getThemeById } from '../themes';

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
    return stored && stored in ALL_THEMES ? (stored as ThemeMode) : 'playful';
  });

  const [motionEnabled, setMotionEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(MOTION_STORAGE_KEY);
    if (stored === null) {
      // Default to false now as requested, but respect legacy wiggle if it was specifically set to true?
      // Actually user said: "I want... the default animation to be off."
      const legacy = localStorage.getItem(LEGACY_WIGGLE_KEY);
      if (legacy === 'true') return true;
      return false;
    }
    return stored === 'true';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const theme = getThemeById(themeMode);
    document.body.dataset.theme = themeMode;
    document.body.dataset.layout = theme.layoutMode;
    
    // Inject CSS variables for the theme
    const root = document.documentElement;
    const mode = document.body.classList.contains('dark') ? 'dark' : 'light';
    const tokens = theme.tokens[mode];
    
    const isHslTriplet = (val: string) =>
      /^-?[\d.]+\s+-?[\d.]+%\s+-?[\d.]+%$/.test(val.trim());

    const color = (val: string) => {
      if (
        val.includes('hsl') ||
        val.includes('#') ||
        val.includes('rgb') ||
        val.includes('var(') ||
        val.includes('gradient') ||
        val.includes('px') ||
        val.includes('rem') ||
        val.includes('ms') ||
        val.includes('deg') ||
        val.includes('cubic-bezier') ||
        val.includes('shadow') ||
        val.includes('(')
      ) {
        return val;
      }

      return isHslTriplet(val) ? `hsl(${val})` : val;
    };

    Object.entries(tokens).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, color(value as string));
    });

    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.body.dataset.motion = motionEnabled ? 'on' : 'off';
    localStorage.setItem(MOTION_STORAGE_KEY, String(motionEnabled));
  }, [motionEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const selector = '.MuiChip-root, .sticker, .wiggle-card';
    const tiltOptions = [-2, 2];

    const applyTilt = (element: HTMLElement) => {
      if (themeMode !== 'playful' || !motionEnabled) {
        element.style.setProperty('--sticker-tilt', '0deg');
        return;
      }

      if (!element.dataset.stickerTilt) {
        const tilt = tiltOptions[Math.floor(Math.random() * tiltOptions.length)];
        element.dataset.stickerTilt = String(tilt);
      }

      element.style.setProperty('--sticker-tilt', `${element.dataset.stickerTilt}deg`);
    };

    const applyAllTilts = () => {
      document.querySelectorAll(selector).forEach((node) => {
        applyTilt(node as HTMLElement);
      });
    };

    applyAllTilts();

    const observer = new MutationObserver(() => {
      applyAllTilts();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [themeMode, motionEnabled]);

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
