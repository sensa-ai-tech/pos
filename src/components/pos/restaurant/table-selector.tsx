'use client';

import { cn } from '@/lib/utils';

interface TableSelectorProps {
  value: number | null;
  onChange: (tableNumber: number | null) => void;
}

export function TableSelector({ value, onChange }: TableSelectorProps) {
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
              value === num
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-neutral-200 hover:border-neutral-400'
            )}
            onClick={() => {
              const val = value === num ? null : num;
              onChange(val);
            }}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );
}
