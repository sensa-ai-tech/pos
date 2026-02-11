'use client';

import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
      <div className="text-center">
        <h2 className="mb-2 text-2xl font-bold">載入失敗</h2>
        <p className="mb-4 text-sm text-neutral-500">
          {error.message || '發生了未預期的錯誤，請重試'}
        </p>
        <Button onClick={reset}>重新載入</Button>
      </div>
    </div>
  );
}
