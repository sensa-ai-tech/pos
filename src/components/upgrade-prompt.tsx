'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UpgradePromptProps {
  featureName: string;
  description?: string;
  priceMonthly?: number;
}

export function UpgradePrompt({ featureName, description, priceMonthly }: UpgradePromptProps) {
  const router = useRouter();

  return (
    <Card className="mx-auto max-w-md border-dashed">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
          <Lock className="h-6 w-6 text-neutral-400" />
        </div>
        <CardTitle className="text-lg">{featureName}</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        {description && (
          <p className="mb-4 text-sm text-neutral-500">{description}</p>
        )}
        {priceMonthly !== undefined && priceMonthly > 0 && (
          <p className="mb-4 text-2xl font-bold">
            NT${priceMonthly}
            <span className="text-sm font-normal text-neutral-500">/月</span>
          </p>
        )}
        <Button onClick={() => router.push('/subscription')} className="w-full">
          升級方案
        </Button>
      </CardContent>
    </Card>
  );
}
