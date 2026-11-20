import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { admins } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
  signSession,
} from '@/lib/session';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const admin = db.select().from(admins)
      .where(eq(admins.email, parsed.data.email))
      .get();

    if (!admin || !bcrypt.compareSync(parsed.data.password, admin.passwordHash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const response = NextResponse.json({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    });

    // Signed admin session cookie (httpOnly)
    const sessionToken = await signSession({ kind: 'admin', adminId: admin.id }, ADMIN_SESSION_MAX_AGE_SECONDS);
    response.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, sessionCookieOptions(ADMIN_SESSION_MAX_AGE_SECONDS));

    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
