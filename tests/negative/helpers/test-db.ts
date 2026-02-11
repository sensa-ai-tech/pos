import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/db/schema';
import { mkdirSync, existsSync, unlinkSync } from 'fs';
import path from 'path';

const ALL_TABLES_SQL = `
  CREATE TABLE tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL, industry TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'free', settings TEXT, created_at INTEGER NOT NULL);
  CREATE TABLE users (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE categories (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE products (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), category_id TEXT REFERENCES categories(id), name TEXT NOT NULL, description TEXT, price REAL NOT NULL, cost REAL, sku TEXT, barcode TEXT, image_url TEXT, is_active INTEGER NOT NULL DEFAULT 1, stock_quantity INTEGER NOT NULL DEFAULT 0, low_stock_threshold INTEGER NOT NULL DEFAULT 5, metadata TEXT, created_at INTEGER NOT NULL);
  CREATE TABLE customers (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), name TEXT NOT NULL, phone TEXT, email TEXT, notes TEXT, total_spent REAL NOT NULL DEFAULT 0, visit_count INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
  CREATE TABLE orders (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), order_number TEXT NOT NULL, customer_id TEXT REFERENCES customers(id), status TEXT NOT NULL DEFAULT 'pending', subtotal REAL NOT NULL, tax REAL NOT NULL DEFAULT 0, discount REAL NOT NULL DEFAULT 0, total REAL NOT NULL, payment_method TEXT NOT NULL, notes TEXT, metadata TEXT, created_at INTEGER NOT NULL);
  CREATE TABLE order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL REFERENCES products(id), product_name TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price REAL NOT NULL, subtotal REAL NOT NULL, notes TEXT);
  CREATE TABLE payments (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), order_id TEXT NOT NULL REFERENCES orders(id), amount REAL NOT NULL, method TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'completed', created_at INTEGER NOT NULL);
  CREATE TABLE feature_catalog (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, price_monthly REAL NOT NULL, is_free INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE tenant_features (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), feature_id TEXT NOT NULL REFERENCES feature_catalog(id), is_active INTEGER NOT NULL DEFAULT 1, activated_at INTEGER NOT NULL, expires_at INTEGER);
  CREATE TABLE industry_templates (id TEXT PRIMARY KEY, industry TEXT NOT NULL, template_data TEXT NOT NULL, description TEXT NOT NULL);
  CREATE TABLE inventory (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), product_id TEXT NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL DEFAULT 0, batch_number TEXT, expires_at INTEGER, location TEXT, created_at INTEGER NOT NULL);
`;

/** Seed the feature catalog with all 11 features (matching src/db/seed.ts) */
const FEATURE_CATALOG = [
  { id: 'basic_pos', name: '基礎收銀', description: '基礎 POS 收銀結帳功能', category: 'core', priceMonthly: 0, isFree: true },
  { id: 'basic_inventory', name: '基礎庫存', description: '商品管理（50 品項上限）', category: 'core', priceMonthly: 0, isFree: true },
  { id: 'basic_reports', name: '基礎報表', description: '基礎日報表', category: 'core', priceMonthly: 0, isFree: true },
  { id: 'advanced_inventory', name: '進階庫存管理', description: '無上限商品 + 庫存警示 + 批號追蹤', category: 'inventory', priceMonthly: 299, isFree: false },
  { id: 'crm', name: '顧客關係管理', description: '顧客資料、消費紀錄、分群管理', category: 'crm', priceMonthly: 499, isFree: false },
  { id: 'multi_store', name: '多分店管理', description: '多門市統一管理與報表', category: 'store', priceMonthly: 799, isFree: false },
  { id: 'employee_mgmt', name: '員工管理', description: '員工帳號、排班、權限管理', category: 'hr', priceMonthly: 299, isFree: false },
  { id: 'analytics', name: '進階數據分析', description: '營收趨勢、熱門商品、客群分析', category: 'analytics', priceMonthly: 399, isFree: false },
  { id: 'online_ordering', name: '線上點餐', description: '線上點餐/預約系統', category: 'online', priceMonthly: 599, isFree: false },
  { id: 'loyalty', name: '會員積點系統', description: '會員積點、儲值卡、優惠券', category: 'loyalty', priceMonthly: 499, isFree: false },
  { id: 'api_access', name: 'API 存取', description: '開放 API 供第三方整合', category: 'api', priceMonthly: 999, isFree: false },
];

