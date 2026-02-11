import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { restaurantTemplate } from '../../src/db/templates/restaurant';
import { retailTemplate } from '../../src/db/templates/retail';
import { medicalTemplate } from '../../src/db/templates/medical';
import { serviceTemplate } from '../../src/db/templates/service';
import * as fs from 'fs';

const TEST_DB_PATH = './data/test-setup.db';

describe('Setup API Logic', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;

  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    const dir = './data';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    sqlite = new Database(TEST_DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite, { schema });

    // Create tables
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
    `);

    // Seed feature catalog
    const features = [
      { id: 'feat-pos', name: 'POS 基礎', description: '基礎收銀功能', category: 'core', priceMonthly: 0, isFree: true },
      { id: 'feat-inv', name: '庫存管理', description: '基礎庫存功能', category: 'core', priceMonthly: 0, isFree: true },
      { id: 'feat-crm', name: '顧客管理', description: 'CRM 功能', category: 'premium', priceMonthly: 299, isFree: false },
    ];
    for (const f of features) {
      db.insert(schema.featureCatalog).values(f).run();
    }
  });

  afterAll(() => {
    sqlite.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  function simulateSetup(industry: string, templateData: typeof restaurantTemplate) {
    const tenantId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const now = new Date();

    const txn = sqlite.transaction(() => {
      db.insert(schema.tenants).values({
        id: tenantId,
        name: `Test ${industry}`,
        industry: industry as 'restaurant' | 'retail' | 'medical' | 'service',
        plan: 'free',
        settings: JSON.stringify(templateData.settings),
        createdAt: now,
      }).run();

      db.insert(schema.users).values({
        id: userId,
        tenantId,
        email: `${industry}-${tenantId.slice(0, 8)}@test.com`,
        passwordHash: 'hashed_test',
        name: `${industry} Admin`,
        role: 'owner',
        createdAt: now,
      }).run();

      const categoryIdMap = new Map<string, string>();
      for (const cat of templateData.categories) {
        const catId = crypto.randomUUID();
        categoryIdMap.set(cat.name, catId);
        db.insert(schema.categories).values({
          id: catId,
          tenantId,
          name: cat.name,
          sortOrder: cat.sortOrder,
        }).run();
      }

      for (const prod of templateData.products) {
        db.insert(schema.products).values({
          id: crypto.randomUUID(),
          tenantId,
          categoryId: categoryIdMap.get(prod.category) ?? null,
          name: prod.name,
          price: prod.price,
          stockQuantity: prod.stockQuantity,
          sku: ('sku' in prod) ? (prod as { sku: string }).sku : null,
          barcode: ('barcode' in prod) ? (prod as { barcode: string }).barcode : null,
          metadata: ('metadata' in prod) ? (prod as { metadata: string }).metadata : null,
          createdAt: now,
        }).run();
      }

      // Activate free features
      const freeFeatures = db.select().from(schema.featureCatalog)
        .where(eq(schema.featureCatalog.isFree, true))
        .all();

      for (const feature of freeFeatures) {
        db.insert(schema.tenantFeatures).values({
          id: crypto.randomUUID(),
          tenantId,
          featureId: feature.id,
          isActive: true,
          activatedAt: now,
        }).run();
      }
    });

    txn();
    return { tenantId, userId };
  }

  it('should create restaurant tenant with correct data', () => {
    const { tenantId } = simulateSetup('restaurant', restaurantTemplate);
    const tenant = db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId)).get();
    expect(tenant).toBeDefined();
    expect(tenant!.industry).toBe('restaurant');

    const cats = db.select().from(schema.categories).where(eq(schema.categories.tenantId, tenantId)).all();
    expect(cats).toHaveLength(restaurantTemplate.categories.length);

    const prods = db.select().from(schema.products).where(eq(schema.products.tenantId, tenantId)).all();
    expect(prods).toHaveLength(restaurantTemplate.products.length);
  });

  it('should create retail tenant with SKU and barcode', () => {
    const { tenantId } = simulateSetup('retail', retailTemplate);
    const prods = db.select().from(schema.products).where(eq(schema.products.tenantId, tenantId)).all();
    const withSku = prods.filter((p) => p.sku !== null);
    expect(withSku.length).toBeGreaterThan(0);
  });

  it('should create medical tenant with zero tax', () => {
    const { tenantId } = simulateSetup('medical', medicalTemplate);
    const tenant = db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId)).get();
    const settings = JSON.parse(tenant!.settings!);
    expect(settings.taxRate).toBe(0);
  });

  it('should create service tenant with booking settings', () => {
    const { tenantId } = simulateSetup('service', serviceTemplate);
    const tenant = db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId)).get();
    const settings = JSON.parse(tenant!.settings!);
    expect(settings.enableBooking).toBe(true);
    expect(settings.enableTechnician).toBe(true);
  });

  it('should activate free features for new tenant', () => {
    const { tenantId } = simulateSetup('restaurant', {
      ...restaurantTemplate,
      categories: restaurantTemplate.categories.map((c, i) => ({ ...c, name: `Extra ${i}` })),
      products: restaurantTemplate.products.map((p, i) => ({ ...p, name: `Extra Prod ${i}`, category: `Extra ${i % 5}` })),
    });
    const features = db.select().from(schema.tenantFeatures).where(eq(schema.tenantFeatures.tenantId, tenantId)).all();
    expect(features.length).toBe(2); // 2 free features
    features.forEach((f) => {
      expect(f.isActive).toBe(true);
    });
  });

  it('should isolate data between tenants', () => {
    const t1 = simulateSetup('restaurant', {
      ...restaurantTemplate,
      categories: [{ name: 'Unique1', sortOrder: 1 }],
      products: [{ name: 'Iso Product', price: 100, category: 'Unique1', stockQuantity: 10 }],
    });
    const t2 = simulateSetup('retail', {
      ...retailTemplate,
      categories: [{ name: 'Unique2', sortOrder: 1 }],
      products: [{ name: 'Iso Product 2', price: 200, category: 'Unique2', stockQuantity: 20 }],
    });

    const prods1 = db.select().from(schema.products).where(eq(schema.products.tenantId, t1.tenantId)).all();
    const prods2 = db.select().from(schema.products).where(eq(schema.products.tenantId, t2.tenantId)).all();
    expect(prods1).toHaveLength(1);
    expect(prods2).toHaveLength(1);
    expect(prods1[0].name).not.toBe(prods2[0].name);
  });
});
