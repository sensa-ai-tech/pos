'use client';

import { useState } from 'react';
import { useCartStore } from '@/stores/cart-store';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2 } from 'lucide-react';

const DEFAULT_TAX_RATE = 0.05;

interface CartPanelProps {
  tenantId: string;
  taxRate?: number;
  tableNumber?: number | null;
  isDineIn?: boolean;
  industry?: string | null;
  orderFlow?: 'pay-first' | 'dine-first';
}

// Module-level lock to prevent duplicate checkout in StrictMode
let _checkoutLock = false;

export function CartPanel({ tenantId, taxRate = DEFAULT_TAX_RATE, tableNumber, isDineIn, industry, orderFlow }: CartPanelProps) {
  const { items, updateQuantity, removeItem, clearCart, getSubtotal, getTax, getTotal } =
    useCartStore();
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [loading, setLoading] = useState(false);
  const [lastOrder, setLastOrder] = useState<string | null>(null);
  const [lastOrderStatus, setLastOrderStatus] = useState<'pending' | 'completed' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subtotal = getSubtotal();
  const tax = getTax(taxRate);
  const total = getTotal(taxRate);

  const handleCheckout = async (orderStatus: 'pending' | 'completed' = 'completed') => {
    if (items.length === 0 || _checkoutLock) return;
    _checkoutLock = true;
    setLoading(true);
    setError(null);

    try {
      const metadata: Record<string, unknown> = {};
      if (tableNumber) metadata.tableNumber = tableNumber;
      if (isDineIn !== undefined) metadata.isDineIn = isDineIn;

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
          paymentMethod,
          taxRate,
          status: orderStatus,
          metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '操作失敗');
      }

      const order = await res.json();
      clearCart();
      setLastOrder(order.orderNumber);
      setLastOrderStatus(orderStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知錯誤');
    } finally {
      setLoading(false);
      _checkoutLock = false;
    }
  };

  return (
    <div className="flex h-full flex-col">
      <h2 className="border-b p-4 text-lg font-semibold">購物車</h2>

      <div className="flex-1 overflow-auto p-4">
        {/* Success message */}
        {lastOrder && items.length === 0 && (
          <div className={`mb-3 rounded-md border p-3 ${
            lastOrderStatus === 'pending'
              ? 'border-blue-200 bg-blue-50 text-blue-800'
              : 'border-green-200 bg-green-50 text-green-800'
          }`}>
            <p className="text-sm font-semibold">
              {lastOrderStatus === 'pending' ? '訂單已送出' : '結帳成功'}
            </p>
            <p className="text-xs">訂單編號：{lastOrder}</p>
            {lastOrderStatus === 'pending' && (
              <p className="text-xs mt-1">訂單已送至廚房，用餐完畢後可至訂單頁面結帳</p>
            )}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
            <p className="text-sm font-semibold">結帳失敗</p>
            <p className="text-xs">{error}</p>
          </div>
        )}

        {items.length === 0 && !lastOrder ? (
          <p className="py-8 text-center text-neutral-400">購物車是空的</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.productId}
                className="flex items-center justify-between rounded-md border p-2"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-neutral-500">${item.price}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-sm">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500"
                    onClick={() => removeItem(item.productId)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t p-4 space-y-3">
        {industry === 'restaurant' && (tableNumber || isDineIn !== undefined) && (
          <div className="mb-3 rounded-md bg-blue-50 p-2 text-sm">
            {isDineIn !== undefined && <span className="mr-3">{isDineIn ? '🍽️ 內用' : '📦 外帶'}</span>}
            {tableNumber && <span>桌號：{tableNumber}</span>}
          </div>
        )}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>小計</span>
            <span>${subtotal}</span>
          </div>
          <div className="flex justify-between text-neutral-500">
            <span>稅金 ({(taxRate * 100).toFixed(0)}%)</span>
            <span>${tax}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>總計</span>
            <span>${total}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {['cash', 'card', 'transfer'].map((method) => (
            <Button
              key={method}
              variant={paymentMethod === method ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setPaymentMethod(method)}
            >
              {method === 'cash' ? '現金' : method === 'card' ? '刷卡' : '轉帳'}
            </Button>
          ))}
        </div>

        {orderFlow === 'dine-first' ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              size="lg"
              disabled={items.length === 0 || loading}
              onClick={() => {
                setLastOrder(null);
                setLastOrderStatus(null);
                handleCheckout('pending');
              }}
            >
              {loading ? '處理中...' : '送出訂單'}
            </Button>
            <Button
              className="flex-1"
              size="lg"
              disabled={items.length === 0 || loading}
              onClick={() => {
                setLastOrder(null);
                setLastOrderStatus(null);
                handleCheckout('completed');
              }}
            >
              {loading ? '處理中...' : `直接結帳 $${total}`}
            </Button>
          </div>
        ) : (
          <Button
            className="w-full"
            size="lg"
            disabled={items.length === 0 || loading}
            onClick={() => {
              setLastOrder(null);
              setLastOrderStatus(null);
              handleCheckout();
            }}
          >
            {loading ? '處理中...' : `結帳 $${total}`}
          </Button>
        )}
      </div>
    </div>
  );
}
