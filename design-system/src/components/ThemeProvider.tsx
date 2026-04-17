'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { theme, type Theme } from '../theme';

const ThemeContext = createContext<Theme | null>(null);

export type ColorMode = 'light' | 'dark';

type ColorModeContextValue = {
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;
};

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

const STORAGE_KEY = 'yamma-color-mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>('dark');
  const [hydrated, setHydrated] = useState(false);

  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        setColorModeState(stored);
        document.documentElement.setAttribute('data-theme', stored);
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    } catch {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.setAttribute('data-theme', colorMode);
    try {
      localStorage.setItem(STORAGE_KEY, colorMode);
    } catch {
      /* ignore */
    }
  }, [colorMode, hydrated]);

  const setColorMode = useCallback((mode: ColorMode) => {
    setColorModeState(mode);
  }, []);

  const toggleColorMode = useCallback(() => {
    setColorModeState((c) => (c === 'dark' ? 'light' : 'dark'));
  }, []);

  const colorValue: ColorModeContextValue = {
    colorMode,
    setColorMode,
    toggleColorMode,
  };

  return (
    <ThemeContext.Provider value={theme}>
      <ColorModeContext.Provider value={colorValue}>
        <div className="min-h-screen bg-[var(--yamma-bg)] text-[var(--yamma-text)]">{children}</div>
      </ColorModeContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export function useColorMode(): ColorModeContextValue {
  const ctx = useContext(ColorModeContext);
  if (!ctx) throw new Error('useColorMode must be used within ThemeProvider');
  return ctx;
}
