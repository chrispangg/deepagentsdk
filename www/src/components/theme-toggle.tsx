'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="w-9 h-9 flex items-center justify-center border border-[var(--home-border-secondary)] bg-[var(--home-bg-card)] text-[var(--home-text-muted)] transition-colors">
        <span className="sr-only">Toggle theme</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="w-9 h-9 flex items-center justify-center border border-[var(--home-border-secondary)] bg-[var(--home-bg-card)] text-[var(--home-text-muted)] hover:text-[var(--home-text-primary)] hover:border-[var(--home-border-accent)] transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M8 12C10.2091 12 12 10.2091 12 8C12 5.79086 10.2091 4 8 4C5.79086 4 4 5.79086 4 8C4 10.2091 5.79086 12 8 12Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="square"
          />
          <path d="M8 1V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
          <path d="M8 14V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
          <path d="M15 8H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
          <path d="M2 8H1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
          <path d="M13.5 2.5L12.7 3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
          <path d="M3.3 12.7L2.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
          <path d="M13.5 13.5L12.7 12.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
          <path d="M3.3 3.3L2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M14 8.5C13.4 10.4 11.5 12 9 12C6.2 12 4 9.8 4 7C4 4.5 5.6 2.6 7.5 2C7.2 2.3 7 2.6 7 3C7 4.1 7.9 5 9 5C9.4 5 9.8 4.8 10 4.5C10.4 5.1 11 5.5 11.5 5.8C12.5 6.4 13.6 7.2 14 8.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </svg>
      )}
    </button>
  );
}
