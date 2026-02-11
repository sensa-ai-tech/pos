'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { ProductGrid } from '@/components/pos/product-grid';
import { CartPanel } from '@/components/pos/cart-panel';
import { CategoryFilter } from '@/components/pos/category-filter';
import { SearchBar } from '@/components/pos/search-bar';
import type { Product, Category, Industry } from '@/types';
import { getClientTenantId } from '@/hooks/use-tenant';

// Industry-specific components (dynamic imports for code splitting)
const TableSelector = dynamic(() => import('@/components/pos/restaurant/table-selector').then(m => ({ default: m.TableSelector })));
const DineInToggle = dynamic(() => import('@/components/pos/restaurant/dine-in-toggle').then(m => ({ default: m.DineInToggle })));
const BarcodeInput = dynamic(() => import('@/components/pos/retail/barcode-input').then(m => ({ default: m.BarcodeInput })));
const DiscountBadge = dynamic(() => import('@/components/pos/retail/discount-badge').then(m => ({ default: m.DiscountBadge })));
const AppointmentQueue = dynamic(() => import('@/components/pos/medical/appointment-queue').then(m => ({ default: m.AppointmentQueue })));
const DiagnosisNote = dynamic(() => import('@/components/pos/medical/diagnosis-note').then(m => ({ default: m.DiagnosisNote })));
const BookingSlot = dynamic(() => import('@/components/pos/service/booking-slot').then(m => ({ default: m.BookingSlot })));
const TechnicianSelect = dynamic(() => import('@/components/pos/service/technician-select').then(m => ({ default: m.TechnicianSelect })));

function RestaurantExtras() {
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [isDineIn, setIsDineIn] = useState(true);

  return (
    <div className="space-y-3 rounded-lg border bg-white p-3">
      <h3 className="text-sm font-semibold text-neutral-700">餐飲設定</h3>
      <DineInToggle onChange={setIsDineIn} />
      {isDineIn && <TableSelector onSelect={setSelectedTable} />}
      {selectedTable && (
        <p className="text-xs text-neutral-500">已選桌號：{selectedTable}</p>
      )}
    </div>
  );
}

function RetailExtras({ onBarcodeSearch }: { onBarcodeSearch: (code: string) => void }) {
  return (
    <div className="space-y-3 rounded-lg border bg-white p-3">
      <h3 className="text-sm font-semibold text-neutral-700">零售工具</h3>
      <BarcodeInput onScan={onBarcodeSearch} />
      <div className="flex gap-2">
        <span className="text-xs text-neutral-500">活動折扣：</span>
        <DiscountBadge discount={10} />
      </div>
    </div>
  );
}

function MedicalExtras() {
  return (
    <div className="space-y-3 rounded-lg border bg-white p-3">
      <h3 className="text-sm font-semibold text-neutral-700">醫療資訊</h3>
      <AppointmentQueue />
      <DiagnosisNote onChange={() => {}} />
    </div>
  );
}

function ServiceExtras() {
  return (
    <div className="space-y-3 rounded-lg border bg-white p-3">
      <h3 className="text-sm font-semibold text-neutral-700">服務預約</h3>
      <BookingSlot onSelect={() => {}} />
      <TechnicianSelect onSelect={() => {}} />
    </div>
  );
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tenantId, setTenantId] = useState('tenant-a');
  const [industry, setIndustry] = useState<Industry>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (tid: string) => {
    try {
      const [prodRes, tenantRes, catRes] = await Promise.all([
        fetch('/api/products', { headers: { 'x-tenant-id': tid } }),
        fetch(`/api/tenants/${tid}`),
        fetch('/api/categories', { headers: { 'x-tenant-id': tid } }),
      ]);

      const prodResult = await prodRes.json();
      const data: Product[] = prodResult.data ?? prodResult;
      setProducts(data);

      // Use categories API if available, fallback to product-derived
      if (catRes.ok) {
        const catData: Category[] = await catRes.json();
        setCategories(catData);
      } else {
        // Fallback: derive categories from products (limited info)
        const catMap = new Map<string, string>();
        data.forEach((p) => {
          if (p.categoryId && !catMap.has(p.categoryId)) {
            catMap.set(p.categoryId, p.categoryId);
          }
        });
        setCategories(
          Array.from(catMap.entries()).map(([id]) => ({ id, name: id }))
        );
      }

      if (tenantRes.ok) {
        const tenant = await tenantRes.json();
        setIndustry(tenant.industry ?? null);
      }
    } catch (error) {
      console.error('Failed to fetch POS data:', error);
      setError('無法載入商品資料');
    }
  }, []);

  useEffect(() => {
    const tid = getClientTenantId('tenant-a');
    setTenantId(tid);
    fetchData(tid);
  }, [fetchData]);

  const handleBarcodeSearch = (code: string) => {
    // Search by barcode/sku in products
    const found = products.find(
      (p) => p.barcode === code || p.sku === code
    );
    if (found) {
      setSearchQuery(found.name);
    }
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Left: Product Selection */}
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <CategoryFilter
          categories={categories}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />

        {/* Industry-specific panel */}
        {industry === 'restaurant' && <RestaurantExtras />}
        {industry === 'retail' && <RetailExtras onBarcodeSearch={handleBarcodeSearch} />}
        {industry === 'medical' && <MedicalExtras />}
        {industry === 'service' && <ServiceExtras />}

        <div className="flex-1 overflow-auto">
          <ProductGrid
            products={products}
            selectedCategory={selectedCategory}
            searchQuery={searchQuery}
          />
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-80 flex-shrink-0 rounded-lg border bg-white">
        <CartPanel tenantId={tenantId} />
      </div>
    </div>
  );
}
