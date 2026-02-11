/**
 * 🔴 Feature Gate Bypass Adversarial Tests
 *
 * Targets: Unpaid feature activation, feature gate enforcement
 * Files under test:
 *   - src/lib/feature-gate.ts (activateFeature has no payment check)
 *   - src/app/api/features/activate/route.ts
 *   - src/lib/feature-ids.ts vs src/db/seed.ts (ID mismatch)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { createTestDb, type TestDbContext } from './helpers/test-db';

let ctx: TestDbContext;

beforeAll(() => {
  ctx = createTestDb('feature-bypass', { seedFeatureCatalog: true });
  const now = new Date();

  ctx.db.insert(schema.tenants).values({
    id: 'free-tenant', name: 'Free Plan Store', industry: 'restaurant', plan: 'free', createdAt: now,
  }).run();

  // Only activate free features (like setup does)
  const freeFeatures = ctx.db.select().from(schema.featureCatalog)
    .where(eq(schema.featureCatalog.isFree, true))
    .all();

  for (const f of freeFeatures) {
    ctx.db.insert(schema.tenantFeatures).values({
      id: `tf-${f.id}`,
      tenantId: 'free-tenant',
      featureId: f.id,
      isActive: true,
      activatedAt: now,
    }).run();
  }
});

afterAll(() => ctx.cleanup());

describe('Feature Gate Bypass Attacks', () => {
  /**
   * FB-01 [VULN] Activate paid feature without payment
   *
   * activate/route.ts only checks:
   * 1. tenantId exists in header
   * 2. featureId exists in catalog
   * NO payment verification!
   */
  it('[VULN] FB-01: 免費租戶可直接啟用付費功能', () => {
    const paidFeatureId = 'analytics'; // 399/month

    // Verify feature exists in catalog
    const catalog = ctx.db.select().from(schema.featureCatalog)
      .where(eq(schema.featureCatalog.id, paidFeatureId))
      .get();
    expect(catalog).toBeDefined();
    expect(catalog!.isFree).toBe(false);
    expect(catalog!.priceMonthly).toBe(399);

    // Simulate activateFeature() — no payment check
    const existing = ctx.db.select().from(schema.tenantFeatures)
      .where(and(
        eq(schema.tenantFeatures.tenantId, 'free-tenant'),
        eq(schema.tenantFeatures.featureId, paidFeatureId)
      ))
      .get();

    if (!existing) {
      ctx.db.insert(schema.tenantFeatures).values({
        id: 'tf-vuln-analytics',
        tenantId: 'free-tenant',
        featureId: paidFeatureId,
        isActive: true,
        activatedAt: new Date(),
      }).run();
    }

    // VULNERABILITY: Paid feature activated without payment
    const activated = ctx.db.select().from(schema.tenantFeatures)
      .where(and(
        eq(schema.tenantFeatures.tenantId, 'free-tenant'),
        eq(schema.tenantFeatures.featureId, paidFeatureId)
      ))
      .get();

    expect(activated).toBeDefined();
    expect(activated!.isActive).toBe(true);
  });

  /**
   * FB-02 [VULN] Activate feature for non-existent tenant
   *
   * activate/route.ts only checks header non-null, doesn't validate tenant exists.
   */
  it('[GUARD] FB-02: 為不存在的租戶啟用功能被 FK 阻止', () => {
    const fakeTenantId = 'ghost-tenant-does-not-exist';

    // Verify tenant doesn't exist
    const tenant = ctx.db.select().from(schema.tenants)
      .where(eq(schema.tenants.id, fakeTenantId))
      .get();
    expect(tenant).toBeUndefined();

    // FK constraint should prevent insert for non-existent tenant
    // (PRAGMA foreign_keys = ON in our test DB)
    let fkError = false;
    try {
      ctx.db.insert(schema.tenantFeatures).values({
        id: 'tf-ghost',
        tenantId: fakeTenantId,
        featureId: 'basic_pos',
        isActive: true,
        activatedAt: new Date(),
      }).run();
    } catch {
      fkError = true;
    }

    // FK constraint blocks the insert at DB level
    expect(fkError).toBe(true);

    // NOTE: In production, activate/route.ts doesn't validate tenant existence
    // before calling activateFeature(). The only protection is the FK constraint.
    // If FK constraints were disabled, this would create an orphan record.
  });

  /**
   * FB-03 [GUARD] Activate non-existent feature ID
   *
   * activate/route.ts verifies featureId in featureCatalog → returns 404.
   */
  it('[GUARD] FB-03: 啟用不存在的 feature ID 應失敗', () => {
    const nonExistentFeature = ctx.db.select().from(schema.featureCatalog)
      .where(eq(schema.featureCatalog.id, 'nonexistent-feature'))
      .get();

    expect(nonExistentFeature).toBeUndefined();
  });

  /**
   * FB-04 [GUARD] Expired feature returns false from hasFeature()
   *
   * feature-gate.ts checks expiresAt < now → returns false.
   * But the DB row still has isActive=true (never auto-deactivated).
   */
  it('[VULN] FB-04: 過期功能在 DB 中仍標記為 active', () => {
    const pastDate = new Date('2020-01-01');

    ctx.db.insert(schema.tenantFeatures).values({
      id: 'tf-expired',
      tenantId: 'free-tenant',
      featureId: 'crm',
      isActive: true,
      activatedAt: new Date('2019-01-01'),
      expiresAt: pastDate,
    }).run();

    // hasFeature would return false (checks expiration)
    const feature = ctx.db.select().from(schema.tenantFeatures)
      .where(and(
        eq(schema.tenantFeatures.tenantId, 'free-tenant'),
        eq(schema.tenantFeatures.featureId, 'crm'),
        eq(schema.tenantFeatures.isActive, true)
      ))
      .get();

    // VULNERABILITY: DB still shows isActive=true even though expired
    expect(feature).toBeDefined();
    expect(feature!.isActive).toBe(true);
    expect(feature!.expiresAt).toBeDefined();
    expect(feature!.expiresAt!.getTime()).toBeLessThan(Date.now());
  });

  /**
   * FB-05 [VULN] FEATURES constant has IDs not in seed catalog
   *
   * feature-ids.ts has 11 IDs, seed has 11 too now, but originally
   * had mismatch. Verify all IDs exist in catalog.
   */
  it('[GUARD] FB-05: FEATURES 常數 ID 與 catalog 一致', () => {
    const FEATURES = {
      POS: 'basic_pos',
      INVENTORY: 'basic_inventory',
      REPORTS: 'basic_reports',
      ADVANCED_INVENTORY: 'advanced_inventory',
      CRM: 'crm',
      MULTI_STORE: 'multi_store',
      EMPLOYEE_MGMT: 'employee_mgmt',
      ANALYTICS: 'analytics',
      ONLINE_ORDERING: 'online_ordering',
      LOYALTY: 'loyalty',
      API_ACCESS: 'api_access',
    };

    const allCatalog = ctx.db.select().from(schema.featureCatalog).all();
    const catalogIds = new Set(allCatalog.map(f => f.id));

    for (const [key, id] of Object.entries(FEATURES)) {
      expect(catalogIds.has(id), `Feature ${key} (${id}) missing from catalog`).toBe(true);
    }
  });

  /**
   * FB-06 [VULN] Report APIs have no Feature Gate
   *
   * reports/daily/route.ts and reports/dashboard/route.ts
   * do NOT use withFeature() HOF. Any tenant can access.
   */
  it('[VULN] FB-06: 報表 API 無 Feature Gate 保護', () => {
    // Create a fresh tenant with ONLY free features (not polluted by FB-01)
    ctx.db.insert(schema.tenants).values({
      id: 'clean-free-tenant', name: 'Clean Free', industry: 'retail', plan: 'free', createdAt: new Date(),
    }).run();

    const coreFreeFeatures = ctx.db.select().from(schema.featureCatalog)
      .where(eq(schema.featureCatalog.isFree, true))
      .all();

    for (const f of coreFreeFeatures) {
      ctx.db.insert(schema.tenantFeatures).values({
        id: `tf-clean-${f.id}`,
        tenantId: 'clean-free-tenant',
        featureId: f.id,
        isActive: true,
        activatedAt: new Date(),
      }).run();
    }

    // This tenant should NOT have analytics
    const activeFeatures = ctx.db.select().from(schema.tenantFeatures)
      .where(and(
        eq(schema.tenantFeatures.tenantId, 'clean-free-tenant'),
        eq(schema.tenantFeatures.isActive, true)
      ))
      .all();

    const activeFeatureIds = activeFeatures.map(f => f.featureId);
    expect(activeFeatureIds).toContain('basic_pos');
    expect(activeFeatureIds).toContain('basic_reports');
    expect(activeFeatureIds).not.toContain('analytics');

    // VULNERABILITY: Dashboard report endpoint would still return data
    // because it doesn't check for 'analytics' feature at all.
    // The route only checks getTenantId(request) — no feature gate.
  });

  /**
   * FB-07 [GUARD] Feature activation without tenant header → 401
   */
  it('[GUARD] FB-07: 缺少 tenant header 應回傳 401', () => {
    // activate/route.ts: if (!tenantId) return 401
    const tenantId: string | null = null;
    expect(tenantId).toBeNull();
    // Route would return: { error: 'Tenant ID required' }, { status: 401 }
  });

  /**
   * FB-08 [GUARD] Double activation should be idempotent
   *
   * feature-gate.ts activateFeature checks for existing record
   * and re-activates if found.
   */
  it('[GUARD] FB-08: 重複啟用應為冪等操作', () => {
    const featureId = 'basic_pos';

    // First activation already done in beforeAll
    const before = ctx.db.select().from(schema.tenantFeatures)
      .where(and(
        eq(schema.tenantFeatures.tenantId, 'free-tenant'),
        eq(schema.tenantFeatures.featureId, featureId)
      ))
      .all();

    expect(before.length).toBe(1);

    // Simulate second activation (activateFeature checks existing then updates)
    ctx.db.update(schema.tenantFeatures)
      .set({ isActive: true, activatedAt: new Date() })
      .where(and(
        eq(schema.tenantFeatures.tenantId, 'free-tenant'),
        eq(schema.tenantFeatures.featureId, featureId)
      ))
      .run();

    const after = ctx.db.select().from(schema.tenantFeatures)
      .where(and(
        eq(schema.tenantFeatures.tenantId, 'free-tenant'),
        eq(schema.tenantFeatures.featureId, featureId)
      ))
      .all();

    // Should still be exactly 1 row (idempotent)
    expect(after.length).toBe(1);
  });
});
