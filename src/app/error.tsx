'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-2 text-4xl font-bold">系統錯誤</h1>
        <p className="mb-4 text-neutral-500">
          {error.message || '發生了未預期的錯誤'}
        </p>
        <Button onClick={reset}>重試</Button>
      </div>
    </div>
  );
}
