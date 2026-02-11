'use client';

import { Menu } from 'lucide-react';

interface TopBarProps {
  tenantName: string;
  onMenuClick: () => void;
}

export function TopBar({ tenantName, onMenuClick }: TopBarProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-white px-4">
      <button className="md:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex-1" />
      <span className="text-sm text-neutral-600">{tenantName}</span>
    </header>
  );
}
