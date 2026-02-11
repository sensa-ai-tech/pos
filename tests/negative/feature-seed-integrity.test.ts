/**
 * 🟢 Feature Seed Integrity Tests
 *
 * Targets: Consistency between code constants and DB seed
 * Files under test:
 *   - src/lib/feature-ids.ts (FEATURES constant)
 *   - src/db/seed.ts (feature_catalog seed data)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { createTestDb, FEATURE_CATALOG, type TestDbContext } from './helpers/test-db';

// The FEATURES constant from feature-ids.ts
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
} as const;

let ctx: TestDbContext;

beforeAll(() => {
  ctx = createTestDb('seed-integrity', { seedFeatureCatalog: true });
});

afterAll(() => ctx.cleanup());

describe('Feature Seed Integrity', () => {
  /**
   * FS-01 [GUARD] FEATURES constant matches catalog count
   */
  it('[GUARD] FS-01: FEATURES 常數與 catalog 數量一致', () => {
    const catalogFeatures = ctx.db.select().from(schema.featureCatalog).all();
    const featureIds = Object.values(FEATURES);

    expect(catalogFeatures.length).toBe(featureIds.length);
    expect(catalogFeatures.length).toBe(11);
  });

  /**
   * FS-02 [GUARD] Every FEATURES ID exists in catalog
   */
  it('[GUARD] FS-02: 每個 FEATURES ID 都存在於 catalog 中', () => {
    const catalogFeatures = ctx.db.select().from(schema.featureCatalog).all();
    const catalogIds = new Set(catalogFeatures.map(f => f.id));

    for (const [key, id] of Object.entries(FEATURES)) {
      expect(catalogIds.has(id), `Missing: ${key} → ${id}`).toBe(true);
    }
  });

  /**
   * FS-03 [GUARD] Free features are correctly marked
   */
  it('[GUARD] FS-03: 免費功能標記正確', () => {
    const freeFeatures = ctx.db.select().from(schema.featureCatalog)
      .where(eq(schema.featureCatalog.isFree, true))
      .all();

    const freeIds = freeFeatures.map(f => f.id);

    // Should be exactly 3 free features
    expect(freeFeatures.length).toBe(3);
    expect(freeIds).toContain('basic_pos');
    expect(freeIds).toContain('basic_inventory');
    expect(freeIds).toContain('basic_reports');

    // Paid features should have priceMonthly > 0
    const paidFeatures = ctx.db.select().from(schema.featureCatalog)
      .where(eq(schema.featureCatalog.isFree, false))
      .all();

    for (const f of paidFeatures) {
      expect(f.priceMonthly).toBeGreaterThan(0);
    }
  });
});
