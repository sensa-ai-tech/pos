'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { Toaster } from '@/components/ui/toaster';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenantName, setTenantName] = useState('OneKey POS');

  useEffect(() => {
    // Read tenant info from cookie
    const cookies = document.cookie.split(';').reduce((acc, c) => {
      const [key, ...rest] = c.trim().split('=');
      acc[key] = rest.join('=');
      return acc;
    }, {} as Record<string, string>);

    if (cookies['tenant_name']) {
      // Fully decode (handles single or double encoding from older cookies)
      let decoded = cookies['tenant_name'];
      try {
        while (decoded !== decodeURIComponent(decoded)) {
          decoded = decodeURIComponent(decoded);
        }
      } catch {
        // already fully decoded or invalid encoding
      }
      setTenantName(decoded);
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
