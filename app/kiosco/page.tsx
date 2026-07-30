'use client';

import { useRouter } from 'next/navigation';
import { useApp } from '@/src/context/AppContext';
import StudentView from '@/src/components/StudentView';
import CameraPermissionGate from '@/src/components/CameraPermissionGate';
import { useEffect, useState } from 'react';

export default function KioscoPage() {
  const {
    hasCameraPermission,
    setHasCameraPermission,
    setShowPermissionGate,
    showPermissionGate,
    logs,
    students,
    handleAddLog,
    handleIncrementStats,
  } = useApp();
  const router = useRouter();
  const [gateShown, setGateShown] = useState(false);

  useEffect(() => {
    if (!gateShown) {
      setShowPermissionGate(true);
      setGateShown(true);
    }
  }, []);

  if (showPermissionGate) {
    return (
      <CameraPermissionGate
        onProceed={() => {
          setShowPermissionGate(false);
          setHasCameraPermission(true);
        }}
        onCancel={() => {
          setShowPermissionGate(false);
        }}
      />
    );
  }

  return (
    <StudentView
      students={students}
      logs={logs}
      onAddLog={handleAddLog}
      incrementStats={handleIncrementStats}
      onBackToLanding={() => router.back()}
      hasCameraPermission={hasCameraPermission}
    />
  );
}
