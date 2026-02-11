'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Check } from 'lucide-react';
import type { FeatureInfo } from '@/types';
import { getClientTenantId } from '@/hooks/use-tenant';

const plans = [
  {
    name: '免費版',
    price: 0,
    description: '基礎 POS 收銀功能',
    features: ['POS 收銀', '基礎庫存管理', '訂單管理'],
    current: true,
  },
  {
    name: '專業版',
    price: 799,
    description: '適合成長中的店家',
    features: ['所有免費版功能', '顧客管理 (CRM)', '員工管理', '進階報表'],
    popular: true,
  },
  {
    name: '企業版',
    price: 1499,
    description: '完整功能，無限制',
    features: ['所有專業版功能', '數據分析', '多店管理', '忠誠度計畫', 'API 存取'],
  },
];

export default function SubscriptionPage() {
  const [tenantId, setTenantId] = useState('');
  const [features, setFeatures] = useState<FeatureInfo[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const tid = getClientTenantId();
    setTenantId(tid);
    if (tid) {
      fetch('/api/features', { headers: { 'x-tenant-id': tid } })
        .then((r) => r.json())
        .then(setFeatures)
        .catch((error) => {
          console.error('Failed to fetch subscription features:', error);
          setError('無法載入訂閱資料');
        });
    }
  }, []);

  const handleActivate = async (featureId: string) => {
    setLoading(featureId);
    try {
      const res = await fetch('/api/features/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({ featureId }),
      });

      if (res.ok) {
        setFeatures((prev) =>
          prev.map((f) => (f.featureId === featureId ? { ...f, isActive: true } : f))
        );
        toast({ title: '功能已啟用', description: '模組已成功解鎖' });
      }
    } catch (error) {
      console.error('Failed to activate feature:', error);
      toast({ title: '啟用失敗', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const handleDeactivate = async (featureId: string) => {
    setLoading(featureId);
    try {
      const res = await fetch('/api/features/deactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({ featureId }),
      });

      if (res.ok) {
        setFeatures((prev) =>
          prev.map((f) => (f.featureId === featureId ? { ...f, isActive: false } : f))
        );
        toast({ title: '功能已停用' });
      }
    } catch (error) {
      console.error('Failed to deactivate feature:', error);
      toast({ title: '停用失敗', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">訂閱管理</h1>
        <p className="text-sm text-neutral-500">選擇適合您的方案，或單獨購買模組</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Plans */}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={plan.popular ? 'border-2 border-blue-500' : ''}
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>{plan.name}</CardTitle>
                {plan.popular && <Badge>最受歡迎</Badge>}
                {plan.current && <Badge variant="secondary">目前方案</Badge>}
              </div>
              <p className="text-sm text-neutral-500">{plan.description}</p>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <span className="text-3xl font-bold">
                  {plan.price === 0 ? '免費' : `NT$${plan.price}`}
                </span>
                {plan.price > 0 && (
                  <span className="text-sm text-neutral-500">/月</span>
                )}
              </div>
              <ul className="mb-4 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant={plan.current ? 'outline' : 'default'}
                disabled={plan.current}
              >
                {plan.current ? '目前方案' : '升級方案'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Individual modules */}
      <div>
        <h2 className="mb-4 text-xl font-bold">單獨模組</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {features
            .filter((f) => !f.isFree)
            .map((f) => (
              <Card key={f.featureId}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1">
                    <p className="font-medium">{f.featureName}</p>
                    <p className="text-xs text-neutral-500">{f.featureDescription}</p>
                    <p className="mt-1 text-sm font-semibold">
                      NT${f.priceMonthly}/月
                    </p>
                  </div>
                  {f.isActive ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loading === f.featureId}
                      onClick={() => handleDeactivate(f.featureId)}
                    >
                      {loading === f.featureId ? '處理中...' : '停用'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={loading === f.featureId}
                      onClick={() => handleActivate(f.featureId)}
                    >
                      {loading === f.featureId ? '處理中...' : '啟用'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
}
