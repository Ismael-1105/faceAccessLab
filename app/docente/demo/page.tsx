'use client';

import DemoView from '@/src/components/DemoView';
import RequireAuth from '@/src/components/RequireAuth';

export default function DocenteDemoPage() {
  return (
    <RequireAuth>
      <DemoView />
    </RequireAuth>
  );
}
