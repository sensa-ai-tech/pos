'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ProductForm } from '@/components/products/product-form';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/types';
import { getClientTenantId } from '@/hooks/use-tenant';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [tenantId, setTenantId] = useState('tenant-a');
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProducts = useCallback(() => {
    fetch('/api/products', { headers: { 'x-tenant-id': tenantId } })
      .then((r) => r.json())
      .then((result) => setProducts(result.data ?? result))
      .catch((error) => {
        console.error('Failed to fetch products:', error);
        setError('無法載入商品資料');
      });
  }, [tenantId]);

  useEffect(() => {
    setTenantId(getClientTenantId('tenant-a'));
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleCreate = async (data: {
    name: string; price: number; cost: number | null; sku: string | null;
    stockQuantity: number; lowStockThreshold: number; isActive: boolean; categoryId: string | null;
  }) => {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('建立失敗');
    toast({ title: '商品已新增' });
    fetchProducts();
  };

  const handleUpdate = async (data: {
    name: string; price: number; cost: number | null; sku: string | null;
    stockQuantity: number; lowStockThreshold: number; isActive: boolean; categoryId: string | null;
  }) => {
    if (!editProduct) return;
    const res = await fetch(`/api/products/${editProduct.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('更新失敗');
    toast({ title: '商品已更新' });
    setEditProduct(null);
    fetchProducts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此商品？')) return;
    const res = await fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: { 'x-tenant-id': tenantId },
    });
    if (!res.ok) {
      toast({ title: '刪除失敗', variant: 'destructive' });
      return;
    }
    toast({ title: '商品已刪除' });
    fetchProducts();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">商品管理</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          新增商品
        </Button>
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
              <TableHead>名稱</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">售價</TableHead>
              <TableHead className="text-right">庫存</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-neutral-400">
                  尚無商品，點擊「新增商品」開始
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-neutral-500">{product.sku || '-'}</TableCell>
                  <TableCell className="text-right">${product.price}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        product.stockQuantity <= (product.lowStockThreshold ?? 0)
                          ? 'text-red-600 font-medium'
                          : ''
                      }
                    >
                      {product.stockQuantity}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.isActive ? 'default' : 'secondary'}>
                      {product.isActive ? '啟用' : '停用'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditProduct(product)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500"
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ProductForm
        key="new"
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleCreate}
        title="新增商品"
      />

      {editProduct && (
        <ProductForm
          key={editProduct.id}
          open={!!editProduct}
          onClose={() => setEditProduct(null)}
          onSubmit={handleUpdate}
          initialData={editProduct}
          title="編輯商品"
        />
      )}
    </div>
  );
}
