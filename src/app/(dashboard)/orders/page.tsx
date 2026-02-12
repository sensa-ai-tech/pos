'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Order } from '@/types';
import { getClientTenantId } from '@/hooks/use-tenant';

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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const tenantId = getClientTenantId('tenant-a');
    fetch('/api/orders', { headers: { 'x-tenant-id': tenantId } })
      .then((r) => r.json())
      .then((result) => setOrders(result.data ?? result))
      .catch((error) => {
        console.error('Failed to fetch orders:', error);
        setError('無法載入訂單資料');
      });
  }, []);

  const handleExpand = async (orderId: string) => {
    if (expandedId === orderId) {
      setExpandedId(null);
      return;
    }

    const tenantId = getClientTenantId('tenant-a');
    const order = orders.find((o) => o.id === orderId);
    if (order && !order.items) {
      const res = await fetch(`/api/orders/${orderId}`, {
        headers: { 'x-tenant-id': tenantId },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, items: data.items } : o))
        );
      }
    }
    setExpandedId(orderId);
  };

  const handleOrderAction = async (orderId: string, newStatus: 'completed' | 'cancelled') => {
    setActionLoading(orderId);
    try {
      const tenantId = getClientTenantId('tenant-a');
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || '操作失敗');
        return;
      }

      // Update local state
      setOrders(prev => prev.map(o =>
        o.id === orderId ? { ...o, status: newStatus } : o
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失敗');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredOrders =
    statusFilter === 'all'
      ? orders
      : orders.filter((o) => o.status === statusFilter);

  const formatDate = (ts: string | number) => {
    const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
    return d.toLocaleString('zh-TW');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">訂單紀錄</h1>
        <div className="flex gap-2">
          {['all', 'completed', 'pending', 'cancelled'].map((s) => (
            <button
              key={s}
              className={`rounded-full px-3 py-1 text-sm ${
                statusFilter === s
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-600'
              }`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? '全部' : statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>訂單號</TableHead>
              <TableHead>日期時間</TableHead>
              <TableHead className="text-right">金額</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>付款方式</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-neutral-400">
                  尚無訂單
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <React.Fragment key={order.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-neutral-50"
                    onClick={() => handleExpand(order.id)}
                  >
                    <TableCell>
                      {expandedId === order.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{order.orderNumber}</TableCell>
                    <TableCell>{formatDate(order.createdAt)}</TableCell>
                    <TableCell className="text-right font-medium">${order.total}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          order.status === 'completed'
                            ? 'default'
                            : order.status === 'cancelled'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {statusLabels[order.status] || order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{paymentLabels[order.paymentMethod] || order.paymentMethod}</TableCell>
                    <TableCell>
                      {order.status === 'pending' && (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="default"
                            disabled={actionLoading === order.id}
                            onClick={() => handleOrderAction(order.id, 'completed')}
                          >
                            結帳
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={actionLoading === order.id}
                            onClick={() => handleOrderAction(order.id, 'cancelled')}
                          >
                            取消
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedId === order.id && order.items && (
                    <TableRow key={`${order.id}-detail`}>
                      <TableCell colSpan={7} className="bg-neutral-50 p-4">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">訂單明細</p>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-neutral-500">
                                <th className="text-left pb-1">品項</th>
                                <th className="text-right pb-1">單價</th>
                                <th className="text-right pb-1">數量</th>
                                <th className="text-right pb-1">小計</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.items.map((item) => (
                                <tr key={item.id}>
                                  <td>{item.productName}</td>
                                  <td className="text-right">${item.unitPrice}</td>
                                  <td className="text-right">{item.quantity}</td>
                                  <td className="text-right">${item.subtotal}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="border-t pt-2 text-sm">
                            <div className="flex justify-between">
                              <span>小計</span>
                              <span>${order.subtotal}</span>
                            </div>
                            <div className="flex justify-between text-neutral-500">
                              <span>稅金</span>
                              <span>${order.tax}</span>
                            </div>
                            <div className="flex justify-between font-bold">
                              <span>總計</span>
                              <span>${order.total}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
