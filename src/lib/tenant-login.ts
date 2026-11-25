import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/db/schema';

/**
 * Password every employee account got before temporary passwords were generated
 * (see src/app/api/employees/route.ts). It is public in the old UI, so it never logs in.
 */
export const LEGACY_DEFAULT_EMPLOYEE_PASSWORD = 'changeme123';

// Compared against when the email is unknown so both paths cost one bcrypt check.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

/**
 * Roles that may sign in. API routes check the tenant but not the role yet, so a
 * signed-in cashier could use every management endpoint; until role checks exist
 * only owners log in.
 */
const ROLES_ALLOWED_TO_LOGIN: ReadonlySet<string> = new Set(['owner']);

export type TenantLoginResult =
  | { ok: true; userId: string; tenantId: string; tenantName: string }
  | { ok: false; reason: 'invalid_credentials' | 'password_not_set' | 'role_not_allowed' };

/** Checks an email and password against the users table and returns the user's tenant. */
export async function authenticateTenantUser(
  database: BetterSQLite3Database<typeof schema>,
  email: string,
  password: string
): Promise<TenantLoginResult> {
  const user = database
    .select({
      id: schema.users.id,
      tenantId: schema.users.tenantId,
      passwordHash: schema.users.passwordHash,
      role: schema.users.role,
      tenantName: schema.tenants.name,
    })
    .from(schema.users)
    .innerJoin(schema.tenants, eq(schema.users.tenantId, schema.tenants.id))
    .where(eq(schema.users.email, email))
    .get();

  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches) {
    return { ok: false, reason: 'invalid_credentials' };
  }
  if (password === LEGACY_DEFAULT_EMPLOYEE_PASSWORD) {
    return { ok: false, reason: 'password_not_set' };
  }
  if (!ROLES_ALLOWED_TO_LOGIN.has(user.role)) {
    return { ok: false, reason: 'role_not_allowed' };
  }
  return { ok: true, userId: user.id, tenantId: user.tenantId, tenantName: user.tenantName };
}
