'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RfqProvider } from './rfq/rfq-context';
import { RfqModal } from './rfq/rfq-modal';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <RfqProvider>
        {children}
        <RfqModal />
      </RfqProvider>
    </QueryClientProvider>
  );
}
