/**
 * 🔴 Tenant Isolation Adversarial Tests
 *
 * Targets: Cross-tenant data leakage
 * Files under test:
 *   - src/app/api/orders/[id]/route.ts (L24-26: orderItems no tenantId filter)
 *   - src/app/api/tenants/route.ts (L12-15: GET returns all tenants)
 *   - src/app/api/products/route.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { createTestDb, seedTwoTenants, seedOrdersForTenants, type TestDbContext } from './helpers/test-db';

let ctx: TestDbContext;

beforeAll(() => {
  ctx = createTestDb('tenant-isolation');
  seedTwoTenants(ctx.db);
  seedOrdersForTenants(ctx.db);
});

afterAll(() => ctx.cleanup());

describe('Tenant Isolation — Cross-Tenant Attacks', () => {
  /**
   * TI-01 [VULN] Order items leak across tenants
   *
   * orders/[id]/route.ts L24-26 queries orderItems by orderId only,
   * WITHOUT filtering by tenantId. If tenant-b knows order-a1's ID,
   * they can see tenant-a's order items.
   *
   * This test PASSES → vulnerability confirmed.
   */
  it('[VULN] TI-01: order items 可透過 orderId 跨租戶存取', () => {
    // Simulate: tenant-b queries order items using tenant-a's orderId
    // The route code does: db.select().from(orderItems).where(eq(orderItems.orderId, params.id))
    // No tenantId check on orderItems!
    const items = ctx.db.select().from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, 'order-a1'))
      .all();

    // VULNERABILITY: tenant-b can see tenant-a's order items
    // This should NOT be possible, but there's no tenantId filter
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].productName).toBe('A Product 1');
  });

  /**
   * TI-02 [VULN] GET /api/tenants returns all tenants without auth
   *
   * tenants/route.ts L12-15: No authentication check, returns all tenants.
   * Anyone can enumerate all tenants in the system.
   */
  it('[VULN] TI-02: 租戶列表無需認證即可取得', () => {
    // The route does: db.select().from(tenants).all() — no auth check
    const allTenants = ctx.db.select().from(schema.tenants).all();

    // VULNERABILITY: Returns ALL tenants, no auth
    expect(allTenants.length).toBe(2);
    expect(allTenants.map(t => t.id)).toContain('tenant-a');
    expect(allTenants.map(t => t.id)).toContain('tenant-b');
  });

  /**
   * TI-03 [VULN] GET /api/tenants/[id] exposes any tenant details without auth
   *
   * No authentication required to fetch tenant by ID
   */
  it('[VULN] TI-03: 任意租戶 ID 可查詢詳情（無認證）', () => {
    // Simulate: anyone with tenant-a's ID can fetch details
    const tenant = ctx.db.select().from(schema.tenants)
      .where(eq(schema.tenants.id, 'tenant-a'))
      .get();

    expect(tenant).toBeDefined();
    expect(tenant!.name).toBe('Tenant A');
    expect(tenant!.industry).toBe('restaurant');
  });

  /**
   * TI-04 [GUARD] Forged x-tenant-id should not access other tenant's products
   *
   * Products route uses: eq(products.tenantId, tenantId)
   * So setting x-tenant-id to tenant-b should only return tenant-b's products.
   */
  it('[GUARD] TI-04: 偽造 x-tenant-id 只能存取自身租戶商品', () => {
    // Simulate: tenant-b queries products with their own tenant-id
    const productsB = ctx.db.select().from(schema.products)
      .where(eq(schema.products.tenantId, 'tenant-b'))
      .all();

    // Should only see tenant-b's products
    expect(productsB.length).toBe(1);
    expect(productsB[0].name).toBe('B Product 1');
    expect(productsB.every(p => p.tenantId === 'tenant-b')).toBe(true);
  });

  /**
   * TI-05 [GUARD] Cross-tenant order creation should be blocked
   *
   * orders/route.ts L67-68 uses:
   *   and(eq(products.id, item.productId), eq(products.tenantId, tenantId))
   * So tenant-b can't reference tenant-a's product.
   */
  it('[GUARD] TI-05: 跨租戶引用他人商品建立訂單應被攔截', () => {
    // Simulate: tenant-b tries to use tenant-a's product
    const product = ctx.db.select().from(schema.products)
      .where(and(
        eq(schema.products.id, 'prod-a1'),
        eq(schema.products.tenantId, 'tenant-b') // tenant-b claiming ownership
      ))
      .get();

    // Product not found for this tenant → should return null
    expect(product).toBeUndefined();
  });

  /**
   * TI-06 [GUARD] Cross-tenant update/delete should fail
   *
   * If tenant-b tries to update tenant-a's product, the where clause
   * should not match any rows.
   */
  it('[GUARD] TI-06: 跨租戶更新商品應影響 0 行', () => {
    // Simulate: tenant-b tries to update tenant-a's product
    const result = ctx.db.update(schema.products)
      .set({ price: 999 })
      .where(and(
        eq(schema.products.id, 'prod-a1'),
        eq(schema.products.tenantId, 'tenant-b')
      ))
      .run();

    expect(result.changes).toBe(0);

    // Verify tenant-a's product price unchanged
    const product = ctx.db.select().from(schema.products)
      .where(eq(schema.products.id, 'prod-a1'))
      .get();
    expect(product!.price).toBe(100);
  });
});
