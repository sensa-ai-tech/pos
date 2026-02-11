import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../src/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import * as fs from 'fs';

const TEST_DB_PATH = './data/test-dashboard.db';

describe('Dashboard API Logic', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;
  const tenantId = 'test-tenant-dash';

  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    const dir = './data';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    sqlite = new Database(TEST_DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite, { schema });

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, industry TEXT NOT NULL,
        plan TEXT NOT NULL DEFAULT 'free', settings TEXT, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
        category_id TEXT, name TEXT NOT NULL, description TEXT, price REAL NOT NULL,
        cost REAL, sku TEXT, barcode TEXT, image_url TEXT, is_active INTEGER NOT NULL DEFAULT 1,
        stock_quantity INTEGER NOT NULL DEFAULT 0, low_stock_threshold INTEGER NOT NULL DEFAULT 5,
        metadata TEXT, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
        name TEXT NOT NULL, phone TEXT, email TEXT, notes TEXT,
        total_spent REAL NOT NULL DEFAULT 0, visit_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
        order_number TEXT NOT NULL, customer_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending', subtotal REAL NOT NULL,
        tax REAL NOT NULL DEFAULT 0, discount REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL, payment_method TEXT NOT NULL, notes TEXT, metadata TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id),
        product_id TEXT NOT NULL, product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL, unit_price REAL NOT NULL,
        subtotal REAL NOT NULL, notes TEXT
      );
    `);

    db.insert(schema.tenants).values({
      id: tenantId, name: 'Dashboard Test', industry: 'restaurant', plan: 'free', createdAt: new Date(),
    }).run();

    // Create some products
    db.insert(schema.products).values([
      { id: 'p1', tenantId, name: 'Product A', price: 100, stockQuantity: 50, createdAt: new Date() },
      { id: 'p2', tenantId, name: 'Product B', price: 200, stockQuantity: 30, createdAt: new Date() },
    ]).run();

    // Create some orders
    const now = new Date();
    db.insert(schema.orders).values([
      { id: 'o1', tenantId, orderNumber: 'ORD-001', status: 'completed', subtotal: 300, tax: 15, total: 315, paymentMethod: 'cash', createdAt: now },
      { id: 'o2', tenantId, orderNumber: 'ORD-002', status: 'completed', subtotal: 500, tax: 25, total: 525, paymentMethod: 'card', createdAt: now },
    ]).run();

    db.insert(schema.orderItems).values([
      { id: 'oi1', orderId: 'o1', productId: 'p1', productName: 'Product A', quantity: 3, unitPrice: 100, subtotal: 300 },
      { id: 'oi2', orderId: 'o2', productId: 'p2', productName: 'Product B', quantity: 2, unitPrice: 200, subtotal: 400 },
      { id: 'oi3', orderId: 'o2', productId: 'p1', productName: 'Product A', quantity: 1, unitPrice: 100, subtotal: 100 },
    ]).run();
  });

  afterAll(() => {
    sqlite.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('should count products for tenant', () => {
    const result = db.select({ count: sql<number>`count(*)` })
      .from(schema.products)
      .where(eq(schema.products.tenantId, tenantId))
      .get();
    expect(result?.count).toBe(2);
  });

  it('should calculate today revenue', () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const result = db.select({
      count: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(${schema.orders.total}), 0)`,
    })
      .from(schema.orders)
      .where(and(
        eq(schema.orders.tenantId, tenantId),
        eq(schema.orders.status, 'completed'),
        gte(schema.orders.createdAt, todayStart),
      ))
      .get();

    expect(result?.count).toBe(2);
    expect(result?.revenue).toBe(840); // 315 + 525
  });

  it('should get top products by quantity', () => {
    const topProducts = db.select({
      productName: schema.orderItems.productName,
      totalQty: sql<number>`sum(${schema.orderItems.quantity})`,
    })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .where(and(
        eq(schema.orders.tenantId, tenantId),
        eq(schema.orders.status, 'completed'),
      ))
      .groupBy(schema.orderItems.productName)
      .orderBy(sql`sum(${schema.orderItems.quantity}) DESC`)
      .limit(5)
      .all();

    expect(topProducts.length).toBe(2);
    expect(topProducts[0].productName).toBe('Product A'); // 3 + 1 = 4 qty
    expect(topProducts[0].totalQty).toBe(4);
  });

  it('should return recent orders', () => {
    const recentOrders = db.select()
      .from(schema.orders)
      .where(eq(schema.orders.tenantId, tenantId))
      .orderBy(sql`${schema.orders.createdAt} DESC`)
      .limit(5)
      .all();

    expect(recentOrders.length).toBe(2);
  });
});
