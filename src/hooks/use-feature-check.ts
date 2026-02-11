'use client';

import { useState, useEffect } from 'react';

interface FeatureStatus {
  featureId: string;
  featureName: string;
  featureDescription: string;
  priceMonthly: number;
  isFree: boolean;
  isActive: boolean;
}

export function useFeatureCheck(tenantId: string) {
  const [features, setFeatures] = useState<FeatureStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;

    fetch('/api/features', {
      headers: { 'x-tenant-id': tenantId },
    })
      .then((res) => res.json())
      .then((data) => {
        setFeatures(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tenantId]);

  const hasFeature = (featureId: string): boolean => {
    return features.some((f) => f.featureId === featureId && f.isActive);
  };

  return { features, loading, hasFeature };
}
