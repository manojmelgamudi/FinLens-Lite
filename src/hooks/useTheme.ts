import { useEffect, useState } from 'react';
import { ThemeMode } from '../types/finance';

const THEME_KEY = 'pf_theme_mode_v1';

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY) as ThemeMode | null;
      return saved || 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    const apply = (mode: ThemeMode) => {
      const root = document.documentElement;
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const useDark = mode === 'dark' || (mode === 'system' && prefersDark);
      root.classList.toggle('dark', useDark);

      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', useDark ? '#101216' : '#1677FF');
      }
    };

    apply(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (theme === 'system') apply('system');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  return { theme, setTheme: setThemeState };
}
