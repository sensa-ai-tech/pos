'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface TableSelectorProps {
  onSelect: (tableNumber: number | null) => void;
}

export function TableSelector({ onSelect }: TableSelectorProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const tables = Array.from({ length: 20 }, (_, i) => i + 1);

  return (
    <div>
      <p className="mb-2 text-sm font-medium">選擇桌號</p>
      <div className="grid grid-cols-5 gap-2">
        {tables.map((num) => (
          <button
            key={num}
            className={cn(
              'rounded-md border p-2 text-sm font-medium transition-colors',
              selected === num
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-neutral-200 hover:border-neutral-400'
            )}
            onClick={() => {
              const val = selected === num ? null : num;
              setSelected(val);
              onSelect(val);
            }}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );
}
