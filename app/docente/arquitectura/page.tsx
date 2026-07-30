'use client';

import { useApp } from '@/src/context/AppContext';
import ArchitectureView from '@/src/components/ArchitectureView';

export default function DocenteArquitecturaPage() {
  const { user } = useApp();

  if (!user) {
    return (
      <div className="pt-20 p-8 text-center">
        <p className="text-zinc-500">Debes iniciar sesión para acceder.</p>
      </div>
    );
  }

  return <ArchitectureView />;
}
