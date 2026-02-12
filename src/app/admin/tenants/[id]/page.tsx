'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Store } from 'lucide-react';

interface TenantDetail {
  tenant: {
    id: string;
    name: string;
    industry: string;
    plan: string;
    settings: string | null;
    createdAt: string | number;
  };
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    paymentMethod: string;
    createdAt: string | number;
  }>;
  stats: {
    weeklyOrders: number;
    weeklyRevenue: number;
    productCount: number;
    employeeCount: number;
    customerCount: number;
  };
}

const statusLabels: Record<string, string> = {
  pending: '待處理',
  completed: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
};

const paymentLabels: Record<string, string> = {
  cash: '現金',
  card: '刷卡',
  transfer: '轉帳',
  other: '其他',
};

export default function TenantDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.id as string;
  const [data, setData] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/tenants/${tenantId}`)
      .then(async (r) => {
        if (r.status === 401) {
          router.push('/admin/login');
          return;
        }
        if (!r.ok) throw new Error('Failed to load');
        const result = await r.json();
        setData(result);
      })
      .catch(() => setError('無法載入商店資料'))
      .finally(() => setLoading(false));
  }, [tenantId, router]);

  if (loading) {
    return <div className="max-w-7xl mx-auto px-6 py-20 text-center text-neutral-400">載入中...</div>;
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">
        <p className="text-red-500">{error || '商店不存在'}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/admin')}>
          返回列表
        </Button>
      </div>
    );
  }

  const formatDate = (ts: string | number) => {
    const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
    return d.toLocaleString('zh-TW');
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <Button variant="ghost" className="mb-4" onClick={() => router.push('/admin')}>
        <ArrowLeft className="mr-1 h-4 w-4" />
        返回列表
      </Button>

      <div className="flex items-center gap-3 mb-6">
        <Store className="h-8 w-8 text-neutral-600" />
        <div>
          <h1 className="text-2xl font-bold">{data.tenant.name}</h1>
          <p className="text-sm text-neutral-500">
            {data.tenant.industry} · {data.tenant.plan} · ID: {data.tenant.id}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-neutral-500">本週訂單</p>
          <p className="text-xl font-bold">{data.stats.weeklyOrders}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-neutral-500">本週營收</p>
          <p className="text-xl font-bold">${Math.round(data.stats.weeklyRevenue).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-neutral-500">商品數</p>
          <p className="text-xl font-bold">{data.stats.productCount}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-neutral-500">員工數</p>
          <p className="text-xl font-bold">{data.stats.employeeCount}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-neutral-500">客戶數</p>
          <p className="text-xl font-bold">{data.stats.customerCount}</p>
        </div>
      </div>

      {/* Settings */}
      {data.tenant.settings && (
        <div className="rounded-lg border bg-white p-4 mb-6">
          <h3 className="font-semibold mb-2">商店設定</h3>
          <pre className="text-xs bg-neutral-50 rounded p-3 overflow-x-auto">
            {JSON.stringify(JSON.parse(data.tenant.settings), null, 2)}
          </pre>
        </div>
      )}

      {/* Recent Orders */}
      <div className="rounded-lg border bg-white">
        <div className="p-4 border-b">
          <h3 className="font-semibold">最近訂單（最新 20 筆）</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>訂單號</TableHead>
              <TableHead>時間</TableHead>
              <TableHead className="text-right">金額</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>付款方式</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.recentOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-neutral-400">
                  尚無訂單
                </TableCell>
              </TableRow>
            ) : (
              data.recentOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.orderNumber}</TableCell>
                  <TableCell>{formatDate(order.createdAt)}</TableCell>
                  <TableCell className="text-right">${order.total}</TableCell>
                  <TableCell>
                    <Badge variant={
                      order.status === 'completed' ? 'default' :
                      order.status === 'cancelled' ? 'destructive' : 'secondary'
                    }>
                      {statusLabels[order.status] || order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{paymentLabels[order.paymentMethod] || order.paymentMethod}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
