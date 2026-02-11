'use client';

import { ReactNode } from 'react';
import { UpgradePrompt } from '@/components/upgrade-prompt';
import { useFeatureCheck } from '@/hooks/use-feature-check';

interface FeatureGateProps {
  tenantId: string;
  featureId: string;
  featureName: string;
  description?: string;
  priceMonthly?: number;
  children: ReactNode;
}

export function FeatureGate({
  tenantId,
  featureId,
  featureName,
  description,
  priceMonthly,
  children,
}: FeatureGateProps) {
  const { hasFeature, loading } = useFeatureCheck(tenantId);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
      </div>
    );
  }

  if (!hasFeature(featureId)) {
    return (
      <UpgradePrompt
        featureName={featureName}
        description={description}
        priceMonthly={priceMonthly}
      />
    );
  }

  return <>{children}</>;
}
