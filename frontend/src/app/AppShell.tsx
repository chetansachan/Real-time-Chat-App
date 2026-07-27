import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { Sidebar } from '@/features/rooms/Sidebar';
import { useRooms } from '@/features/rooms/queries';
import { cn } from '@/lib/utils/cn';

export function AppShell() {
  const location = useLocation();
  const isRoot = location.pathname === '/';
  const rooms = useRooms();

  const unread = rooms.data?.reduce((total, room) => total + room.unreadCount, 0) ?? 0;

  useEffect(() => {
    document.title =
      unread > 0 ? `(${unread > 99 ? '99+' : unread}) Relay` : 'Relay — real-time chat';
  }, [unread]);

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <Sidebar className={cn('w-full shrink-0 md:w-[336px]', isRoot ? 'flex' : 'hidden md:flex')} />
      <main className={cn('relative min-h-0 min-w-0 flex-1', isRoot ? 'hidden md:flex' : 'flex')}>
        <Outlet />
      </main>
      <ConnectionBanner />
    </div>
  );
}
