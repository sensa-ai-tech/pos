import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tenants, orders, products } from '@/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { getAdminFromRequest } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allTenants = db.select().from(tenants).orderBy(desc(tenants.createdAt)).all();

  // Enrich with stats
  const enriched = allTenants.map((tenant) => {
    const orderStats = db.select({
      totalOrders: sql<number>`count(*)`,
      totalRevenue: sql<number>`coalesce(sum(total), 0)`,
      pendingOrders: sql<number>`sum(case when status = 'pending' then 1 else 0 end)`,
    })
      .from(orders)
      .where(eq(orders.tenantId, tenant.id))
      .get();

    const productCount = db.select({ count: sql<number>`count(*)` })
      .from(products)
      .where(eq(products.tenantId, tenant.id))
      .get();

    return {
      ...tenant,
      stats: {
        totalOrders: orderStats?.totalOrders ?? 0,
        totalRevenue: orderStats?.totalRevenue ?? 0,
        pendingOrders: orderStats?.pendingOrders ?? 0,
        productCount: productCount?.count ?? 0,
      },
    };
  });

  return NextResponse.json(enriched);
}
