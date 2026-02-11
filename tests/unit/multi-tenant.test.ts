import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import { mkdirSync, existsSync, unlinkSync } from 'fs';
import path from 'path';

const testDbPath = path.join(process.cwd(), 'data', 'test-tenant.db');

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeAll(() => {
  mkdirSync(path.dirname(testDbPath), { recursive: true });
  if (existsSync(testDbPath)) unlinkSync(testDbPath);

  sqlite = new Database(testDbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  db = drizzle(sqlite, { schema });

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

  const now = new Date();

  db.insert(schema.tenants).values([
    { id: 'tenant-x', name: 'Tenant X', industry: 'restaurant', createdAt: now },
    { id: 'tenant-y', name: 'Tenant Y', industry: 'retail', createdAt: now },
  ]).run();

  db.insert(schema.categories).values([
    { id: 'cat-x1', tenantId: 'tenant-x', name: 'X Category' },
    { id: 'cat-y1', tenantId: 'tenant-y', name: 'Y Category' },
  ]).run();

  db.insert(schema.products).values([
    { id: 'prod-x1', tenantId: 'tenant-x', categoryId: 'cat-x1', name: 'X Product', price: 100, stockQuantity: 10, createdAt: now },
    { id: 'prod-x2', tenantId: 'tenant-x', categoryId: 'cat-x1', name: 'X Product 2', price: 200, stockQuantity: 20, createdAt: now },
    { id: 'prod-y1', tenantId: 'tenant-y', categoryId: 'cat-y1', name: 'Y Product', price: 300, stockQuantity: 30, createdAt: now },
  ]).run();
});

afterAll(() => {
  sqlite.close();
  if (existsSync(testDbPath)) unlinkSync(testDbPath);
});

describe('Multi-Tenant Isolation', () => {
  it('should return only tenant-x products when filtered by tenant-x', () => {
    const tenantXProducts = db.select().from(schema.products)
      .where(eq(schema.products.tenantId, 'tenant-x')).all();

    expect(tenantXProducts).toHaveLength(2);
    expect(tenantXProducts.every(p => p.tenantId === 'tenant-x')).toBe(true);
  });

  it('should return only tenant-y products when filtered by tenant-y', () => {
    const tenantYProducts = db.select().from(schema.products)
      .where(eq(schema.products.tenantId, 'tenant-y')).all();

    expect(tenantYProducts).toHaveLength(1);
    expect(tenantYProducts[0].tenantId).toBe('tenant-y');
    expect(tenantYProducts[0].name).toBe('Y Product');
  });

  it('should not leak tenant-x data to tenant-y queries', () => {
    const tenantYProducts = db.select().from(schema.products)
      .where(eq(schema.products.tenantId, 'tenant-y')).all();

    const xProductNames = tenantYProducts.filter(p => p.name.startsWith('X'));
    expect(xProductNames).toHaveLength(0);
  });

  it('should isolate categories by tenant', () => {
    const tenantXCategories = db.select().from(schema.categories)
      .where(eq(schema.categories.tenantId, 'tenant-x')).all();
    const tenantYCategories = db.select().from(schema.categories)
      .where(eq(schema.categories.tenantId, 'tenant-y')).all();

    expect(tenantXCategories).toHaveLength(1);
    expect(tenantYCategories).toHaveLength(1);
    expect(tenantXCategories[0].name).toBe('X Category');
    expect(tenantYCategories[0].name).toBe('Y Category');
  });
});
