import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { kitchenOrders, orders, orderItems } from '@/db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { getTenantId, validateTenant } from '@/lib/tenant-context';

export async function GET(request: NextRequest) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized: tenant identification required' }, { status: 401 });
  }

  const tenant = validateTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');

  const allKitchenOrders = statusFilter
    ? db.select().from(kitchenOrders)
        .where(and(
          eq(kitchenOrders.tenantId, tenantId),
          eq(kitchenOrders.status, statusFilter as 'pending' | 'preparing' | 'ready' | 'served')
        ))
        .orderBy(desc(kitchenOrders.createdAt))
        .all()
    : db.select().from(kitchenOrders)
        .where(eq(kitchenOrders.tenantId, tenantId))
        .orderBy(desc(kitchenOrders.createdAt))
        .all();

  // Enrich with order details
  if (allKitchenOrders.length === 0) {
    return NextResponse.json([]);
  }

  const orderIdSet = new Set(allKitchenOrders.map(ko => ko.orderId));
  const orderIds = Array.from(orderIdSet);
  const relatedOrders = db.select().from(orders)
    .where(inArray(orders.id, orderIds))
    .all();
  const orderMap = new Map(relatedOrders.map(o => [o.id, o]));

  const relatedItems = db.select().from(orderItems)
    .where(inArray(orderItems.orderId, orderIds))
    .all();
  const itemsByOrder = new Map<string, typeof relatedItems>();
  for (const item of relatedItems) {
    const existing = itemsByOrder.get(item.orderId) ?? [];
    existing.push(item);
    itemsByOrder.set(item.orderId, existing);
  }

  const enriched = allKitchenOrders.map(ko => {
    const order = orderMap.get(ko.orderId);
    const items = itemsByOrder.get(ko.orderId) ?? [];

    // Parse metadata for table number
    let tableNumber: number | null = null;
    let isDineIn = true;
    if (order?.metadata) {
      try {
        const meta = JSON.parse(order.metadata);
        tableNumber = meta.tableNumber ?? null;
        isDineIn = meta.isDineIn ?? true;
      } catch {
        // ignore malformed metadata
      }
    }

    return {
      ...ko,
      orderNumber: order?.orderNumber ?? 'N/A',
      tableNumber,
      isDineIn,
      items: items.map(i => ({
        productName: i.productName,
        quantity: i.quantity,
        notes: i.notes,
      })),
    };
  });

  return NextResponse.json(enriched);
}
