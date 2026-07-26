import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { socket } from '@/lib/socket/socket';
import { useAuthStore } from '@/stores/auth';
import { useConnectionStore } from '@/stores/connection';
import { usePendingStore } from '@/stores/pending';
import { logoutRequest } from './api';

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: logoutRequest,
    onSettled: () => {
      socket.disconnect();
      useAuthStore.getState().clear();
      useConnectionStore.getState().setStatus('idle');
      usePendingStore.setState({ byRoom: {} });
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });
}
