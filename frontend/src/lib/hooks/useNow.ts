import { useSyncExternalStore } from 'react';

const TICK_MS = 30_000;

let currentTime = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function emit() {
  currentTime = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  currentTime = Date.now();
  listeners.add(listener);
  if (timer === null) timer = setInterval(emit, TICK_MS);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot() {
  return currentTime;
}

/**
 * A shared clock for time-dependent rendering (mute expiry, relative labels).
 * Reading `Date.now()` during render is impure, so components subscribe to
 * this low-frequency store instead.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
