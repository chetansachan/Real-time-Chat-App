import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { refreshSession } from '@/lib/api/client';
import type { MessageDto, RoomSummary } from '@/lib/api/types';
import { queryKeys } from '@/lib/query/keys';
import {
  applyDeletedMessageToRooms,
  applyMessageToRooms,
  removeMessage,
  removeRoomFromList,
  upsertMessage,
  type MessagesData,
} from '@/lib/query/messages';
import type { MemberRemoved } from '@/lib/socket/events';
import { socket } from '@/lib/socket/socket';
import { useAuthStore } from '@/stores/auth';
import { useConnectionStore } from '@/stores/connection';
import { toast } from '@/stores/toast';
import { useUiStore } from '@/stores/ui';

/**
 * Owns the single Socket.IO connection for the authenticated session and
 * translates server events into TanStack Query cache updates.
 */
export function SocketBridge() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const activeRoomId = useUiStore((state) => state.activeRoomId);
  const activeRoomRef = useRef<string | null>(activeRoomId);

  useEffect(() => {
    activeRoomRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    let disposed = false;
    let refreshing = false;

    const recover = async () => {
      if (refreshing || disposed) return;
      refreshing = true;
      const session = await refreshSession();
      refreshing = false;
      if (disposed) return;
      if (!session) {
        useAuthStore.getState().clear();
        return;
      }
      if (socket.connected) socket.disconnect();
      socket.connect();
    };

    const onConnect = () => {
      if (disposed) return;
      useConnectionStore.getState().markConnected();
      void queryClient.invalidateQueries({ queryKey: queryKeys.rooms, exact: true });
    };

    const onDisconnect = (reason: string) => {
      if (disposed) return;
      useConnectionStore.getState().setStatus('offline');
      // The server closed the socket (e.g. deploy); reconnect manually.
      if (reason === 'io server disconnect') socket.connect();
    };

    const onConnectError = (error: Error) => {
      if (disposed) return;
      useConnectionStore.getState().setStatus(socket.active ? 'connecting' : 'offline');
      if (error.message === 'UNAUTHORIZED') void recover();
    };

    const onAuthExpired = () => {
      void recover();
    };

    const onMessage = (message: MessageDto) => {
      queryClient.setQueryData<MessagesData>(queryKeys.messages(message.roomId), (data) =>
        upsertMessage(data, message),
      );

      const me = useAuthStore.getState().user;
      const viewing = activeRoomRef.current === message.roomId && document.hasFocus();
      const incrementUnread = !viewing && message.senderId !== me?.id;

      const rooms = queryClient.getQueryData<RoomSummary[]>(queryKeys.rooms);
      if (rooms && !rooms.some((room) => room.id === message.roomId)) {
        // A room joined on another device: let the server supply the summary.
        void queryClient.invalidateQueries({ queryKey: queryKeys.rooms, exact: true });
        return;
      }

      queryClient.setQueryData<RoomSummary[]>(queryKeys.rooms, (current) =>
        applyMessageToRooms(current, message, incrementUnread),
      );
    };

    const onMessageDeleted = (payload: { roomId: string; messageId: string }) => {
      queryClient.setQueryData<MessagesData>(queryKeys.messages(payload.roomId), (data) =>
        removeMessage(data, payload.messageId),
      );
      queryClient.setQueryData<RoomSummary[]>(queryKeys.rooms, (rooms) =>
        applyDeletedMessageToRooms(rooms, payload.roomId, payload.messageId),
      );
    };

    const onMemberRemoved = (payload: MemberRemoved) => {
      const me = useAuthStore.getState().user;
      if (payload.userId === me?.id) {
        queryClient.setQueryData<RoomSummary[]>(queryKeys.rooms, (rooms) =>
          removeRoomFromList(rooms, payload.roomId),
        );
        queryClient.removeQueries({ queryKey: queryKeys.messages(payload.roomId) });
        toast.error(
          payload.reason === 'banned' ? 'You were banned from this room' : 'You were removed from this room',
        );
        if (activeRoomRef.current === payload.roomId) {
          navigate('/', { replace: true });
        }
        return;
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.room(payload.roomId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rooms, exact: true });
    };

    const onMembershipChanged = (payload: { roomId: string }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.room(payload.roomId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rooms, exact: true });
    };

    const onMuted = () => {
      const roomId = activeRoomRef.current;
      if (roomId) void queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId) });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('auth:expired', onAuthExpired);
    socket.on('message:new', onMessage);
    socket.on('message:deleted', onMessageDeleted);
    socket.on('room:member-removed', onMemberRemoved);
    socket.on('room:member-joined', onMembershipChanged);
    socket.on('room:member-left', onMembershipChanged);
    socket.on('room:member-muted', onMuted);

    useConnectionStore.getState().setStatus('connecting');
    if (!socket.connected) socket.connect();

    return () => {
      disposed = true;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('auth:expired', onAuthExpired);
      socket.off('message:new', onMessage);
      socket.off('message:deleted', onMessageDeleted);
      socket.off('room:member-removed', onMemberRemoved);
      socket.off('room:member-joined', onMembershipChanged);
      socket.off('room:member-left', onMembershipChanged);
      socket.off('room:member-muted', onMuted);
      socket.disconnect();
      useConnectionStore.getState().setStatus('idle');
    };
  }, [queryClient, navigate]);

  return null;
}
