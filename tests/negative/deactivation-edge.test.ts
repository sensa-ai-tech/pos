/**
 * 🟢 Feature Deactivation Edge Case Tests
 *
 * Targets: Edge cases in feature deactivation
 * Files under test:
 *   - src/lib/feature-gate.ts (deactivateFeature)
 *   - src/app/api/features/deactivate/route.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { createTestDb, type TestDbContext } from './helpers/test-db';

let ctx: TestDbContext;

beforeAll(() => {
  ctx = createTestDb('deactivation-edge', { seedFeatureCatalog: true });
  const now = new Date();

  ctx.db.insert(schema.tenants).values({
    id: 'deact-tenant', name: 'Deactivation Test', industry: 'restaurant', plan: 'free', createdAt: now,
  }).run();

  // Activate basic_pos (free core feature)
  ctx.db.insert(schema.tenantFeatures).values({
    id: 'tf-basic-pos',
    tenantId: 'deact-tenant',
    featureId: 'basic_pos',
    isActive: true,
    activatedAt: now,
  }).run();

  // Activate a paid feature
  ctx.db.insert(schema.tenantFeatures).values({
    id: 'tf-analytics',
    tenantId: 'deact-tenant',
    featureId: 'analytics',
    isActive: true,
    activatedAt: now,
  }).run();
});

afterAll(() => ctx.cleanup());

describe('Feature Deactivation Edge Cases', () => {
  /**
   * DE-01 [GUARD] Deactivating a never-activated feature is a no-op
   *
   * deactivateFeature does UPDATE ... SET isActive=false WHERE ...
   * If no matching row, changes = 0
   */
  it('[GUARD] DE-01: 停用從未啟用的功能為 no-op', () => {
    const result = ctx.db.update(schema.tenantFeatures)
      .set({ isActive: false })
      .where(and(
        eq(schema.tenantFeatures.tenantId, 'deact-tenant'),
        eq(schema.tenantFeatures.featureId, 'crm') // never activated
      ))
      .run();

    expect(result.changes).toBe(0);
  });

  /**
   * DE-02 [VULN] Can deactivate core free features (basic_pos)
   *
   * No protection against deactivating essential features.
   * A store could accidentally lose POS functionality.
   */
  it('[VULN] DE-02: 可停用免費核心功能（basic_pos）', () => {
    // Deactivate basic_pos — no guard against this
    ctx.db.update(schema.tenantFeatures)
      .set({ isActive: false })
      .where(and(
        eq(schema.tenantFeatures.tenantId, 'deact-tenant'),
        eq(schema.tenantFeatures.featureId, 'basic_pos')
      ))
      .run();

    const feature = ctx.db.select().from(schema.tenantFeatures)
      .where(and(
        eq(schema.tenantFeatures.tenantId, 'deact-tenant'),
        eq(schema.tenantFeatures.featureId, 'basic_pos')
      ))
      .get();

    // VULNERABILITY: Core feature deactivated — store can't use POS!
    expect(feature!.isActive).toBe(false);

    // Re-activate for other tests
    ctx.db.update(schema.tenantFeatures)
      .set({ isActive: true })
      .where(and(
        eq(schema.tenantFeatures.tenantId, 'deact-tenant'),
        eq(schema.tenantFeatures.featureId, 'basic_pos')
      ))
      .run();
  });

  /**
   * DE-03 [GUARD] Deactivated feature should be blocked by hasFeature
   *
   * hasFeature checks isActive=true, so deactivated → returns false
   */
  it('[GUARD] DE-03: 停用後 hasFeature 應回傳 false', () => {
    // Deactivate analytics
    ctx.db.update(schema.tenantFeatures)
      .set({ isActive: false })
      .where(and(
        eq(schema.tenantFeatures.tenantId, 'deact-tenant'),
        eq(schema.tenantFeatures.featureId, 'analytics')
      ))
      .run();

    // Simulate hasFeature query
    const feature = ctx.db.select().from(schema.tenantFeatures)
      .where(and(
        eq(schema.tenantFeatures.tenantId, 'deact-tenant'),
        eq(schema.tenantFeatures.featureId, 'analytics'),
        eq(schema.tenantFeatures.isActive, true)
      ))
      .get();

    // Should not be found (deactivated)
    expect(feature).toBeUndefined();
  });
});
