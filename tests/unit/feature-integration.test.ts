import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import * as fs from 'fs';
import { FEATURES } from '../../src/lib/feature-ids';

const TEST_DB_PATH = './data/test-feature-integ.db';

describe('Feature Integration', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;
  const tenantId = 'test-tenant-integ';

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
      id: tenantId, name: 'Integration Test', industry: 'restaurant', plan: 'free', createdAt: new Date(),
    }).run();

    // Full feature catalog matching seed data
    const features = [
      { id: 'basic_pos', name: 'POS', description: 'Basic POS', category: 'core', priceMonthly: 0, isFree: true },
      { id: 'basic_inventory', name: 'Inventory', description: 'Basic inventory', category: 'core', priceMonthly: 0, isFree: true },
      { id: 'basic_reports', name: 'Reports', description: 'Basic reports', category: 'core', priceMonthly: 0, isFree: true },
      { id: 'crm', name: 'CRM', description: 'CRM', category: 'crm', priceMonthly: 499, isFree: false },
      { id: 'employee_mgmt', name: 'Employees', description: 'Employee mgmt', category: 'hr', priceMonthly: 299, isFree: false },
      { id: 'analytics', name: 'Analytics', description: 'Analytics', category: 'analytics', priceMonthly: 399, isFree: false },
    ];
    db.insert(schema.featureCatalog).values(features).run();

    // Activate free features
    const freeFeatures = features.filter((f) => f.isFree);
    for (const f of freeFeatures) {
      db.insert(schema.tenantFeatures).values({
        id: crypto.randomUUID(),
        tenantId,
        featureId: f.id,
        isActive: true,
        activatedAt: new Date(),
      }).run();
    }
  });

  afterAll(() => {
    sqlite.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('should have all free features active by default', () => {
    const active = db.select().from(schema.tenantFeatures)
      .where(and(
        eq(schema.tenantFeatures.tenantId, tenantId),
        eq(schema.tenantFeatures.isActive, true),
      )).all();
    expect(active.length).toBe(3); // 3 free features
  });

  it('should correctly reference FEATURES constant IDs', () => {
    expect(FEATURES.POS).toBe('basic_pos');
    expect(FEATURES.CRM).toBe('crm');
    expect(FEATURES.EMPLOYEE_MGMT).toBe('employee_mgmt');
    expect(FEATURES.ANALYTICS).toBe('analytics');
  });

  it('should block access to CRM without activation', () => {
    const crmFeature = db.select().from(schema.tenantFeatures)
      .where(and(
        eq(schema.tenantFeatures.tenantId, tenantId),
        eq(schema.tenantFeatures.featureId, FEATURES.CRM),
        eq(schema.tenantFeatures.isActive, true),
      )).get();
    expect(crmFeature).toBeUndefined();
  });

  it('should allow access after CRM activation', () => {
    db.insert(schema.tenantFeatures).values({
      id: crypto.randomUUID(),
      tenantId,
      featureId: FEATURES.CRM,
      isActive: true,
      activatedAt: new Date(),
    }).run();

    const crmFeature = db.select().from(schema.tenantFeatures)
      .where(and(
        eq(schema.tenantFeatures.tenantId, tenantId),
        eq(schema.tenantFeatures.featureId, FEATURES.CRM),
        eq(schema.tenantFeatures.isActive, true),
      )).get();
    expect(crmFeature).toBeDefined();
  });

  it('should show correct pricing from catalog', () => {
    const crm = db.select().from(schema.featureCatalog)
      .where(eq(schema.featureCatalog.id, 'crm')).get();
    expect(crm?.priceMonthly).toBe(499);
    expect(crm?.isFree).toBe(false);
  });

  it('should list all available features with status', () => {
    const allFeatures = db.select().from(schema.featureCatalog).all();
    const tenantFeaturesData = db.select().from(schema.tenantFeatures)
      .where(eq(schema.tenantFeatures.tenantId, tenantId)).all();

    const activeIds = new Set(tenantFeaturesData.filter((f) => f.isActive).map((f) => f.featureId));

    const result = allFeatures.map((f) => ({
      id: f.id,
      isActive: activeIds.has(f.id),
    }));

    expect(result).toHaveLength(6);
    const activeResults = result.filter((r) => r.isActive);
    expect(activeResults.length).toBe(4); // 3 free + 1 CRM we activated
  });
});
