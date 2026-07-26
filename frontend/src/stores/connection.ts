import { create } from 'zustand';

export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'offline';

interface ConnectionState {
  status: ConnectionStatus;
  /** Increments on every successful connect; consumers use it to catch up. */
  epoch: number;
  lastConnectedAt: number | null;
  setStatus: (status: ConnectionStatus) => void;
  markConnected: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'idle',
  epoch: 0,
  lastConnectedAt: null,
  setStatus: (status) => set({ status }),
  markConnected: () =>
    set((state) => ({
      status: 'online',
      epoch: state.epoch + 1,
      lastConnectedAt: Date.now(),
    })),
}));
