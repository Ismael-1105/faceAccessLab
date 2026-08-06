'use client';

import AdminView from '@/src/components/AdminView';
import RequireAuth from '@/src/components/RequireAuth';

export default function DocentePage() {
  return (
    <RequireAuth>
      <AdminView />
    </RequireAuth>
  );
}
