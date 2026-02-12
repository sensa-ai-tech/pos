'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Lock, TrendingUp, DollarSign, ShoppingCart, Clock } from 'lucide-react';
import { getClientTenantId } from '@/hooks/use-tenant';

interface AnalyticsData {
  period: { days: number; since: string };
  summary: {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
  };
  revenueByDay: Array<{ date: string; revenue: number; orderCount: number }>;
  paymentBreakdown: Array<{ method: string; count: number; total: number }>;
  topProducts: Array<{ productName: string; totalQty: number; totalRevenue: number }>;
  hourlyDistribution: Array<{ hour: number; count: number }>;
}

const paymentLabels: Record<string, string> = {
  cash: '現金',
  card: '刷卡',
  transfer: '轉帳',
  other: '其他',
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tenantId = getClientTenantId('tenant-a');
    setLoading(true);
    fetch(`/api/analytics?days=${days}`, { headers: { 'x-tenant-id': tenantId } })
      .then(async (r) => {
        if (r.status === 403) {
          setLocked(true);
          return;
        }
        if (!r.ok) throw new Error('Failed to load');
        const result = await r.json();
        setData(result);
      })
      .catch(() => setError('無法載入分析資料'))
      .finally(() => setLoading(false));
  }, [days]);

  if (locked) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Lock className="mb-4 h-12 w-12 text-neutral-300" />
        <h2 className="text-xl font-bold mb-2">數據分析</h2>
        <p className="text-neutral-500 mb-4">此功能需要數據分析模組（NT$599/月）</p>
        <Button onClick={() => window.location.href = '/subscription'}>
          查看訂閱方案
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-20 text-center">
        {error && <p className="text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          數據分析
        </h1>
        <div className="flex gap-2">
          {[7, 14, 30, 90].map((d) => (
            <Button
              key={d}
              variant={days === d ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDays(d)}
            >
              {d} 天
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
            <DollarSign className="h-4 w-4" />
            總營收
          </div>
          <p className="text-2xl font-bold">${Math.round(data.summary.totalRevenue).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
            <ShoppingCart className="h-4 w-4" />
            訂單數
          </div>
          <p className="text-2xl font-bold">{data.summary.totalOrders}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
            <TrendingUp className="h-4 w-4" />
            平均客單價
          </div>
          <p className="text-2xl font-bold">${Math.round(data.summary.avgOrderValue)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Payment Breakdown */}
        <div className="rounded-lg border bg-white p-4">
          <h3 className="font-semibold mb-3">付款方式分佈</h3>
          {data.paymentBreakdown.length === 0 ? (
            <p className="text-sm text-neutral-400">無資料</p>
          ) : (
            <div className="space-y-2">
              {data.paymentBreakdown.map((p) => {
                const percentage = data.summary.totalOrders > 0
                  ? Math.round((p.count / data.summary.totalOrders) * 100)
                  : 0;
                return (
                  <div key={p.method} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{paymentLabels[p.method] || p.method}</span>
                      <Badge variant="secondary">{p.count} 筆</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-neutral-100 rounded-full h-2">
                        <div
                          className="bg-neutral-900 rounded-full h-2"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-neutral-500 w-12 text-right">{percentage}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Products */}
        <div className="rounded-lg border bg-white p-4">
          <h3 className="font-semibold mb-3">熱銷商品 Top 10</h3>
          {data.topProducts.length === 0 ? (
            <p className="text-sm text-neutral-400">無資料</p>
          ) : (
            <div className="space-y-2">
              {data.topProducts.map((p, idx) => (
                <div key={p.productName} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-right text-neutral-400">{idx + 1}.</span>
                    <span>{p.productName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-neutral-500">{p.totalQty} 個</span>
                    <span className="font-medium">${Math.round(p.totalRevenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hourly Distribution */}
      <div className="rounded-lg border bg-white p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          營業時段分佈
        </h3>
        {data.hourlyDistribution.length === 0 ? (
          <p className="text-sm text-neutral-400">無資料</p>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {Array.from({ length: 24 }, (_, i) => {
              const hourData = data.hourlyDistribution.find(h => h.hour === i);
              const count = hourData?.count ?? 0;
              const maxCount = Math.max(...data.hourlyDistribution.map(h => h.count), 1);
              const height = count > 0 ? Math.max(4, (count / maxCount) * 100) : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-neutral-900 rounded-sm transition-all"
                    style={{ height: `${height}%` }}
                    title={`${i}:00 — ${count} 筆`}
                  />
                  {i % 3 === 0 && (
                    <span className="text-[10px] text-neutral-400">{i}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Revenue by Day */}
      <div className="rounded-lg border bg-white p-4">
        <h3 className="font-semibold mb-3">每日營收趨勢</h3>
        {data.revenueByDay.length === 0 ? (
          <p className="text-sm text-neutral-400">無資料</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-neutral-500">
                  <th className="text-left py-2">日期</th>
                  <th className="text-right py-2">訂單數</th>
                  <th className="text-right py-2">營收</th>
                </tr>
              </thead>
              <tbody>
                {data.revenueByDay.slice(-14).map((d) => (
                  <tr key={d.date} className="border-b last:border-0">
                    <td className="py-1.5">{d.date}</td>
                    <td className="text-right">{d.orderCount}</td>
                    <td className="text-right font-medium">${Math.round(d.revenue).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
