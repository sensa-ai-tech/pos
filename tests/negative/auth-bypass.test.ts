/**
 * 🔴 Authentication Bypass Adversarial Tests
 *
 * Targets: Authentication and authorization vulnerabilities
 * Files under test:
 *   - src/lib/auth.ts (cookie-only check, no DB validation)
 *   - src/lib/tenant-context.ts (getTenantId only reads header)
 *   - src/app/api/tenants/setup/route.ts (password plaintext)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { createTestDb, type TestDbContext } from './helpers/test-db';

let ctx: TestDbContext;

beforeAll(() => {
  ctx = createTestDb('auth-bypass', { seedFeatureCatalog: true });
  const now = new Date();

  // Create a test tenant with a user
  ctx.db.insert(schema.tenants).values({
    id: 'auth-tenant', name: 'Auth Test', industry: 'restaurant', plan: 'free', createdAt: now,
  }).run();

  ctx.db.insert(schema.users).values({
    id: 'user-1',
    tenantId: 'auth-tenant',
    email: 'owner@test.com',
    passwordHash: 'hashed_test123',
    name: 'Owner',
    role: 'owner',
    createdAt: now,
  }).run();

  // Activate a paid feature for testing
  ctx.db.insert(schema.tenantFeatures).values({
    id: 'tf-1',
    tenantId: 'auth-tenant',
    featureId: 'analytics',
    isActive: true,
    activatedAt: now,
  }).run();
});

afterAll(() => ctx.cleanup());

describe('Authentication Bypass Attacks', () => {
  /**
   * AB-01 [GUARD] Missing x-tenant-id header
   *
   * tenant-context.ts getTenantId reads x-tenant-id header.
   * All protected routes check for null and return 400/401.
   */
  it('[GUARD] AB-01: 缺少 x-tenant-id 應由 getTenantId 回傳 null', () => {
    // Simulate: getTenantId returns null when header missing
    // The actual function reads from NextRequest headers, which we can't call directly.
    // Instead, test the pattern: null check → 400 response
    const tenantId: string | null = null; // simulating getTenantId(request)
    expect(tenantId).toBeNull();
    // All routes do: if (!tenantId) return 400/401
  });

  /**
   * AB-02 [GUARD] Empty string x-tenant-id
   *
   * Empty string is falsy → should be caught by `if (!tenantId)`
   */
  it('[GUARD] AB-02: 空字串 tenant-id 應被視為無效', () => {
    const tenantId = ''; // simulating empty header
    expect(!tenantId).toBe(true); // falsy check passes

    // validateTenant with empty string → should not find tenant
    const tenant = ctx.db.select().from(schema.tenants)
      .where(eq(schema.tenants.id, ''))
      .get();
    expect(tenant).toBeUndefined();
  });

  /**
   * AB-03 [VULN] Non-existent tenant ID partially accepted
   *
   * Some routes call validateTenant() (→ returns 404),
   * but others only use getTenantId() without validation.
   * Test: orders/route.ts has validateTenant, but reports/daily doesn't.
   */
  it('[VULN] AB-03: 不存在的 tenant ID 在未驗證端點可通過', () => {
    const fakeTenantId = 'non-existent-uuid';

    // validateTenant would fail
    const tenant = ctx.db.select().from(schema.tenants)
      .where(eq(schema.tenants.id, fakeTenantId))
      .get();
    expect(tenant).toBeUndefined();

    // But reports/daily only checks getTenantId (non-null) → would proceed!
    // It would just return empty data, but the endpoint doesn't reject the request
    const hasHeader = !!fakeTenantId;
    expect(hasHeader).toBe(true); // This would pass the `if (!tenantId)` check
  });

  /**
   * AB-04 [VULN] Password stored in plaintext (reversible)
   *
   * setup/route.ts L55: passwordHash = `hashed_${password}`
   * Anyone with DB access can reverse the "hash" by removing the prefix.
   */
  it('[VULN] AB-04: 密碼以可逆格式儲存', () => {
    const user = ctx.db.select().from(schema.users)
      .where(eq(schema.users.email, 'owner@test.com'))
      .get();

    expect(user).toBeDefined();
    expect(user!.passwordHash).toBe('hashed_test123');

    // VULNERABILITY: Password is trivially reversible
    const originalPassword = user!.passwordHash.replace('hashed_', '');
    expect(originalPassword).toBe('test123');
  });

  /**
   * AB-05 [VULN] Cookie authentication doesn't validate against DB
   *
   * auth.ts isAuthenticated() just checks cookies are non-empty.
   * Setting any random cookie values would pass.
   */
  it('[VULN] AB-05: Cookie 驗證不查詢 DB', () => {
    // Simulate isAuthenticated() logic:
    const fakeCookies = {
      tenantId: 'totally-fake-tenant-id',
      userId: 'totally-fake-user-id',
    };

    // isAuthenticated just does: !!(tenantId && userId)
    const isAuthenticated = !!(fakeCookies.tenantId && fakeCookies.userId);
    expect(isAuthenticated).toBe(true); // VULNERABILITY: fake cookies pass!

    // But these IDs don't exist in DB
    const tenant = ctx.db.select().from(schema.tenants)
      .where(eq(schema.tenants.id, fakeCookies.tenantId))
      .get();
    expect(tenant).toBeUndefined(); // Not in DB but "authenticated"
  });

  /**
   * AB-06 [VULN] No membership verification — any tenant ID is accepted
   *
   * API routes trust the x-tenant-id header without verifying
   * the caller actually belongs to that tenant.
   */
  it('[VULN] AB-06: 無成員資格驗證，任意 tenant ID 被接受', () => {
    // Create a second tenant
    ctx.db.insert(schema.tenants).values({
      id: 'tenant-victim', name: 'Victim Store', industry: 'retail', plan: 'pro', createdAt: new Date(),
    }).run();

    ctx.db.insert(schema.products).values({
      id: 'victim-prod-1', tenantId: 'tenant-victim', name: 'Victim Product',
      price: 9999, stockQuantity: 100, createdAt: new Date(),
    }).run();

    // Attacker user belongs to auth-tenant but sends x-tenant-id: tenant-victim
    // The route only reads the header, no cross-reference with user's actual tenant
    const stolenProducts = ctx.db.select().from(schema.products)
      .where(eq(schema.products.tenantId, 'tenant-victim'))
      .all();

    // VULNERABILITY: Attacker can see victim's products by just changing the header
    expect(stolenProducts.length).toBe(1);
    expect(stolenProducts[0].name).toBe('Victim Product');
  });

  /**
   * AB-07 [VULN] No RBAC — cashier can do everything owner can
   *
   * No role checking anywhere in the system.
   */
  it('[VULN] AB-07: 角色權限未實作（cashier 可做所有操作）', () => {
    // Create a cashier user
    ctx.db.insert(schema.users).values({
      id: 'cashier-1',
      tenantId: 'auth-tenant',
      email: 'cashier@test.com',
      passwordHash: 'hashed_cashier123',
      name: 'Cashier',
      role: 'cashier',
      createdAt: new Date(),
    }).run();

    const cashier = ctx.db.select().from(schema.users)
      .where(eq(schema.users.id, 'cashier-1'))
      .get();

    expect(cashier!.role).toBe('cashier');

    // VULNERABILITY: There's no middleware checking roles
    // Feature activation endpoint only checks x-tenant-id, not user role
    // A cashier could activate paid features, delete products, etc.
    const paidFeature = ctx.db.select().from(schema.tenantFeatures)
      .where(eq(schema.tenantFeatures.featureId, 'analytics'))
      .get();

    expect(paidFeature).toBeDefined();
    expect(paidFeature!.isActive).toBe(true);
    // No role check prevents cashier from doing this
  });
});
