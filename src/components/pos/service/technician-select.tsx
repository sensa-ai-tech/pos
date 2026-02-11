'use client';

import { useState } from 'react';

interface TechnicianSelectProps {
  onSelect: (technician: string | null) => void;
}

const defaultTechnicians = [
  { id: 'tech-1', name: 'Amy' },
  { id: 'tech-2', name: 'Ben' },
  { id: 'tech-3', name: 'Cindy' },
  { id: 'tech-4', name: 'David' },
];

export function TechnicianSelect({ onSelect }: TechnicianSelectProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      <p className="mb-2 text-sm font-medium">指派技師</p>
      <select
        className="w-full rounded-md border border-neutral-200 p-2 text-sm"
        value={selected ?? ''}
        onChange={(e) => {
          const val = e.target.value || null;
          setSelected(val);
          onSelect(val);
        }}
      >
        <option value="">不指定</option>
        {defaultTechnicians.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
