'use client';

import ArchitectureView from '@/src/components/ArchitectureView';
import RequireAuth from '@/src/components/RequireAuth';

export default function DocenteArquitecturaPage() {
  return (
    <RequireAuth>
      <ArchitectureView />
    </RequireAuth>
  );
}
