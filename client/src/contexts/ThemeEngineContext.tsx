import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ALL_THEMES, ThemeMode, getThemeById } from '../themes';

interface ThemeEngineState {
  themeMode: ThemeMode;
  colorMode: 'light' | 'dark';
  motionEnabled: boolean;
  showHeaderLogo: boolean;
  showHeaderWordmark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setColorMode: (mode: 'light' | 'dark') => void;
  setMotionEnabled: (enabled: boolean) => void;
  setShowHeaderLogo: (enabled: boolean) => void;
  setShowHeaderWordmark: (enabled: boolean) => void;
}

const THEME_STORAGE_KEY = 'uiThemeMode';
const COLOR_MODE_STORAGE_KEY = 'uiColorMode';
const MOTION_STORAGE_KEY = 'uiMotionEnabled';
const HEADER_LOGO_STORAGE_KEY = 'uiHeaderLogoVisible';
const HEADER_WORDMARK_STORAGE_KEY = 'uiHeaderWordmarkVisible';

const ThemeEngineContext = createContext<ThemeEngineState | undefined>(undefined);

const FALLBACK_THEME_ENGINE: ThemeEngineState = {
  themeMode: 'playful',
  colorMode: 'light',
  motionEnabled: false,
  showHeaderLogo: false,
  showHeaderWordmark: true,
  setThemeMode: () => {},
  setColorMode: () => {},
  setMotionEnabled: () => {},
  setShowHeaderLogo: () => {},
  setShowHeaderWordmark: () => {},
};

const getScopedPreferenceStorageKey = (baseKey: string, mode: ThemeMode) => `${baseKey}:${mode}`;

const readThemeScopedPreference = (
  mode: ThemeMode,
  baseKey: string,
  fallbackValue: boolean
) => {
  if (typeof window === 'undefined') {
    return fallbackValue;
  }

  const scopedValue = localStorage.getItem(getScopedPreferenceStorageKey(baseKey, mode));
  if (scopedValue !== null) {
    return scopedValue === 'true';
  }

  const legacyValue = localStorage.getItem(baseKey);
  if (legacyValue !== null) {
    return legacyValue === 'true';
  }

  return fallbackValue;
};

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
      return false;
    }
    return stored === 'true';
  });

  const [colorMode, setColorMode] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  });

  const [showHeaderLogo, setShowHeaderLogo] = useState<boolean>(() => {
    const initialTheme = getThemeById(themeMode);
    return readThemeScopedPreference(
      themeMode,
      HEADER_LOGO_STORAGE_KEY,
      initialTheme.headerPreferences.showLogoDefault
    );
  });

  const [showHeaderWordmark, setShowHeaderWordmark] = useState<boolean>(() => {
    const initialTheme = getThemeById(themeMode);
    return readThemeScopedPreference(
      themeMode,
      HEADER_WORDMARK_STORAGE_KEY,
      initialTheme.headerPreferences.showWordmarkDefault
    );
  });

  useEffect(() => {
    const theme = getThemeById(themeMode);
    setShowHeaderLogo(
      readThemeScopedPreference(
        themeMode,
        HEADER_LOGO_STORAGE_KEY,
        theme.headerPreferences.showLogoDefault
      )
    );
    setShowHeaderWordmark(
      readThemeScopedPreference(
        themeMode,
        HEADER_WORDMARK_STORAGE_KEY,
        theme.headerPreferences.showWordmarkDefault
      )
    );
  }, [themeMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const theme = getThemeById(themeMode);
    document.body.dataset.theme = themeMode;
    document.body.dataset.layout = theme.layoutMode;
    document.body.dataset.colorMode = colorMode;
    document.documentElement.setAttribute('data-theme', colorMode);
    document.body.classList.toggle('dark', colorMode === 'dark');
    
    // Inject CSS variables for the theme
    const root = document.documentElement;
    const tokens = theme.tokens[colorMode];
    
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
      const val = value as string;
      root.style.setProperty(`--${key}`, color(val));
      if (isHslTriplet(val)) {
        root.style.setProperty(`--${key}-raw`, val);
      }
    });

    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    localStorage.setItem(COLOR_MODE_STORAGE_KEY, colorMode);
  }, [themeMode, colorMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.body.dataset.motion = motionEnabled ? 'on' : 'off';
    localStorage.setItem(MOTION_STORAGE_KEY, String(motionEnabled));
  }, [motionEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(getScopedPreferenceStorageKey(HEADER_LOGO_STORAGE_KEY, themeMode), String(showHeaderLogo));
  }, [showHeaderLogo, themeMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(
      getScopedPreferenceStorageKey(HEADER_WORDMARK_STORAGE_KEY, themeMode),
      String(showHeaderWordmark)
    );
  }, [showHeaderWordmark, themeMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const selector = '[data-chip], .sticker, .wiggle-card';
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
      colorMode,
      motionEnabled,
      showHeaderLogo,
      showHeaderWordmark,
      setThemeMode,
      setColorMode,
      setMotionEnabled,
      setShowHeaderLogo,
      setShowHeaderWordmark,
    }),
    [themeMode, colorMode, motionEnabled, showHeaderLogo, showHeaderWordmark]
  );

  return <ThemeEngineContext.Provider value={value}>{children}</ThemeEngineContext.Provider>;
}

export function useThemeEngine() {
  const context = useContext(ThemeEngineContext);
  return context ?? FALLBACK_THEME_ENGINE;
}
