'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface DineInToggleProps {
  onChange: (isDineIn: boolean) => void;
}

export function DineInToggle({ onChange }: DineInToggleProps) {
  const [isDineIn, setIsDineIn] = useState(true);

  const toggle = (val: boolean) => {
    setIsDineIn(val);
    onChange(val);
  };

  return (
    <div className="flex gap-2">
      <button
        className={cn(
          'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
          isDineIn ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-600'
        )}
        onClick={() => toggle(true)}
      >
        內用
      </button>
      <button
        className={cn(
          'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
          !isDineIn ? 'bg-orange-600 text-white' : 'bg-neutral-100 text-neutral-600'
        )}
        onClick={() => toggle(false)}
      >
        外帶
      </button>
    </div>
  );
}
