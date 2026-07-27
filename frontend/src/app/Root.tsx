import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from '@/components/ui/Toaster';
import { bootstrapSession } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth';
import { router } from '@/app/router';
import { SplashScreen } from '@/app/SplashScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export function Root() {
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    void bootstrapSession();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {status === 'loading' ? <SplashScreen /> : <RouterProvider router={router} />}
      <Toaster />
    </QueryClientProvider>
  );
}
