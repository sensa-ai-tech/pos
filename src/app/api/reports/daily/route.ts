import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { getTenantId, validateTenant } from '@/lib/tenant-context';
import { hasFeature } from '@/lib/feature-gate';

export async function GET(request: NextRequest) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized: tenant identification required' }, { status: 401 });
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

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayOrders = db.select().from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        eq(orders.status, 'completed'),
        gte(orders.createdAt, todayStart)
      )
    )
    .all();

  const totalRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
  const orderCount = todayOrders.length;
  const avgOrderValue = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;

  // Payment method distribution
  const methodCounts: Record<string, number> = {};
  for (const order of todayOrders) {
    methodCounts[order.paymentMethod] = (methodCounts[order.paymentMethod] || 0) + 1;
  }

  return NextResponse.json({
    date: todayStart.toISOString().split('T')[0],
    revenue: totalRevenue,
    orderCount,
    avgOrderValue,
    paymentMethods: methodCounts,
  });
}
