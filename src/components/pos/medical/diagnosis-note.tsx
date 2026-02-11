'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';

interface DiagnosisNoteProps {
  onChange: (note: string) => void;
}

export function DiagnosisNote({ onChange }: DiagnosisNoteProps) {
  const [note, setNote] = useState('');

  return (
    <div>
      <Label htmlFor="diagnosis">診療備註</Label>
      <textarea
        id="diagnosis"
        className="mt-1 w-full rounded-md border border-neutral-200 p-2 text-sm focus:border-neutral-400 focus:outline-none"
        rows={3}
        placeholder="輸入診療備註..."
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          onChange(e.target.value);
        }}
      />
    </div>
  );
}
