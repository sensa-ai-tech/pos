import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import * as fs from 'fs';

const TEST_DB_PATH = './data/test-activate.db';

describe('Feature Activate/Deactivate', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;
  const tenantId = 'test-tenant-act';

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
      id: tenantId, name: 'Activate Test', industry: 'retail', plan: 'free', createdAt: new Date(),
    }).run();

    db.insert(schema.featureCatalog).values([
      { id: 'crm', name: 'CRM', description: 'CRM module', category: 'crm', priceMonthly: 499, isFree: false },
      { id: 'analytics', name: 'Analytics', description: 'Analytics', category: 'analytics', priceMonthly: 399, isFree: false },
      { id: 'employee_mgmt', name: 'Employee', description: 'Employee mgmt', category: 'hr', priceMonthly: 299, isFree: false },
    ]).run();
  });

  afterAll(() => {
    sqlite.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('should activate a new feature', () => {
    db.insert(schema.tenantFeatures).values({
      id: crypto.randomUUID(),
      tenantId,
      featureId: 'crm',
      isActive: true,
      activatedAt: new Date(),
    }).run();

    const feature = db.select().from(schema.tenantFeatures)
      .where(and(
        eq(schema.tenantFeatures.tenantId, tenantId),
        eq(schema.tenantFeatures.featureId, 'crm'),
      )).get();
    expect(feature).toBeDefined();
    expect(feature!.isActive).toBe(true);
  });

  it('should deactivate an existing feature', () => {
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
      )).get();
    expect(feature).toBeDefined();
    expect(feature!.isActive).toBe(false);
  });

  it('should reactivate a deactivated feature', () => {
    db.update(schema.tenantFeatures)
      .set({ isActive: true, activatedAt: new Date() })
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
    expect(feature).toBeDefined();
  });

  it('should activate multiple features independently', () => {
    db.insert(schema.tenantFeatures).values({
      id: crypto.randomUUID(),
      tenantId,
      featureId: 'analytics',
      isActive: true,
      activatedAt: new Date(),
    }).run();

    db.insert(schema.tenantFeatures).values({
      id: crypto.randomUUID(),
      tenantId,
      featureId: 'employee_mgmt',
      isActive: true,
      activatedAt: new Date(),
    }).run();

    const all = db.select().from(schema.tenantFeatures)
      .where(and(
        eq(schema.tenantFeatures.tenantId, tenantId),
        eq(schema.tenantFeatures.isActive, true),
      )).all();
    expect(all.length).toBe(3); // crm (reactivated) + analytics + employee_mgmt
  });

  it('should not affect other tenants when activating', () => {
    const otherTenant = 'other-tenant';
    db.insert(schema.tenants).values({
      id: otherTenant, name: 'Other', industry: 'service', plan: 'free', createdAt: new Date(),
    }).run();

    const otherFeatures = db.select().from(schema.tenantFeatures)
      .where(eq(schema.tenantFeatures.tenantId, otherTenant)).all();
    expect(otherFeatures).toHaveLength(0);
  });
});
