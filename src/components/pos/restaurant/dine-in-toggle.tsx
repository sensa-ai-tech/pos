'use client';

import { cn } from '@/lib/utils';

interface DineInToggleProps {
  value: boolean;
  onChange: (isDineIn: boolean) => void;
}

export function DineInToggle({ value, onChange }: DineInToggleProps) {
  return (
    <div className="flex gap-2">
      <button
        className={cn(
          'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
          value ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-600'
        )}
        onClick={() => onChange(true)}
      >
        內用
      </button>
      <button
        className={cn(
          'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
          !value ? 'bg-orange-600 text-white' : 'bg-neutral-100 text-neutral-600'
        )}
        onClick={() => onChange(false)}
      >
        外帶
      </button>
    </div>
  );
}
