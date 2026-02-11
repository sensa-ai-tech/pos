'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useCartStore } from '@/stores/cart-store';
import type { Product } from '@/types';

interface ProductGridProps {
  products: Product[];
  selectedCategory: string | null;
  searchQuery: string;
}

export function ProductGrid({ products, selectedCategory, searchQuery }: ProductGridProps) {
  const addItem = useCartStore((s) => s.addItem);

  const filtered = useMemo(() =>
    products.filter((p) => {
      if (!p.isActive) return false;
      if (selectedCategory && p.categoryId !== selectedCategory) return false;
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    }),
    [products, selectedCategory, searchQuery]
  );

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {filtered.map((product) => (
        <Card
          key={product.id}
          className={`cursor-pointer transition-shadow hover:shadow-md ${
            product.stockQuantity <= 0 ? 'opacity-50' : ''
          }`}
          onClick={() => {
            if (product.stockQuantity > 0) {
              addItem({ id: product.id, name: product.name, price: product.price });
            }
          }}
        >
          <CardContent className="flex flex-col items-center justify-center p-4">
            <span className="text-center text-sm font-medium">{product.name}</span>
            <span className="mt-1 text-lg font-bold text-blue-600">
              ${product.price}
            </span>
            {product.stockQuantity <= 0 && (
              <span className="mt-1 text-xs text-red-500">缺貨</span>
            )}
          </CardContent>
        </Card>
      ))}
      {filtered.length === 0 && (
        <div className="col-span-full py-12 text-center text-neutral-400">
          找不到商品
        </div>
      )}
    </div>
  );
}
