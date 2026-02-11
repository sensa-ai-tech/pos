'use client';

import { useEffect, useState } from 'react';
import { FeatureGate } from '@/components/feature-gate';
import { FEATURES } from '@/lib/feature-ids';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function getTenantId(): string {
  if (typeof document === 'undefined') return '';
  const cookies = document.cookie.split(';').reduce((acc, c) => {
    const [key, val] = c.trim().split('=');
    acc[key] = val;
    return acc;
  }, {} as Record<string, string>);
  return cookies['tenant_id'] || '';
}

function AnalyticsContent() {
  // Simulated chart data using CSS divs
  const weekData = [
    { day: '週一', revenue: 12500, percentage: 65 },
    { day: '週二', revenue: 18200, percentage: 85 },
    { day: '週三', revenue: 9800, percentage: 50 },
    { day: '週四', revenue: 15600, percentage: 75 },
    { day: '週五', revenue: 21000, percentage: 95 },
    { day: '週六', revenue: 19500, percentage: 90 },
    { day: '週日', revenue: 16800, percentage: 80 },
  ];

  const topProducts = [
    { name: '招牌商品 A', sales: 156, revenue: 46800 },
    { name: '熱門商品 B', sales: 132, revenue: 39600 },
    { name: '推薦商品 C', sales: 98, revenue: 29400 },
    { name: '經典商品 D', sales: 87, revenue: 26100 },
    { name: '季節商品 E', sales: 65, revenue: 19500 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">數據分析</h1>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">本月營收</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">$113,400</p>
            <p className="text-xs text-green-600">+12.5% vs 上月</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">本月訂單</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">486</p>
            <p className="text-xs text-green-600">+8.2% vs 上月</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">客單價</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">$233</p>
            <p className="text-xs text-red-600">-2.1% vs 上月</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">回訪率</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">34.5%</p>
            <p className="text-xs text-green-600">+5.8% vs 上月</p>
          </CardContent>
        </Card>
      </div>

      {/* Bar chart using CSS */}
      <Card>
        <CardHeader>
          <CardTitle>7 日營收趨勢</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3" style={{ height: 200 }}>
            {weekData.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs text-neutral-500">${(d.revenue / 1000).toFixed(1)}k</span>
                <div
                  className="w-full rounded-t bg-blue-500 transition-all"
                  style={{ height: `${d.percentage}%` }}
                />
                <span className="text-xs">{d.day}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top products */}
      <Card>
        <CardHeader>
          <CardTitle>Top 5 暢銷商品</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{p.name}</p>
                  <div className="mt-1 h-2 rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-green-500"
                      style={{ width: `${(p.sales / topProducts[0].sales) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">{p.sales} 件</p>
                  <p className="text-xs text-neutral-500">${p.revenue.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AnalyticsPage() {
  const [tenantId, setTenantId] = useState('');

  useEffect(() => {
    setTenantId(getTenantId());
  }, []);

  if (!tenantId) return null;

  return (
    <FeatureGate
      tenantId={tenantId}
      featureId={FEATURES.ANALYTICS}
      featureName="數據分析"
      description="營收趨勢、商品分析、顧客洞察，用數據驅動決策"
      priceMonthly={599}
    >
      <AnalyticsContent />
    </FeatureGate>
  );
}
