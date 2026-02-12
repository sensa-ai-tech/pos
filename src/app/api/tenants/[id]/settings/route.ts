import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tenants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getSettingsSchema } from '@/lib/settings-schema';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  settings: z.record(z.unknown()).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId || tenantId !== params.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenant = db.select().from(tenants).where(eq(tenants.id, params.id)).get();
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const { name, settings: newSettings } = parsed.data;
    const updateData: Record<string, unknown> = {};

    if (name) {
      updateData.name = name;
    }

    if (newSettings) {
      // Validate settings against industry-specific schema
      const settingsSchema = getSettingsSchema(tenant.industry);
      const settingsValidation = settingsSchema.safeParse(newSettings);
      if (!settingsValidation.success) {
        return NextResponse.json({ error: 'Invalid settings', details: settingsValidation.error.flatten() }, { status: 400 });
      }

      // Merge with existing settings (shallow merge)
      const existingSettings = tenant.settings ? JSON.parse(tenant.settings) : {};
      const mergedSettings = { ...existingSettings, ...settingsValidation.data };
      updateData.settings = JSON.stringify(mergedSettings);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    db.update(tenants)
      .set(updateData)
      .where(eq(tenants.id, params.id))
      .run();

    // Fetch updated tenant
    const updated = db.select().from(tenants).where(eq(tenants.id, params.id)).get();

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Settings update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
