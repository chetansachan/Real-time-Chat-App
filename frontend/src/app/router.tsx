import { createBrowserRouter } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { ChatView } from '@/features/chat/ChatView';
import { EmptyChat } from '@/features/rooms/EmptyChat';
import { ExplorePage } from '@/features/rooms/ExplorePage';
import { SocketBridge } from '@/lib/socket/SocketBridge';
import { AppShell } from './AppShell';
import { NotFoundPage } from './NotFoundPage';
import { GuestOnly, RequireAuth } from './guards';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <GuestOnly>
        <LoginPage />
      </GuestOnly>
    ),
  },
  {
    path: '/register',
    element: (
      <GuestOnly>
        <RegisterPage />
      </GuestOnly>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <SocketBridge />
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <EmptyChat /> },
      { path: 'rooms/:roomId', element: <ChatView /> },
      { path: 'explore', element: <ExplorePage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
