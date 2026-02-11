'use client';

import { useState } from 'react';
import { useCartStore } from '@/stores/cart-store';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2 } from 'lucide-react';

const DEFAULT_TAX_RATE = 0.05;

interface CartPanelProps {
  tenantId: string;
  taxRate?: number;
}

// Module-level lock to prevent duplicate checkout in StrictMode
let _checkoutLock = false;

export function CartPanel({ tenantId, taxRate = DEFAULT_TAX_RATE }: CartPanelProps) {
  const { items, updateQuantity, removeItem, clearCart, getSubtotal, getTax, getTotal } =
    useCartStore();
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [loading, setLoading] = useState(false);
  const [lastOrder, setLastOrder] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subtotal = getSubtotal();
  const tax = getTax(taxRate);
  const total = getTotal(taxRate);

  const handleCheckout = async () => {
    if (items.length === 0 || _checkoutLock) return;
    _checkoutLock = true;
    setLoading(true);
    setError(null);

    try {
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
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '結帳失敗');
      }

      const order = await res.json();
      clearCart();
      setLastOrder(order.orderNumber);
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
          <div className="mb-3 rounded-md border border-green-200 bg-green-50 p-3 text-green-800">
            <p className="text-sm font-semibold">結帳成功</p>
            <p className="text-xs">訂單編號：{lastOrder}</p>
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

        <Button
          className="w-full"
          size="lg"
          disabled={items.length === 0 || loading}
          onClick={() => {
            setLastOrder(null);
            handleCheckout();
          }}
        >
          {loading ? '處理中...' : `結帳 $${total}`}
        </Button>
      </div>
    </div>
  );
}
