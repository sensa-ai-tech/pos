import { NextRequest } from 'next/server';
import { db } from '@/db';
import { admins } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ADMIN_SESSION_COOKIE, verifySession } from '@/lib/session';

/** Returns the admin for a valid signed admin session, or null. */
export async function getAdminFromRequest(request: NextRequest) {
  const session = await verifySession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value, 'admin');
  if (!session) return null;

  const admin = db.select().from(admins)
    .where(eq(admins.id, session.adminId))
    .get();

  return admin ?? null;
}
