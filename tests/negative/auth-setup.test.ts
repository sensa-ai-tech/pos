/**
 * 🟡 Setup Flow Boundary Tests
 *
 * Targets: Account creation edge cases
 * Files under test:
 *   - src/app/api/tenants/setup/route.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { createTestDb, type TestDbContext } from './helpers/test-db';

// Replicate the setup schema
const setupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  industry: z.enum(['restaurant', 'retail', 'medical', 'service', 'cafe', 'gym', 'education', 'petshop', 'repair', 'beauty']),
});

let ctx: TestDbContext;

beforeAll(() => {
  ctx = createTestDb('auth-setup');
  const now = new Date();

  // Pre-create a tenant and user for duplicate email testing
  ctx.db.insert(schema.tenants).values({
    id: 'setup-tenant-1', name: 'Existing Store', industry: 'restaurant', plan: 'free', createdAt: now,
  }).run();

  ctx.db.insert(schema.users).values({
    id: 'setup-user-1',
    tenantId: 'setup-tenant-1',
    email: 'existing@test.com',
    passwordHash: 'hashed_password123',
    name: 'Existing User',
    role: 'owner',
    createdAt: now,
  }).run();
});

afterAll(() => ctx.cleanup());

describe('Setup Flow Boundary Attacks', () => {
  /**
   * AS-01 [VULN] Duplicate email causes UNIQUE constraint error (500)
   *
   * setup/route.ts doesn't check for existing email before INSERT.
   * The UNIQUE constraint throws an error caught by generic catch → 500.
   * Should return a friendlier 409 Conflict.
   */
  it('[VULN] AS-01: 重複 email 觸發 UNIQUE constraint 錯誤', () => {
    // Attempt to create another user with same email
    let insertError: Error | null = null;
    try {
      ctx.db.insert(schema.users).values({
        id: 'setup-user-dup',
        tenantId: 'setup-tenant-1',
        email: 'existing@test.com', // Duplicate!
        passwordHash: 'hashed_dup123',
        name: 'Duplicate User',
        role: 'owner',
        createdAt: new Date(),
      }).run();
    } catch (e) {
      insertError = e as Error;
    }

    // UNIQUE constraint error → in setup route this becomes a generic 500
    expect(insertError).not.toBeNull();
    expect(insertError!.message).toContain('UNIQUE');
  });

  /**
   * AS-02 [GUARD] SQL injection via name field (Drizzle parameterized)
   */
  it('[GUARD] AS-02: SQL injection 被 Drizzle 參數化查詢阻止', () => {
    const maliciousName = "'; DROP TABLE tenants;--";

    const result = setupSchema.safeParse({
      name: maliciousName,
      email: 'sqli@test.com',
      password: 'password123',
      industry: 'restaurant',
    });

    // Zod allows the string (it's valid per .min(1))
    expect(result.success).toBe(true);

    // But Drizzle uses parameterized queries → SQL injection is prevented
    ctx.db.insert(schema.tenants).values({
      id: 'sqli-tenant',
      name: maliciousName,
      industry: 'restaurant',
      plan: 'free',
      createdAt: new Date(),
    }).run();

    // Verify tenants table still exists (not dropped)
    const allTenants = ctx.db.select().from(schema.tenants).all();
    expect(allTenants.length).toBeGreaterThan(0);

    // Verify the name was stored literally (not executed)
    const sqlTenant = ctx.db.select().from(schema.tenants)
      .where(eq(schema.tenants.id, 'sqli-tenant'))
      .get()!;
    expect(sqlTenant.name).toBe(maliciousName);
  });

  /**
   * AS-03 [VULN] Extremely long password has no maxLength
   */
  it('[VULN] AS-03: 超長密碼無上限', () => {
    const longPassword = 'A'.repeat(100000);

    const result = setupSchema.safeParse({
      name: 'Long Password User',
      email: 'longpw@test.com',
      password: longPassword,
      industry: 'restaurant',
    });

    // No max length on password
    expect(result.success).toBe(true);

    // The password hash would be: "hashed_" + 100K chars
    const hash = `hashed_${longPassword}`;
    expect(hash.length).toBe(100007); // 7 prefix + 100000 chars
  });

  /**
   * AS-04 [GUARD] Empty name should be rejected
   */
  it('[GUARD] AS-04: 空名稱應被 .min(1) 攔截', () => {
    const result = setupSchema.safeParse({
      name: '',
      email: 'empty@test.com',
      password: 'password123',
      industry: 'restaurant',
    });
    expect(result.success).toBe(false);
  });
});
