import { useEffect, useState } from 'react';

/** True while the tab is visible and the window has focus. */
export function useIsWindowActive(): boolean {
  const [active, setActive] = useState(
    () => typeof document !== 'undefined' && document.hasFocus() && document.visibilityState === 'visible',
  );

  useEffect(() => {
    const update = () => {
      setActive(document.hasFocus() && document.visibilityState === 'visible');
    };
    update();
    window.addEventListener('focus', update);
    window.addEventListener('blur', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.removeEventListener('focus', update);
      window.removeEventListener('blur', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return active;
}
