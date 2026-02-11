'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Barcode } from 'lucide-react';

interface BarcodeInputProps {
  onScan: (barcode: string) => void;
}

export function BarcodeInput({ onScan }: BarcodeInputProps) {
  const [value, setValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) {
      onScan(value.trim());
      setValue('');
    }
  };

  return (
    <div className="relative">
      <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
      <Input
        placeholder="掃描條碼或輸入商品編號..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="pl-10"
      />
    </div>
  );
}
