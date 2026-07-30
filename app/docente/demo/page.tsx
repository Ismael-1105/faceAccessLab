'use client';

import { useApp } from '@/src/context/AppContext';
import DemoView from '@/src/components/DemoView';

export default function DocenteDemoPage() {
  const { user } = useApp();

  if (!user) {
    return (
      <div className="pt-20 p-8 text-center">
        <p className="text-zinc-500">Debes iniciar sesión para acceder.</p>
      </div>
    );
  }

  return <DemoView />;
}
