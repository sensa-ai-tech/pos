'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ShoppingCart, Package, BarChart3, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DashboardData {
  today: { orderCount: number; revenue: number; avgOrderValue: number };
  weekly: { orderCount: number; revenue: number };
  productCount: number;
  topProducts: Array<{ productName: string; totalQty: number; totalRevenue: number }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    total: number;
    status: string;
    paymentMethod: string;
    createdAt: string;
  }>;
}

function getTenantId(): string {
  if (typeof document === 'undefined') return '';
  const cookies = document.cookie.split(';').reduce((acc, c) => {
    const [key, val] = c.trim().split('=');
    acc[key] = val;
    return acc;
  }, {} as Record<string, string>);
  return cookies['tenant_id'] || '';
}

const statusLabels: Record<string, string> = {
  pending: '待處理',
  completed: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  const fetchDashboard = useCallback(async () => {
    const tid = getTenantId();
    if (!tid) return;
    try {
      const res = await fetch('/api/reports/dashboard', {
        headers: { 'x-tenant-id': tid },
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const today = data?.today ?? { orderCount: 0, revenue: 0, avgOrderValue: 0 };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">今日營收</CardTitle>
            <BarChart3 className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${today.revenue.toLocaleString()}</p>
            <p className="text-xs text-neutral-500">
              本週 ${(data?.weekly.revenue ?? 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">今日訂單</CardTitle>
            <ShoppingCart className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{today.orderCount}</p>
            <p className="text-xs text-neutral-500">筆</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">平均客單價</CardTitle>
            <Package className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${today.avgOrderValue.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">商品數量</CardTitle>
            <AlertTriangle className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.productCount ?? 0}</p>
            <p className="text-xs text-neutral-500">品項</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="flex gap-4">
        <Link href="/pos">
          <Button size="lg">
            <ShoppingCart className="mr-2 h-5 w-5" />
            開始收銀
          </Button>
        </Link>
        <Link href="/products">
          <Button variant="outline" size="lg">
            <Package className="mr-2 h-5 w-5" />
            管理商品
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Top products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">暢銷商品 Top 5</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.topProducts ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-neutral-400">尚無銷售資料</p>
            ) : (
              <div className="space-y-3">
                {data!.topProducts.map((p, i) => (
                  <div key={p.productName} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold">
                        {i + 1}
                      </span>
                      <span>{p.productName}</span>
                    </div>
                    <span className="text-neutral-500">{p.totalQty} 件 / ${p.totalRevenue}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent orders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">最近訂單</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.recentOrders ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-neutral-400">尚無訂單</p>
            ) : (
              <div className="space-y-2">
                {data!.recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-md border p-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{order.orderNumber}</span>
                      <Badge
                        variant={order.status === 'completed' ? 'secondary' : 'outline'}
                        className="ml-2"
                      >
                        {statusLabels[order.status] || order.status}
                      </Badge>
                    </div>
                    <span className="font-medium">${order.total}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
