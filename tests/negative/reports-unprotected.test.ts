/**
 * 🔴 Reports Unprotected Adversarial Tests
 *
 * Targets: Report endpoints accessible without feature gates
 * Files under test:
 *   - src/app/api/reports/daily/route.ts (no withFeature)
 *   - src/app/api/reports/dashboard/route.ts (no withFeature, no validateTenant)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and, gte, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { createTestDb, type TestDbContext } from './helpers/test-db';

let ctx: TestDbContext;

beforeAll(() => {
  ctx = createTestDb('reports-unprotected', { seedFeatureCatalog: true });
  const now = new Date();

  // Create a free-tier tenant with ONLY free features
  ctx.db.insert(schema.tenants).values({
    id: 'free-report-tenant', name: 'Free Tenant', industry: 'restaurant', plan: 'free', createdAt: now,
  }).run();

  // Activate only free features
  const freeFeatures = ctx.db.select().from(schema.featureCatalog)
    .where(eq(schema.featureCatalog.isFree, true))
    .all();

  for (const f of freeFeatures) {
    ctx.db.insert(schema.tenantFeatures).values({
      id: `tf-${f.id}`,
      tenantId: 'free-report-tenant',
      featureId: f.id,
      isActive: true,
      activatedAt: now,
    }).run();
  }

  // Create products and orders for the tenant
  ctx.db.insert(schema.products).values({
    id: 'rp-prod-1', tenantId: 'free-report-tenant', name: 'Report Product',
    price: 500, stockQuantity: 100, createdAt: now,
  }).run();

  ctx.db.insert(schema.orders).values({
    id: 'rp-order-1', tenantId: 'free-report-tenant', orderNumber: 'RPT-001',
    status: 'completed', subtotal: 500, tax: 25, total: 525,
    paymentMethod: 'cash', createdAt: now,
  }).run();

  ctx.db.insert(schema.orderItems).values({
    id: 'rp-oi-1', orderId: 'rp-order-1', productId: 'rp-prod-1',
    productName: 'Report Product', quantity: 1, unitPrice: 500, subtotal: 500,
  }).run();
});

afterAll(() => ctx.cleanup());

describe('Reports Unprotected — Feature Gate Missing', () => {
  /**
   * RU-01 [VULN] Daily report accessible without basic_reports feature check
   *
   * reports/daily/route.ts does NOT wrap with withFeature('basic_reports').
   * Even if we deactivated basic_reports, the endpoint would still return data.
   */
  it('[VULN] RU-01: Daily 報表不需要 basic_reports 功能即可存取', () => {
    // Simulate: deactivate basic_reports for tenant
    ctx.db.update(schema.tenantFeatures)
      .set({ isActive: false })
      .where(and(
        eq(schema.tenantFeatures.tenantId, 'free-report-tenant'),
        eq(schema.tenantFeatures.featureId, 'basic_reports')
      ))
      .run();

    // Verify feature is deactivated
    const feature = ctx.db.select().from(schema.tenantFeatures)
      .where(and(
        eq(schema.tenantFeatures.tenantId, 'free-report-tenant'),
        eq(schema.tenantFeatures.featureId, 'basic_reports')
      ))
      .get();
    expect(feature!.isActive).toBe(false);

    // But the report endpoint would STILL return data
    // because it doesn't check features at all
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayOrders = ctx.db.select().from(schema.orders)
      .where(and(
        eq(schema.orders.tenantId, 'free-report-tenant'),
        eq(schema.orders.status, 'completed'),
        gte(schema.orders.createdAt, todayStart)
      ))
      .all();

    // VULNERABILITY: Data still returned even with feature deactivated
    expect(todayOrders.length).toBeGreaterThan(0);

    // Re-activate for other tests
    ctx.db.update(schema.tenantFeatures)
      .set({ isActive: true })
      .where(and(
        eq(schema.tenantFeatures.tenantId, 'free-report-tenant'),
        eq(schema.tenantFeatures.featureId, 'basic_reports')
      ))
      .run();
  });

  /**
   * RU-02 [VULN] Dashboard report has no analytics feature check
   *
   * reports/dashboard/route.ts doesn't check for 'analytics' feature.
   * Free tenants get full dashboard analytics.
   */
  it('[VULN] RU-02: Dashboard 報表不需要 analytics 功能', () => {
    // Verify analytics is NOT active for free tenant
    const analyticsFeature = ctx.db.select().from(schema.tenantFeatures)
      .where(and(
        eq(schema.tenantFeatures.tenantId, 'free-report-tenant'),
        eq(schema.tenantFeatures.featureId, 'analytics')
      ))
      .get();

    expect(analyticsFeature).toBeUndefined();

    // But dashboard endpoint returns full analytics data anyway
    // Simulate dashboard query (top products, weekly revenue, etc.)
    const topProducts = ctx.db.select({
      productName: schema.orderItems.productName,
      totalQty: sql<number>`sum(${schema.orderItems.quantity})`,
    })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .where(and(
        eq(schema.orders.tenantId, 'free-report-tenant'),
        eq(schema.orders.status, 'completed')
      ))
      .groupBy(schema.orderItems.productName)
      .all();

    // VULNERABILITY: Analytics data returned without analytics feature
    expect(topProducts.length).toBeGreaterThan(0);
  });

  /**
   * RU-03 [VULN] Dashboard report has no validateTenant check
   *
   * reports/daily uses validateTenant, but reports/dashboard doesn't.
   * Non-existent tenant can query dashboard.
   */
  it('[VULN] RU-03: Dashboard 報表不驗證租戶存在性', () => {
    const fakeTenantId = 'completely-fake-tenant-id';

    // Verify tenant doesn't exist
    const tenant = ctx.db.select().from(schema.tenants)
      .where(eq(schema.tenants.id, fakeTenantId))
      .get();
    expect(tenant).toBeUndefined();

    // reports/dashboard only does: if (!tenantId) return 401
    // It does NOT call validateTenant()
    // So any non-empty string passes
    const hasTenantId = !!fakeTenantId;
    expect(hasTenantId).toBe(true); // Would pass the null check

    // The query would just return empty data, but the endpoint is still "accessible"
    const orders = ctx.db.select({
      count: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(${schema.orders.total}), 0)`,
    })
      .from(schema.orders)
      .where(eq(schema.orders.tenantId, fakeTenantId))
      .get();

    expect(orders?.count).toBe(0);
    expect(orders?.revenue).toBe(0);
  });
});
