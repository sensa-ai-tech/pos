import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { kitchenOrders } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getTenantId } from '@/lib/tenant-context';
import { z } from 'zod';

const updateKitchenSchema = z.object({
  status: z.enum(['pending', 'preparing', 'ready', 'served']),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateKitchenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const kitchenOrder = db.select().from(kitchenOrders)
      .where(and(eq(kitchenOrders.id, params.id), eq(kitchenOrders.tenantId, tenantId)))
      .get();

    if (!kitchenOrder) {
      return NextResponse.json({ error: 'Kitchen order not found' }, { status: 404 });
    }

    // Valid transitions
    const validTransitions: Record<string, string[]> = {
      pending: ['preparing'],
      preparing: ['ready', 'pending'],
      ready: ['served', 'preparing'],
      served: [],
    };

    const allowed = validTransitions[kitchenOrder.status] ?? [];
    if (!allowed.includes(parsed.data.status)) {
      return NextResponse.json({
        error: `Cannot transition from ${kitchenOrder.status} to ${parsed.data.status}`
      }, { status: 400 });
    }

    const now = new Date();
    const updates: Record<string, unknown> = { status: parsed.data.status };

    if (parsed.data.status === 'preparing' && !kitchenOrder.startedAt) {
      updates.startedAt = now;
    }
    if (parsed.data.status === 'ready' || parsed.data.status === 'served') {
      updates.completedAt = now;
    }

    db.update(kitchenOrders)
      .set(updates)
      .where(eq(kitchenOrders.id, params.id))
      .run();

    const updated = db.select().from(kitchenOrders)
      .where(eq(kitchenOrders.id, params.id))
      .get();

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Kitchen order update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
