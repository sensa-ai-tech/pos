import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import { mkdirSync, existsSync, unlinkSync } from 'fs';
import path from 'path';

const testDbPath = path.join(process.cwd(), 'data', 'test-seed.db');

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeAll(() => {
  mkdirSync(path.dirname(testDbPath), { recursive: true });
  if (existsSync(testDbPath)) unlinkSync(testDbPath);

  sqlite = new Database(testDbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  db = drizzle(sqlite, { schema });

  // Create tables
  sqlite.exec(`
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
  `);

  // Seed data
  const now = new Date();
  db.insert(schema.tenants).values([
    { id: 'tenant-a', name: '美味餐廳', industry: 'restaurant', plan: 'free', createdAt: now },
    { id: 'tenant-b', name: '時尚精品店', industry: 'retail', plan: 'free', createdAt: now },
  ]).run();

  db.insert(schema.users).values([
    { id: 'user-a1', tenantId: 'tenant-a', email: 'owner-a@example.com', passwordHash: 'hash', name: '王老闆', role: 'owner', createdAt: now },
    { id: 'user-b1', tenantId: 'tenant-b', email: 'owner-b@example.com', passwordHash: 'hash', name: '李店長', role: 'owner', createdAt: now },
  ]).run();

  db.insert(schema.featureCatalog).values([
    { id: 'basic_pos', name: '基礎收銀', description: '基礎 POS 收銀結帳功能', category: 'core', priceMonthly: 0, isFree: true },
    { id: 'basic_inventory', name: '基礎庫存', description: '商品管理', category: 'core', priceMonthly: 0, isFree: true },
    { id: 'basic_reports', name: '基礎報表', description: '基礎日報表', category: 'core', priceMonthly: 0, isFree: true },
    { id: 'advanced_inventory', name: '進階庫存管理', description: '無上限商品', category: 'inventory', priceMonthly: 299, isFree: false },
    { id: 'crm', name: '顧客關係管理', description: '顧客資料管理', category: 'crm', priceMonthly: 499, isFree: false },
    { id: 'multi_store', name: '多分店管理', description: '多門市管理', category: 'store', priceMonthly: 799, isFree: false },
    { id: 'employee_mgmt', name: '員工管理', description: '員工帳號管理', category: 'hr', priceMonthly: 299, isFree: false },
    { id: 'analytics', name: '進階數據分析', description: '營收分析', category: 'analytics', priceMonthly: 399, isFree: false },
  ]).run();

  db.insert(schema.tenantFeatures).values([
    { id: 'tf-a1', tenantId: 'tenant-a', featureId: 'basic_pos', isActive: true, activatedAt: now },
    { id: 'tf-a2', tenantId: 'tenant-a', featureId: 'basic_inventory', isActive: true, activatedAt: now },
    { id: 'tf-a3', tenantId: 'tenant-a', featureId: 'basic_reports', isActive: true, activatedAt: now },
    { id: 'tf-b1', tenantId: 'tenant-b', featureId: 'basic_pos', isActive: true, activatedAt: now },
    { id: 'tf-b2', tenantId: 'tenant-b', featureId: 'basic_inventory', isActive: true, activatedAt: now },
    { id: 'tf-b3', tenantId: 'tenant-b', featureId: 'basic_reports', isActive: true, activatedAt: now },
  ]).run();

  db.insert(schema.categories).values([
    { id: 'cat-a1', tenantId: 'tenant-a', name: '前菜', sortOrder: 1 },
    { id: 'cat-a2', tenantId: 'tenant-a', name: '主餐', sortOrder: 2 },
    { id: 'cat-b1', tenantId: 'tenant-b', name: '服飾', sortOrder: 1 },
  ]).run();

  db.insert(schema.products).values([
    { id: 'prod-a1', tenantId: 'tenant-a', categoryId: 'cat-a1', name: '凱薩沙拉', price: 180, stockQuantity: 50, createdAt: now },
    { id: 'prod-a2', tenantId: 'tenant-a', categoryId: 'cat-a2', name: '碳烤牛排', price: 580, stockQuantity: 30, createdAt: now },
    { id: 'prod-b1', tenantId: 'tenant-b', categoryId: 'cat-b1', name: '棉質T恤', price: 590, stockQuantity: 100, createdAt: now },
  ]).run();
});

afterAll(() => {
  sqlite.close();
  if (existsSync(testDbPath)) unlinkSync(testDbPath);
});

describe('Seed Data Validation', () => {
  it('should have 2 tenants', () => {
    const result = db.select().from(schema.tenants).all();
    expect(result).toHaveLength(2);
  });

  it('should have 2 users (one per tenant)', () => {
    const result = db.select().from(schema.users).all();
    expect(result).toHaveLength(2);
  });

  it('should have feature catalog with at least 8 entries', () => {
    const result = db.select().from(schema.featureCatalog).all();
    expect(result.length).toBeGreaterThanOrEqual(8);
  });

  it('should have free features activated for both tenants', () => {
    const tenantAFeatures = db.select().from(schema.tenantFeatures)
      .where(eq(schema.tenantFeatures.tenantId, 'tenant-a')).all();
    const tenantBFeatures = db.select().from(schema.tenantFeatures)
      .where(eq(schema.tenantFeatures.tenantId, 'tenant-b')).all();

    expect(tenantAFeatures.length).toBeGreaterThanOrEqual(3);
    expect(tenantBFeatures.length).toBeGreaterThanOrEqual(3);
  });

  it('should have products for each tenant', () => {
    const tenantAProducts = db.select().from(schema.products)
      .where(eq(schema.products.tenantId, 'tenant-a')).all();
    const tenantBProducts = db.select().from(schema.products)
      .where(eq(schema.products.tenantId, 'tenant-b')).all();

    expect(tenantAProducts.length).toBeGreaterThan(0);
    expect(tenantBProducts.length).toBeGreaterThan(0);
  });

  it('should have tenant-a as restaurant and tenant-b as retail', () => {
    const tenantA = db.select().from(schema.tenants).where(eq(schema.tenants.id, 'tenant-a')).get();
    const tenantB = db.select().from(schema.tenants).where(eq(schema.tenants.id, 'tenant-b')).get();

    expect(tenantA?.industry).toBe('restaurant');
    expect(tenantB?.industry).toBe('retail');
  });
});
