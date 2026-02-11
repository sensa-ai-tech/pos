import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, orderItems } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getTenantId } from '@/lib/tenant-context';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing x-tenant-id header' }, { status: 400 });
  }

  const order = db.select().from(orders)
    .where(and(eq(orders.id, params.id), eq(orders.tenantId, tenantId)))
    .get();

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const items = db.select().from(orderItems)
    .where(eq(orderItems.orderId, params.id))
    .all();

  return NextResponse.json({ ...order, items });
}
