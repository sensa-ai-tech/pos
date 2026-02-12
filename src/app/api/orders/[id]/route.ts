import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, orderItems, payments, products } from '@/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { getTenantId, validateTenant } from '@/lib/tenant-context';
import { sqlite } from '@/db';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized: tenant identification required' }, { status: 401 });
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

const patchOrderSchema = z.object({
  status: z.enum(['completed', 'cancelled']),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'other']).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenant = validateTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = patchOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const order = db.select().from(orders)
      .where(and(eq(orders.id, params.id), eq(orders.tenantId, tenantId)))
      .get();

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status !== 'pending') {
      return NextResponse.json({ error: `Cannot update order with status: ${order.status}` }, { status: 400 });
    }

    const { status: newStatus, paymentMethod } = parsed.data;

    if (newStatus === 'cancelled') {
      db.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, params.id)).run();
      const updated = db.select().from(orders).where(eq(orders.id, params.id)).get();
      return NextResponse.json(updated);
    }

    if (newStatus === 'completed') {
      const method = paymentMethod ?? order.paymentMethod;
      const items = db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).all();

      const completeOrder = sqlite.transaction(() => {
        // Check stock
        const productIds = items.map(i => i.productId);
        const freshProducts = db.select().from(products)
          .where(inArray(products.id, productIds))
          .all();
        const freshMap = new Map(freshProducts.map(p => [p.id, p]));

        for (const item of items) {
          const freshProduct = freshMap.get(item.productId);
          if (!freshProduct || freshProduct.stockQuantity < item.quantity) {
            throw new Error(
              `Insufficient stock for ${freshProduct?.name ?? item.productId}: ` +
              `available ${freshProduct?.stockQuantity ?? 0}, requested ${item.quantity}`
            );
          }
        }

        // Deduct stock
        for (const item of items) {
          db.update(products)
            .set({ stockQuantity: sql`stock_quantity - ${item.quantity}` })
            .where(eq(products.id, item.productId))
            .run();
        }

        // Create payment
        db.insert(payments).values({
          id: crypto.randomUUID(),
          tenantId,
          orderId: order.id,
          amount: order.total,
          method,
          status: 'completed',
          createdAt: new Date(),
        }).run();

        // Update order
        db.update(orders)
          .set({ status: 'completed', paymentMethod: method })
          .where(eq(orders.id, params.id))
          .run();
      });

      try {
        completeOrder();
      } catch (txError) {
        const msg = txError instanceof Error ? txError.message : 'Transaction failed';
        if (msg.includes('Insufficient stock')) {
          return NextResponse.json({ error: msg }, { status: 400 });
        }
        throw txError;
      }

      const updated = db.select().from(orders).where(eq(orders.id, params.id)).get();
      const updatedItems = db.select().from(orderItems).where(eq(orderItems.orderId, params.id)).all();
      return NextResponse.json({ ...updated, items: updatedItems });
    }

    return NextResponse.json({ error: 'Invalid status transition' }, { status: 400 });
  } catch (error) {
    console.error('Order update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
