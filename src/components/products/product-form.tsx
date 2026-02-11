'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface ProductFormData {
  name: string;
  price: number;
  cost: number | null;
  sku: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
  categoryId: string | null;
}

interface ProductFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ProductFormData) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: any;
  title?: string;
}

export function ProductForm({
  open,
  onClose,
  onSubmit,
  initialData,
  title = '新增商品',
}: ProductFormProps) {
  const [formData, setFormData] = useState<ProductFormData>({
    name: initialData?.name ?? '',
    price: initialData?.price ?? 0,
    cost: initialData?.cost ?? null,
    sku: initialData?.sku ?? '',
    stockQuantity: initialData?.stockQuantity ?? 0,
    lowStockThreshold: initialData?.lowStockThreshold ?? 5,
    isActive: initialData?.isActive ?? true,
    categoryId: initialData?.categoryId ?? null,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">商品名稱 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">售價 *</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="1"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                required
              />
            </div>
            <div>
              <Label htmlFor="cost">成本價</Label>
              <Input
                id="cost"
                type="number"
                min="0"
                step="1"
                value={formData.cost ?? ''}
                onChange={(e) =>
                  setFormData({ ...formData, cost: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku ?? ''}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value || null })}
              />
            </div>
            <div>
              <Label htmlFor="stock">庫存數量</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                value={formData.stockQuantity}
                onChange={(e) => setFormData({ ...formData, stockQuantity: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="threshold">低庫存警示門檻</Label>
            <Input
              id="threshold"
              type="number"
              min="0"
              value={formData.lowStockThreshold}
              onChange={(e) => setFormData({ ...formData, lowStockThreshold: Number(e.target.value) })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '儲存中...' : '儲存'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
