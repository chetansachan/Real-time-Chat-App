import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui/Button';

type Theme = 'light' | 'dark';

function readTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    const dark = theme === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    try {
      localStorage.setItem('relay-theme', theme);
    } catch {
      // Storage can be unavailable in private mode; the toggle still works.
    }
  }, [theme]);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
    </Button>
  );
}
