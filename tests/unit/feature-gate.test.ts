import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import * as fs from 'fs';

const TEST_DB_PATH = './data/test-feature-gate.db';

describe('Feature Gate Logic', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;
  const tenantId = 'test-tenant-fg';

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
      CREATE TABLE IF NOT EXISTS feature_catalog (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
        category TEXT NOT NULL, price_monthly REAL NOT NULL, is_free INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS tenant_features (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
        feature_id TEXT NOT NULL REFERENCES feature_catalog(id),
        is_active INTEGER NOT NULL DEFAULT 1, activated_at INTEGER NOT NULL, expires_at INTEGER
      );
    `);

    db.insert(schema.tenants).values({
      id: tenantId, name: 'Test Store', industry: 'restaurant', plan: 'free', createdAt: new Date(),
    }).run();

    db.insert(schema.featureCatalog).values([
      { id: 'basic_pos', name: 'POS', description: 'Basic POS', category: 'core', priceMonthly: 0, isFree: true },
      { id: 'crm', name: 'CRM', description: 'CRM module', category: 'crm', priceMonthly: 499, isFree: false },
      { id: 'analytics', name: 'Analytics', description: 'Analytics module', category: 'analytics', priceMonthly: 399, isFree: false },
    ]).run();

    // Activate basic_pos for tenant
    db.insert(schema.tenantFeatures).values({
      id: 'tf-1', tenantId, featureId: 'basic_pos', isActive: true, activatedAt: new Date(),
    }).run();
  });

  afterAll(() => {
    sqlite.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('should detect active feature', () => {
    const feature = db.select().from(schema.tenantFeatures)
      .where(and(
        eq(schema.tenantFeatures.tenantId, tenantId),
        eq(schema.tenantFeatures.featureId, 'basic_pos'),
        eq(schema.tenantFeatures.isActive, true),
      )).get();
    expect(feature).toBeDefined();
  });

  it('should not detect inactive feature', () => {
    const feature = db.select().from(schema.tenantFeatures)
      .where(and(
        eq(schema.tenantFeatures.tenantId, tenantId),
        eq(schema.tenantFeatures.featureId, 'crm'),
        eq(schema.tenantFeatures.isActive, true),
      )).get();
    expect(feature).toBeUndefined();
  });

  it('should activate a feature', () => {
    db.insert(schema.tenantFeatures).values({
      id: 'tf-2', tenantId, featureId: 'crm', isActive: true, activatedAt: new Date(),
    }).run();

    const feature = db.select().from(schema.tenantFeatures)
      .where(and(
        eq(schema.tenantFeatures.tenantId, tenantId),
        eq(schema.tenantFeatures.featureId, 'crm'),
        eq(schema.tenantFeatures.isActive, true),
      )).get();
    expect(feature).toBeDefined();
  });

  it('should deactivate a feature', () => {
    db.update(schema.tenantFeatures)
      .set({ isActive: false })
      .where(and(
        eq(schema.tenantFeatures.tenantId, tenantId),
        eq(schema.tenantFeatures.featureId, 'crm'),
      )).run();

    const feature = db.select().from(schema.tenantFeatures)
      .where(and(
        eq(schema.tenantFeatures.tenantId, tenantId),
        eq(schema.tenantFeatures.featureId, 'crm'),
        eq(schema.tenantFeatures.isActive, true),
      )).get();
    expect(feature).toBeUndefined();
  });

  it('should list all features from catalog', () => {
    const all = db.select().from(schema.featureCatalog).all();
    expect(all.length).toBe(3);
  });

  it('should distinguish free vs paid features', () => {
    const free = db.select().from(schema.featureCatalog)
      .where(eq(schema.featureCatalog.isFree, true)).all();
    const paid = db.select().from(schema.featureCatalog)
      .where(eq(schema.featureCatalog.isFree, false)).all();
    expect(free.length).toBe(1);
    expect(paid.length).toBe(2);
  });
});
