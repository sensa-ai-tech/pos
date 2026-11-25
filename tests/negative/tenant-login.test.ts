/**
 * Tenant login (/api/auth/login) credential checks
 *
 * Files under test:
 *   - src/lib/tenant-login.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/db/schema';
import { authenticateTenantUser, LEGACY_DEFAULT_EMPLOYEE_PASSWORD } from '@/lib/tenant-login';
import { createTestDb, type TestDbContext } from './helpers/test-db';

let ctx: TestDbContext;
let database: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(() => {
  ctx = createTestDb('tenant-login');
  database = drizzle(ctx.sqlite, { schema });
  const now = new Date();
  database.insert(schema.tenants).values([
    { id: 'login-tenant-a', name: '甲店', industry: 'cafe', plan: 'free', createdAt: now },
    { id: 'login-tenant-b', name: '乙店', industry: 'retail', plan: 'free', createdAt: now },
  ]).run();
  database.insert(schema.users).values([
    {
      id: 'login-owner-a', tenantId: 'login-tenant-a', email: 'owner-a@test.com',
      passwordHash: bcrypt.hashSync('correct-horse', 4), name: 'A', role: 'owner', createdAt: now,
    },
    {
      id: 'login-cashier-b', tenantId: 'login-tenant-b', email: 'cashier-b@test.com',
      passwordHash: bcrypt.hashSync(LEGACY_DEFAULT_EMPLOYEE_PASSWORD, 4), name: 'B', role: 'cashier', createdAt: now,
    },
    {
      id: 'login-manager-a', tenantId: 'login-tenant-a', email: 'manager-a@test.com',
      passwordHash: bcrypt.hashSync('manager-pass', 4), name: 'M', role: 'manager', createdAt: now,
    },
  ]).run();
});

afterAll(() => ctx.cleanup());

describe('authenticateTenantUser', () => {
  it('returns the user tenant for a correct password', async () => {
    const result = await authenticateTenantUser(database, 'owner-a@test.com', 'correct-horse');
    expect(result).toEqual({ ok: true, userId: 'login-owner-a', tenantId: 'login-tenant-a', tenantName: '甲店' });
  });

  it('rejects a wrong password and an unknown email the same way', async () => {
    expect(await authenticateTenantUser(database, 'owner-a@test.com', 'wrong')).toEqual({
      ok: false, reason: 'invalid_credentials',
    });
    expect(await authenticateTenantUser(database, 'nobody@test.com', 'correct-horse')).toEqual({
      ok: false, reason: 'invalid_credentials',
    });
  });

  it('refuses accounts still on the legacy default employee password', async () => {
    const result = await authenticateTenantUser(database, 'cashier-b@test.com', LEGACY_DEFAULT_EMPLOYEE_PASSWORD);
    expect(result).toEqual({ ok: false, reason: 'password_not_set' });
    // bcryptjs handles NUL so that "default\0default" also matches the default's hash; it must still be refused.
    const padded = await authenticateTenantUser(
      database, 'cashier-b@test.com', `${LEGACY_DEFAULT_EMPLOYEE_PASSWORD}\0${LEGACY_DEFAULT_EMPLOYEE_PASSWORD}`
    );
    expect(padded).toEqual({ ok: false, reason: 'password_not_set' });
  });

  it('refuses non-owner roles until API routes check roles', async () => {
    expect(await authenticateTenantUser(database, 'manager-a@test.com', 'manager-pass')).toEqual({
      ok: false, reason: 'role_not_allowed',
    });
    // A wrong password never reveals the role.
    expect(await authenticateTenantUser(database, 'manager-a@test.com', 'wrong')).toEqual({
      ok: false, reason: 'invalid_credentials',
    });
  });
});
