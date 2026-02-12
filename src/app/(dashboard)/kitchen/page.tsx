'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, ChefHat, CheckCircle, ArrowRight } from 'lucide-react';
import { getClientTenantId } from '@/hooks/use-tenant';
import type { KitchenOrder } from '@/types';

function getElapsedMinutes(createdAt: string | number): number {
  const created = typeof createdAt === 'number' ? createdAt * 1000 : new Date(createdAt).getTime();
  return Math.floor((Date.now() - created) / 60000);
}

function getTimeColor(minutes: number): string {
  if (minutes < 5) return 'text-green-600';
  if (minutes < 10) return 'text-amber-600';
  return 'text-red-600';
}

function KitchenCard({ order, onStatusChange, loading }: {
  order: KitchenOrder;
  onStatusChange: (id: string, status: string) => void;
  loading: boolean;
}) {
  const elapsed = getElapsedMinutes(order.createdAt);
  const timeColor = getTimeColor(elapsed);

  const nextStatus: Record<string, string> = {
    pending: 'preparing',
    preparing: 'ready',
    ready: 'served',
  };

  const nextLabel: Record<string, string> = {
    pending: '開始製作',
    preparing: '完成出餐',
    ready: '已送達',
  };

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${
      elapsed >= 10 ? 'border-red-300 bg-red-50' :
      elapsed >= 5 ? 'border-amber-300 bg-amber-50' :
      'border-neutral-200 bg-white'
    }`}>
      <div className="flex items-center justify-between">
        <span className="font-bold text-sm">{order.orderNumber}</span>
        <span className={`text-xs font-medium ${timeColor}`}>
          {elapsed} 分鐘
        </span>
      </div>

      {(order.tableNumber || order.isDineIn !== undefined) && (
        <div className="flex gap-2 text-xs text-neutral-600">
          {order.tableNumber && <Badge variant="outline">桌 {order.tableNumber}</Badge>}
          {order.isDineIn !== undefined && (
            <Badge variant="outline">{order.isDineIn ? '內用' : '外帶'}</Badge>
          )}
        </div>
      )}

      <div className="space-y-1">
        {order.items?.map((item, idx) => (
          <div key={idx} className="flex justify-between text-sm">
            <span>{item.productName}</span>
            <span className="font-medium">x{item.quantity}</span>
          </div>
        ))}
      </div>

      {order.notes && (
        <p className="text-xs text-neutral-500 italic border-t pt-1">
          備註：{order.notes}
        </p>
      )}

      {nextStatus[order.status] && (
        <Button
          size="sm"
          className="w-full"
          disabled={loading}
          onClick={() => onStatusChange(order.id, nextStatus[order.status])}
        >
          {nextLabel[order.status]}
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export default function KitchenPage() {
  const [kitchenOrders, setKitchenOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    const tenantId = getClientTenantId('tenant-a');
    try {
      const res = await fetch('/api/kitchen', {
        headers: { 'x-tenant-id': tenantId },
      });
      if (res.ok) {
        const data = await res.json();
        setKitchenOrders(data);
      }
    } catch (err) {
      console.error('Failed to fetch kitchen orders:', err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchOrders().finally(() => setLoading(false));

    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setActionLoading(id);
    const tenantId = getClientTenantId('tenant-a');
    try {
      const res = await fetch(`/api/kitchen/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || '更新失敗');
        return;
      }

      // Refresh orders
      await fetchOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失敗');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingOrders = kitchenOrders.filter(o => o.status === 'pending');
  const preparingOrders = kitchenOrders.filter(o => o.status === 'preparing');
  const readyOrders = kitchenOrders.filter(o => o.status === 'ready');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ChefHat className="h-6 w-6" />
          後廚系統
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-neutral-500">
            <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <span>&lt; 5分</span>
            <div className="ml-2 h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span>5-10分</span>
            <div className="ml-2 h-2.5 w-2.5 rounded-full bg-red-500" />
            <span>&gt; 10分</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchOrders}>
            重新整理
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>關閉</button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-neutral-400">載入中...</div>
      ) : (
        <div className="grid grid-cols-3 gap-4 min-h-[calc(100vh-12rem)]">
          {/* Pending Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3">
              <Clock className="h-5 w-5 text-amber-600" />
              <h2 className="font-semibold text-amber-800">待處理</h2>
              <Badge variant="secondary" className="ml-auto">{pendingOrders.length}</Badge>
            </div>
            <div className="space-y-2">
              {pendingOrders.map(order => (
                <KitchenCard
                  key={order.id}
                  order={order}
                  onStatusChange={handleStatusChange}
                  loading={actionLoading === order.id}
                />
              ))}
              {pendingOrders.length === 0 && (
                <p className="py-8 text-center text-sm text-neutral-400">無待處理訂單</p>
              )}
            </div>
          </div>

          {/* Preparing Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3">
              <ChefHat className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold text-blue-800">製作中</h2>
              <Badge variant="secondary" className="ml-auto">{preparingOrders.length}</Badge>
            </div>
            <div className="space-y-2">
              {preparingOrders.map(order => (
                <KitchenCard
                  key={order.id}
                  order={order}
                  onStatusChange={handleStatusChange}
                  loading={actionLoading === order.id}
                />
              ))}
              {preparingOrders.length === 0 && (
                <p className="py-8 text-center text-sm text-neutral-400">無製作中訂單</p>
              )}
            </div>
          </div>

          {/* Ready Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h2 className="font-semibold text-green-800">完成</h2>
              <Badge variant="secondary" className="ml-auto">{readyOrders.length}</Badge>
            </div>
            <div className="space-y-2">
              {readyOrders.map(order => (
                <KitchenCard
                  key={order.id}
                  order={order}
                  onStatusChange={handleStatusChange}
                  loading={actionLoading === order.id}
                />
              ))}
              {readyOrders.length === 0 && (
                <p className="py-8 text-center text-sm text-neutral-400">無已完成訂單</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
