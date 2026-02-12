import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, orderItems } from '@/db/schema';
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import { getTenantId } from '@/lib/tenant-context';
import { hasFeature } from '@/lib/feature-gate';

export async function GET(request: NextRequest) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasFeature(tenantId, 'analytics')) {
    return NextResponse.json({ error: 'Feature not enabled', feature: 'analytics' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') || '30')));

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  // Revenue trend (daily)
  const revenueByDay = db.select({
    date: sql<string>`date(${orders.createdAt}, 'unixepoch')`.as('date'),
    revenue: sql<number>`sum(${orders.total})`.as('revenue'),
    orderCount: sql<number>`count(*)`.as('order_count'),
  })
    .from(orders)
    .where(and(
      eq(orders.tenantId, tenantId),
      eq(orders.status, 'completed'),
      gte(orders.createdAt, sinceDate)
    ))
    .groupBy(sql`date(${orders.createdAt}, 'unixepoch')`)
    .orderBy(sql`date(${orders.createdAt}, 'unixepoch')`)
    .all();

  // Payment method breakdown
  const paymentBreakdown = db.select({
    method: orders.paymentMethod,
    count: sql<number>`count(*)`.as('count'),
    total: sql<number>`sum(${orders.total})`.as('total'),
  })
    .from(orders)
    .where(and(
      eq(orders.tenantId, tenantId),
      eq(orders.status, 'completed'),
      gte(orders.createdAt, sinceDate)
    ))
    .groupBy(orders.paymentMethod)
    .all();

  // Top selling products
  const topProducts = db.select({
    productName: orderItems.productName,
    totalQty: sql<number>`sum(${orderItems.quantity})`.as('total_qty'),
    totalRevenue: sql<number>`sum(${orderItems.subtotal})`.as('total_revenue'),
  })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(
      eq(orders.tenantId, tenantId),
      eq(orders.status, 'completed'),
      gte(orders.createdAt, sinceDate)
    ))
    .groupBy(orderItems.productName)
    .orderBy(desc(sql`total_qty`))
    .limit(10)
    .all();

  // Summary stats
  const summary = db.select({
    totalRevenue: sql<number>`coalesce(sum(${orders.total}), 0)`.as('total_revenue'),
    totalOrders: sql<number>`count(*)`.as('total_orders'),
    avgOrderValue: sql<number>`coalesce(avg(${orders.total}), 0)`.as('avg_order_value'),
  })
    .from(orders)
    .where(and(
      eq(orders.tenantId, tenantId),
      eq(orders.status, 'completed'),
      gte(orders.createdAt, sinceDate)
    ))
    .get();

  // Hourly distribution
  const hourlyDistribution = db.select({
    hour: sql<number>`cast(strftime('%H', ${orders.createdAt}, 'unixepoch') as integer)`.as('hour'),
    count: sql<number>`count(*)`.as('count'),
  })
    .from(orders)
    .where(and(
      eq(orders.tenantId, tenantId),
      eq(orders.status, 'completed'),
      gte(orders.createdAt, sinceDate)
    ))
    .groupBy(sql`strftime('%H', ${orders.createdAt}, 'unixepoch')`)
    .orderBy(sql`hour`)
    .all();

  return NextResponse.json({
    period: { days, since: sinceDate.toISOString() },
    summary: summary ?? { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 },
    revenueByDay,
    paymentBreakdown,
    topProducts,
    hourlyDistribution,
  });
}
