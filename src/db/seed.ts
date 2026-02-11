import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';
import * as schema from './schema';

const dbPath = path.join(process.cwd(), 'data', 'pos.db');
mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

const db = drizzle(sqlite, { schema });

function seed() {
  console.log('Seeding database...');

  // Create tables using drizzle-kit push (tables should already exist)
  // If not, we create them manually
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      settings TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      category_id TEXT REFERENCES categories(id),
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      cost REAL,
      sku TEXT,
      barcode TEXT,
      image_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      metadata TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      notes TEXT,
      total_spent REAL NOT NULL DEFAULT 0,
      visit_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      order_number TEXT NOT NULL,
      customer_id TEXT REFERENCES customers(id),
      status TEXT NOT NULL DEFAULT 'pending',
      subtotal REAL NOT NULL,
      tax REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      notes TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      order_id TEXT NOT NULL REFERENCES orders(id),
      amount REAL NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS feature_catalog (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      price_monthly REAL NOT NULL,
      is_free INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tenant_features (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      feature_id TEXT NOT NULL REFERENCES feature_catalog(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      activated_at INTEGER NOT NULL,
      expires_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS industry_templates (
      id TEXT PRIMARY KEY,
      industry TEXT NOT NULL,
      template_data TEXT NOT NULL,
      description TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL DEFAULT 0,
      batch_number TEXT,
      expires_at INTEGER,
      location TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  const now = Math.floor(Date.now() / 1000);

  // Clear existing data
  sqlite.exec('DELETE FROM tenant_features');
  sqlite.exec('DELETE FROM feature_catalog');
  sqlite.exec('DELETE FROM order_items');
  sqlite.exec('DELETE FROM payments');
  sqlite.exec('DELETE FROM orders');
  sqlite.exec('DELETE FROM inventory');
  sqlite.exec('DELETE FROM products');
  sqlite.exec('DELETE FROM categories');
  sqlite.exec('DELETE FROM customers');
  sqlite.exec('DELETE FROM users');
  sqlite.exec('DELETE FROM industry_templates');
  sqlite.exec('DELETE FROM tenants');

  // ========== Tenants ==========
  db.insert(schema.tenants).values([
    { id: 'tenant-a', name: '美味餐廳', industry: 'restaurant', plan: 'free', createdAt: new Date(now * 1000) },
    { id: 'tenant-b', name: '時尚精品店', industry: 'retail', plan: 'free', createdAt: new Date(now * 1000) },
  ]).run();

  // ========== Users ==========
  db.insert(schema.users).values([
    {
      id: 'user-a1',
      tenantId: 'tenant-a',
      email: 'owner-a@example.com',
      passwordHash: '$2a$10$placeholder_hash_for_password123',
      name: '王老闆',
      role: 'owner',
      createdAt: new Date(now * 1000),
    },
    {
      id: 'user-b1',
      tenantId: 'tenant-b',
      email: 'owner-b@example.com',
      passwordHash: '$2a$10$placeholder_hash_for_password123',
      name: '李店長',
      role: 'owner',
      createdAt: new Date(now * 1000),
    },
  ]).run();

  // ========== Feature Catalog ==========
  const features = [
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

  db.insert(schema.featureCatalog).values(features).run();

  // ========== Auto-unlock free features ==========
  const freeFeatures = features.filter(f => f.isFree);
  const tenantIds = ['tenant-a', 'tenant-b'];
  const tenantFeatureRows: Array<{
    id: string;
    tenantId: string;
    featureId: string;
    isActive: boolean;
    activatedAt: Date;
  }> = [];

  for (const tenantId of tenantIds) {
    for (const feature of freeFeatures) {
      tenantFeatureRows.push({
        id: `${tenantId}-${feature.id}`,
        tenantId,
        featureId: feature.id,
        isActive: true,
        activatedAt: new Date(now * 1000),
      });
    }
  }

  db.insert(schema.tenantFeatures).values(tenantFeatureRows).run();

  // ========== Categories for tenant-a (restaurant) ==========
  const restaurantCategories = [
    { id: 'cat-a1', tenantId: 'tenant-a', name: '前菜', sortOrder: 1 },
    { id: 'cat-a2', tenantId: 'tenant-a', name: '主餐', sortOrder: 2 },
    { id: 'cat-a3', tenantId: 'tenant-a', name: '飲料', sortOrder: 3 },
    { id: 'cat-a4', tenantId: 'tenant-a', name: '甜點', sortOrder: 4 },
  ];
  db.insert(schema.categories).values(restaurantCategories).run();

  // ========== Products for tenant-a ==========
  db.insert(schema.products).values([
    { id: 'prod-a1', tenantId: 'tenant-a', categoryId: 'cat-a1', name: '凱薩沙拉', price: 180, stockQuantity: 50, createdAt: new Date(now * 1000) },
    { id: 'prod-a2', tenantId: 'tenant-a', categoryId: 'cat-a1', name: '蒜香麵包', price: 80, stockQuantity: 100, createdAt: new Date(now * 1000) },
    { id: 'prod-a3', tenantId: 'tenant-a', categoryId: 'cat-a2', name: '碳烤牛排', price: 580, stockQuantity: 30, createdAt: new Date(now * 1000) },
    { id: 'prod-a4', tenantId: 'tenant-a', categoryId: 'cat-a2', name: '香煎鮭魚', price: 420, stockQuantity: 25, createdAt: new Date(now * 1000) },
    { id: 'prod-a5', tenantId: 'tenant-a', categoryId: 'cat-a3', name: '紅茶', price: 60, stockQuantity: 200, createdAt: new Date(now * 1000) },
    { id: 'prod-a6', tenantId: 'tenant-a', categoryId: 'cat-a3', name: '美式咖啡', price: 120, stockQuantity: 200, createdAt: new Date(now * 1000) },
    { id: 'prod-a7', tenantId: 'tenant-a', categoryId: 'cat-a4', name: '提拉米蘇', price: 160, stockQuantity: 40, createdAt: new Date(now * 1000) },
    { id: 'prod-a8', tenantId: 'tenant-a', categoryId: 'cat-a4', name: '巧克力蛋糕', price: 140, stockQuantity: 40, createdAt: new Date(now * 1000) },
  ]).run();

  // ========== Categories for tenant-b (retail) ==========
  const retailCategories = [
    { id: 'cat-b1', tenantId: 'tenant-b', name: '服飾', sortOrder: 1 },
    { id: 'cat-b2', tenantId: 'tenant-b', name: '配件', sortOrder: 2 },
    { id: 'cat-b3', tenantId: 'tenant-b', name: '鞋類', sortOrder: 3 },
    { id: 'cat-b4', tenantId: 'tenant-b', name: '生活用品', sortOrder: 4 },
  ];
  db.insert(schema.categories).values(retailCategories).run();

  // ========== Products for tenant-b ==========
  db.insert(schema.products).values([
    { id: 'prod-b1', tenantId: 'tenant-b', categoryId: 'cat-b1', name: '棉質T恤', price: 590, sku: 'TEE-001', stockQuantity: 100, createdAt: new Date(now * 1000) },
    { id: 'prod-b2', tenantId: 'tenant-b', categoryId: 'cat-b1', name: '牛仔褲', price: 1290, sku: 'JNS-001', stockQuantity: 50, createdAt: new Date(now * 1000) },
    { id: 'prod-b3', tenantId: 'tenant-b', categoryId: 'cat-b2', name: '皮帶', price: 890, sku: 'BLT-001', stockQuantity: 30, createdAt: new Date(now * 1000) },
    { id: 'prod-b4', tenantId: 'tenant-b', categoryId: 'cat-b2', name: '太陽眼鏡', price: 1590, sku: 'SNG-001', stockQuantity: 20, createdAt: new Date(now * 1000) },
    { id: 'prod-b5', tenantId: 'tenant-b', categoryId: 'cat-b3', name: '運動鞋', price: 2490, sku: 'SHO-001', stockQuantity: 40, createdAt: new Date(now * 1000) },
    { id: 'prod-b6', tenantId: 'tenant-b', categoryId: 'cat-b3', name: '皮鞋', price: 3290, sku: 'SHO-002', stockQuantity: 15, createdAt: new Date(now * 1000) },
    { id: 'prod-b7', tenantId: 'tenant-b', categoryId: 'cat-b4', name: '保溫瓶', price: 790, sku: 'LIF-001', stockQuantity: 60, createdAt: new Date(now * 1000) },
    { id: 'prod-b8', tenantId: 'tenant-b', categoryId: 'cat-b4', name: '環保袋', price: 290, sku: 'LIF-002', stockQuantity: 80, createdAt: new Date(now * 1000) },
  ]).run();

  console.log('Seed completed successfully!');
  console.log('  - 2 tenants created');
  console.log('  - 2 users created');
  console.log('  - 11 feature catalog entries created');
  console.log('  - 6 free features activated for both tenants');
  console.log('  - 8 categories created');
  console.log('  - 16 products created');
}

seed();
sqlite.close();
