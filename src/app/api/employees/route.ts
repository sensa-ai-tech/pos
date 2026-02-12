import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { getTenantId } from '@/lib/tenant-context';
import { hasFeature } from '@/lib/feature-gate';
import bcrypt from 'bcryptjs';

const createEmployeeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email().max(200),
  role: z.enum(['owner', 'manager', 'cashier']),
});

export async function GET(request: NextRequest) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasFeature(tenantId, 'employee_mgmt')) {
    return NextResponse.json({ error: 'Feature not enabled', feature: 'employee_mgmt' }, { status: 403 });
  }

  const data = db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    createdAt: users.createdAt,
  }).from(users)
    .where(eq(users.tenantId, tenantId))
    .orderBy(desc(users.createdAt))
    .all();

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasFeature(tenantId, 'employee_mgmt')) {
    return NextResponse.json({ error: 'Feature not enabled', feature: 'employee_mgmt' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createEmployeeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    // Check if email already exists
    const existing = db.select().from(users).where(eq(users.email, parsed.data.email)).get();
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }

    const id = crypto.randomUUID();
    // Default password - in production should send invitation email
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('changeme123', salt);

    db.insert(users).values({
      id,
      tenantId,
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
      createdAt: new Date(),
    }).run();

    const created = db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, id)).get();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Employee creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
