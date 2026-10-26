import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tenants, orders, products, users, customers } from '@/db/schema';
import { eq, sql, desc, and, gte } from 'drizzle-orm';
import { getAdminFromRequest } from '@/lib/admin-auth';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenant = db.select().from(tenants).where(eq(tenants.id, params.id)).get();
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // Recent orders
  const recentOrders = db.select().from(orders)
    .where(eq(orders.tenantId, params.id))
    .orderBy(desc(orders.createdAt))
    .limit(20)
    .all();

  // Stats
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const weeklyStats = db.select({
    totalOrders: sql<number>`count(*)`,
    totalRevenue: sql<number>`coalesce(sum(total), 0)`,
  })
    .from(orders)
    .where(and(
      eq(orders.tenantId, params.id),
      eq(orders.status, 'completed'),
      gte(orders.createdAt, sevenDaysAgo)
    ))
    .get();

  const productCount = db.select({ count: sql<number>`count(*)` })
    .from(products)
    .where(eq(products.tenantId, params.id))
    .get();

  const employeeCount = db.select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.tenantId, params.id))
    .get();

  const customerCount = db.select({ count: sql<number>`count(*)` })
    .from(customers)
    .where(eq(customers.tenantId, params.id))
    .get();

  return NextResponse.json({
    tenant,
    recentOrders,
    stats: {
      weeklyOrders: weeklyStats?.totalOrders ?? 0,
      weeklyRevenue: weeklyStats?.totalRevenue ?? 0,
      productCount: productCount?.count ?? 0,
      employeeCount: employeeCount?.count ?? 0,
      customerCount: customerCount?.count ?? 0,
    },
  });
}
