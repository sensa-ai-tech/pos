import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import { mkdirSync, existsSync, unlinkSync } from 'fs';
import path from 'path';

const testDbPath = path.join(process.cwd(), 'data', 'test-inventory.db');

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
    CREATE TABLE categories (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE products (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), category_id TEXT REFERENCES categories(id), name TEXT NOT NULL, description TEXT, price REAL NOT NULL, cost REAL, sku TEXT, barcode TEXT, image_url TEXT, is_active INTEGER NOT NULL DEFAULT 1, stock_quantity INTEGER NOT NULL DEFAULT 0, low_stock_threshold INTEGER NOT NULL DEFAULT 5, metadata TEXT, created_at INTEGER NOT NULL);
    CREATE TABLE customers (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), name TEXT NOT NULL, phone TEXT, email TEXT, notes TEXT, total_spent REAL NOT NULL DEFAULT 0, visit_count INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    CREATE TABLE orders (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), order_number TEXT NOT NULL, customer_id TEXT REFERENCES customers(id), status TEXT NOT NULL DEFAULT 'pending', subtotal REAL NOT NULL, tax REAL NOT NULL DEFAULT 0, discount REAL NOT NULL DEFAULT 0, total REAL NOT NULL, payment_method TEXT NOT NULL, notes TEXT, metadata TEXT, created_at INTEGER NOT NULL);
    CREATE TABLE order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL REFERENCES products(id), product_name TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price REAL NOT NULL, subtotal REAL NOT NULL, notes TEXT);
    CREATE TABLE payments (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), order_id TEXT NOT NULL REFERENCES orders(id), amount REAL NOT NULL, method TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'completed', created_at INTEGER NOT NULL);
  `);

  const now = new Date();
  db.insert(schema.tenants).values({ id: 'test-t', name: 'Test', industry: 'restaurant', createdAt: now }).run();
  db.insert(schema.products).values([
    { id: 'test-p1', tenantId: 'test-t', name: 'Product A', price: 100, stockQuantity: 10, createdAt: now },
    { id: 'test-p2', tenantId: 'test-t', name: 'Product B', price: 200, stockQuantity: 5, createdAt: now },
  ]).run();
});

afterAll(() => {
  sqlite.close();
  if (existsSync(testDbPath)) unlinkSync(testDbPath);
});

describe('Inventory Deduction', () => {
  it('should deduct stock when creating an order', () => {
    const now = new Date();
    const orderId = 'order-test-1';

    // Simulate order creation with inventory deduction in a transaction
    const createOrder = sqlite.transaction(() => {
      db.insert(schema.orders).values({
        id: orderId,
        tenantId: 'test-t',
        orderNumber: 'ORD-TEST-001',
        status: 'completed',
        subtotal: 500,
        tax: 25,
        total: 525,
        paymentMethod: 'cash',
        createdAt: now,
      }).run();

      db.insert(schema.orderItems).values([
        { id: 'oi-1', orderId, productId: 'test-p1', productName: 'Product A', quantity: 2, unitPrice: 100, subtotal: 200 },
        { id: 'oi-2', orderId, productId: 'test-p2', productName: 'Product B', quantity: 1, unitPrice: 200, subtotal: 200 },
      ]).run();

      db.insert(schema.payments).values({
        id: 'pay-1',
        tenantId: 'test-t',
        orderId,
        amount: 525,
        method: 'cash',
        status: 'completed',
        createdAt: now,
      }).run();

      // Deduct inventory
      const p1 = db.select().from(schema.products).where(eq(schema.products.id, 'test-p1')).get()!;
      db.update(schema.products).set({ stockQuantity: p1.stockQuantity - 2 }).where(eq(schema.products.id, 'test-p1')).run();

      const p2 = db.select().from(schema.products).where(eq(schema.products.id, 'test-p2')).get()!;
      db.update(schema.products).set({ stockQuantity: p2.stockQuantity - 1 }).where(eq(schema.products.id, 'test-p2')).run();
    });

    createOrder();

    // Verify stock deduction
    const p1After = db.select().from(schema.products).where(eq(schema.products.id, 'test-p1')).get()!;
    const p2After = db.select().from(schema.products).where(eq(schema.products.id, 'test-p2')).get()!;

    expect(p1After.stockQuantity).toBe(8); // 10 - 2
    expect(p2After.stockQuantity).toBe(4); // 5 - 1
  });

  it('should verify order items were created correctly', () => {
    const items = db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, 'order-test-1')).all();
    expect(items).toHaveLength(2);
    expect(items[0].productName).toBe('Product A');
    expect(items[1].productName).toBe('Product B');
  });

  it('should verify payment was recorded', () => {
    const payment = db.select().from(schema.payments).where(eq(schema.payments.orderId, 'order-test-1')).all();
    expect(payment).toHaveLength(1);
    expect(payment[0].amount).toBe(525);
    expect(payment[0].method).toBe('cash');
  });
});
