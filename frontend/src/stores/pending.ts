import { create } from 'zustand';

export interface PendingMessage {
  clientMessageId: string;
  roomId: string;
  content: string;
  createdAt: string;
  status: 'sending' | 'failed';
  error?: string;
}

interface PendingState {
  byRoom: Record<string, PendingMessage[]>;
  add: (message: PendingMessage) => void;
  fail: (roomId: string, clientMessageId: string, error: string) => void;
  markSending: (roomId: string, clientMessageId: string) => void;
  remove: (roomId: string, clientMessageId: string) => void;
  clearRoom: (roomId: string) => void;
}

export const usePendingStore = create<PendingState>((set) => ({
  byRoom: {},
  add: (message) =>
    set((state) => ({
      byRoom: {
        ...state.byRoom,
        [message.roomId]: [...(state.byRoom[message.roomId] ?? []), message],
      },
    })),
  fail: (roomId, clientMessageId, error) =>
    set((state) => ({
      byRoom: {
        ...state.byRoom,
        [roomId]: (state.byRoom[roomId] ?? []).map((message) =>
          message.clientMessageId === clientMessageId
            ? { ...message, status: 'failed', error }
            : message,
        ),
      },
    })),
  markSending: (roomId, clientMessageId) =>
    set((state) => ({
      byRoom: {
        ...state.byRoom,
        [roomId]: (state.byRoom[roomId] ?? []).map((message) =>
          message.clientMessageId === clientMessageId
            ? { ...message, status: 'sending', error: undefined }
            : message,
        ),
      },
    })),
  remove: (roomId, clientMessageId) =>
    set((state) => ({
      byRoom: {
        ...state.byRoom,
        [roomId]: (state.byRoom[roomId] ?? []).filter(
          (message) => message.clientMessageId !== clientMessageId,
        ),
      },
    })),
  clearRoom: (roomId) =>
    set((state) => {
      const next = { ...state.byRoom };
      delete next[roomId];
      return { byRoom: next };
    }),
}));
