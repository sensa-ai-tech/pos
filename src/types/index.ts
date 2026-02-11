/**
 * Shared type definitions for OneKey POS
 * Consolidated from all page/component-level interfaces
 */

// ─── Product ───────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  stockQuantity: number;
  categoryId: string | null;
  cost?: number | null;
  sku?: string | null;
  barcode?: string | null;
  lowStockThreshold?: number;
}

// ─── Category ──────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
}

// ─── Order ─────────────────────────────────────────────────────

export interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  createdAt: string | number;
  items?: OrderItem[];
}

// ─── Customer ──────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  totalSpent: number;
  visitCount: number;
}

// ─── Employee ──────────────────────────────────────────────────

export interface Employee {
  id: string;
  name: string;
  role: string;
  email: string;
  status: 'active' | 'inactive';
}

// ─── Dashboard ─────────────────────────────────────────────────

export interface DashboardData {
  today: { orderCount: number; revenue: number; avgOrderValue: number };
  weekly: { orderCount: number; revenue: number };
  productCount: number;
  topProducts: Array<{ productName: string; totalQty: number; totalRevenue: number }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    total: number;
    status: string;
    paymentMethod: string;
    createdAt: string;
  }>;
}

// ─── Cart ──────────────────────────────────────────────────────

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

// ─── Tenant ────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  industry?: string | null;
}

// ─── Feature ───────────────────────────────────────────────────

export interface FeatureInfo {
  featureId: string;
  featureName: string;
  featureDescription: string;
  category: string;
  priceMonthly: number;
  isFree: boolean;
  isActive: boolean;
}

// ─── Industry ──────────────────────────────────────────────────

export type Industry = 'restaurant' | 'retail' | 'medical' | 'service' | 'cafe' | 'gym' | 'education' | 'petshop' | 'repair' | 'beauty' | null;
