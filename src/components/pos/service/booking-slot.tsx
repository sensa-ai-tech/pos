'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface BookingSlotProps {
  onSelect: (time: string | null) => void;
}

const timeSlots = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
];

export function BookingSlot({ onSelect }: BookingSlotProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      <p className="mb-2 text-sm font-medium">預約時段</p>
      <div className="grid grid-cols-6 gap-1">
        {timeSlots.map((time) => (
          <button
            key={time}
            className={cn(
              'rounded border px-2 py-1 text-xs transition-colors',
              selected === time
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-neutral-200 hover:border-neutral-400'
            )}
            onClick={() => {
              const val = selected === time ? null : time;
              setSelected(val);
              onSelect(val);
            }}
          >
            {time}
          </button>
        ))}
      </div>
    </div>
  );
}
