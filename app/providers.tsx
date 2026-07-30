'use client';

import { AppProvider } from '@/src/context/AppContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}
