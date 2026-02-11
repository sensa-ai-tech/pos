'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, TrendingDown } from 'lucide-react';
import { FeatureGate } from '@/components/feature-gate';
import { FEATURES } from '@/lib/feature-ids';
import type { Product } from '@/types';
import { getClientTenantId } from '@/hooks/use-tenant';

function InventoryContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    const tid = getClientTenantId();
    if (!tid) return;
    try {
      const res = await fetch('/api/products', {
        headers: { 'x-tenant-id': tid },
      });
      if (res.ok) {
        const result = await res.json();
        setProducts(result.data ?? result);
      }
    } catch (error) {
      console.error('Failed to fetch inventory data:', error);
      setError('無法載入庫存資料');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const lowStockItems = products.filter(
    (p) => p.isActive && p.stockQuantity <= (p.lowStockThreshold ?? 0)
  );
  const outOfStockItems = products.filter(
    (p) => p.isActive && p.stockQuantity === 0
  );
  const totalValue = products.reduce(
    (sum, p) => sum + p.price * p.stockQuantity,
    0
  );

  if (loading) {
    return <p className="py-8 text-center text-neutral-400">載入中...</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">庫存管理</h1>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">
              總商品數
            </CardTitle>
            <Package className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{products.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">
              庫存總價值
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              ${totalValue.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-500">
              低庫存警告
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {lowStockItems.length}
            </p>
            <p className="text-xs text-neutral-500">
              其中 {outOfStockItems.length} 項已缺貨
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Inventory table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">庫存明細</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-neutral-500">
                  <th className="pb-2 font-medium">商品名稱</th>
                  <th className="pb-2 font-medium">SKU</th>
                  <th className="pb-2 font-medium text-right">庫存數量</th>
                  <th className="pb-2 font-medium text-right">警告門檻</th>
                  <th className="pb-2 font-medium text-center">狀態</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const isLow =
                    p.isActive && p.stockQuantity <= (p.lowStockThreshold ?? 0);
                  const isOut = p.isActive && p.stockQuantity === 0;
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{p.name}</td>
                      <td className="py-2 text-neutral-500">
                        {p.sku || '-'}
                      </td>
                      <td
                        className={`py-2 text-right font-mono ${
                          isOut
                            ? 'text-red-600'
                            : isLow
                            ? 'text-amber-600'
                            : ''
                        }`}
                      >
                        {p.stockQuantity}
                      </td>
                      <td className="py-2 text-right text-neutral-500">
                        {p.lowStockThreshold ?? 0}
                      </td>
                      <td className="py-2 text-center">
                        {isOut ? (
                          <Badge variant="destructive">缺貨</Badge>
                        ) : isLow ? (
                          <Badge variant="outline" className="border-amber-500 text-amber-600">
                            低庫存
                          </Badge>
                        ) : (
                          <Badge variant="secondary">正常</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-neutral-400"
                    >
                      尚無商品資料
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InventoryPage() {
  const [tenantId, setTenantId] = useState('');

  useEffect(() => {
    setTenantId(getClientTenantId());
  }, []);

  if (!tenantId) return null;

  return (
    <FeatureGate
      tenantId={tenantId}
      featureId={FEATURES.INVENTORY}
      featureName="庫存管理"
      description="追蹤商品庫存、低庫存警告、庫存價值分析"
    >
      <InventoryContent />
    </FeatureGate>
  );
}
