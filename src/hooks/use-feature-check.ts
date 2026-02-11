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
  const [error, setError] = useState<string | null>(null);

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
      .catch((error) => {
        console.error('Failed to load features:', error);
        setError('無法載入功能設定');
        setLoading(false);
      });
  }, [tenantId]);

  const hasFeature = (featureId: string): boolean => {
    return features.some((f) => f.featureId === featureId && f.isActive);
  };

  return { features, loading, error, hasFeature };
}