export interface TestDbContext {
  sqlite: InstanceType<typeof Database>;
  db: ReturnType<typeof drizzle>;
  cleanup: () => void;
}

/**
 * Create an isolated test database for negative testing.
 * @param name - Unique name suffix for the DB file
 * @param options.seedFeatureCatalog - Whether to seed the feature catalog (default: false)
 */
export function createTestDb(
  name: string,
  options?: { seedFeatureCatalog?: boolean }
): TestDbContext {
  const dbPath = path.join(process.cwd(), 'data', `test-neg-${name}.db`);

  // Ensure data directory exists
  mkdirSync(path.dirname(dbPath), { recursive: true });
  if (existsSync(dbPath)) unlinkSync(dbPath);

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });

  // Create all tables
  sqlite.exec(ALL_TABLES_SQL);

  // Optionally seed feature catalog
  if (options?.seedFeatureCatalog) {
    for (const f of FEATURE_CATALOG) {
      db.insert(schema.featureCatalog).values(f).run();
    }
  }

  const cleanup = () => {
    try {
      sqlite.close();
    } catch { /* already closed */ }
    if (existsSync(dbPath)) unlinkSync(dbPath);
  };

  return { sqlite, db, cleanup };
}

/** Seed two tenants (A and B) for cross-tenant isolation tests */
export function seedTwoTenants(db: ReturnType<typeof drizzle>) {
  const now = new Date();

  db.insert(schema.tenants).values([
    { id: 'tenant-a', name: 'Tenant A', industry: 'restaurant', plan: 'free', createdAt: now },
    { id: 'tenant-b', name: 'Tenant B', industry: 'retail', plan: 'free', createdAt: now },
  ]).run();

  db.insert(schema.products).values([
    { id: 'prod-a1', tenantId: 'tenant-a', name: 'A Product 1', price: 100, stockQuantity: 50, createdAt: now },
    { id: 'prod-a2', tenantId: 'tenant-a', name: 'A Product 2', price: 200, stockQuantity: 30, createdAt: now },
    { id: 'prod-b1', tenantId: 'tenant-b', name: 'B Product 1', price: 300, stockQuantity: 20, createdAt: now },
  ]).run();

  return { now };
}

/** Seed orders and order items for cross-tenant tests */
export function seedOrdersForTenants(db: ReturnType<typeof drizzle>) {
  const now = new Date();

  db.insert(schema.orders).values([
    { id: 'order-a1', tenantId: 'tenant-a', orderNumber: 'ORD-A001', status: 'completed', subtotal: 300, tax: 15, total: 315, paymentMethod: 'cash', createdAt: now },
    { id: 'order-b1', tenantId: 'tenant-b', orderNumber: 'ORD-B001', status: 'completed', subtotal: 600, tax: 30, total: 630, paymentMethod: 'card', createdAt: now },
  ]).run();

  db.insert(schema.orderItems).values([
    { id: 'oi-a1', orderId: 'order-a1', productId: 'prod-a1', productName: 'A Product 1', quantity: 3, unitPrice: 100, subtotal: 300 },
    { id: 'oi-b1', orderId: 'order-b1', productId: 'prod-b1', productName: 'B Product 1', quantity: 2, unitPrice: 300, subtotal: 600 },
  ]).run();

  db.insert(schema.payments).values([
    { id: 'pay-a1', tenantId: 'tenant-a', orderId: 'order-a1', amount: 315, method: 'cash', status: 'completed', createdAt: now },
    { id: 'pay-b1', tenantId: 'tenant-b', orderId: 'order-b1', amount: 630, method: 'card', status: 'completed', createdAt: now },
  ]).run();

  return { now };
}

export { FEATURE_CATALOG };
