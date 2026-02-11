'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { Toaster } from '@/components/ui/toaster';
import { getClientTenantName } from '@/hooks/use-tenant';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenantName, setTenantName] = useState('OneKey POS');

  useEffect(() => {
    const name = getClientTenantName();
    if (name) {
      setTenantName(name);
    }
  }, []);

  return (
    <div className="flex h-screen bg-neutral-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          tenantName={tenantName}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
