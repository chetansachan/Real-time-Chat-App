import { create } from 'zustand';

interface UiState {
  activeRoomId: string | null;
  setActiveRoomId: (roomId: string | null) => void;
}

/** Tracks the room currently on screen so socket handlers can route unread badges. */
export const useUiStore = create<UiState>((set) => ({
  activeRoomId: null,
  setActiveRoomId: (activeRoomId) => set({ activeRoomId }),
}));
