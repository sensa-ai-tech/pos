import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, orderItems, products } from '@/db/schema';
import { getTenantId, validateTenant } from '@/lib/tenant-context';
import { hasFeature } from '@/lib/feature-gate';
import { eq, and, gte, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant ID required' }, { status: 401 });
  }

  const tenant = validateTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // Feature gate: require basic_reports
  if (!hasFeature(tenantId, 'basic_reports')) {
    return NextResponse.json(
      { error: 'Feature not available', feature: 'basic_reports', upgrade: true },
      { status: 403 }
    );
  }

  // Today stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayOrders = db
    .select({
      count: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(${orders.total}), 0)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        eq(orders.status, 'completed'),
        gte(orders.createdAt, todayStart)
      )
    )
    .get();

  // 7-day revenue
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const weeklyOrders = db
    .select({
      count: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(${orders.total}), 0)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        eq(orders.status, 'completed'),
        gte(orders.createdAt, sevenDaysAgo)
      )
    )
    .get();

  // Total products
  const productCount = db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(eq(products.tenantId, tenantId))
    .get();

  // Top 5 products by order count
  const topProducts = db
    .select({
      productName: orderItems.productName,
      totalQty: sql<number>`sum(${orderItems.quantity})`,
      totalRevenue: sql<number>`sum(${orderItems.subtotal})`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.tenantId, tenantId),
        eq(orders.status, 'completed')
      )
    )
    .groupBy(orderItems.productName)
    .orderBy(sql`sum(${orderItems.quantity}) DESC`)
    .limit(5)
    .all();

  // Recent orders
  const recentOrders = db
    .select()
    .from(orders)
    .where(eq(orders.tenantId, tenantId))
    .orderBy(sql`${orders.createdAt} DESC`)
    .limit(5)
    .all();

  const todayCount = todayOrders?.count ?? 0;
  const todayRevenue = todayOrders?.revenue ?? 0;
  const avgOrderValue = todayCount > 0 ? Math.round(todayRevenue / todayCount) : 0;

  return NextResponse.json({
    today: {
      orderCount: todayCount,
      revenue: todayRevenue,
      avgOrderValue,
    },
    weekly: {
      orderCount: weeklyOrders?.count ?? 0,
      revenue: weeklyOrders?.revenue ?? 0,
    },
    productCount: productCount?.count ?? 0,
    topProducts,
    recentOrders,
  });
}
