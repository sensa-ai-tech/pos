import { NextRequest } from 'next/server';
import { db } from '@/db';
import { admins } from '@/db/schema';
import { eq } from 'drizzle-orm';

export function getAdminFromRequest(request: NextRequest) {
  const adminId = request.cookies.get('admin_id')?.value;
  if (!adminId) return null;

  const admin = db.select().from(admins)
    .where(eq(admins.id, adminId))
    .get();

  return admin ?? null;
}
