import React, { useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';
import { DashboardDataProvider } from './hooks/useDashboardData.js';
import { createAppRouter } from './router.js';

export default function App() {
  const router = useMemo(() => createAppRouter(), []);
  return (
    <DashboardDataProvider>
      <RouterProvider router={router} />
    </DashboardDataProvider>
  );
}
