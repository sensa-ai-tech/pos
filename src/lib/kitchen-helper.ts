import { db } from '@/db';
import { kitchenOrders, tenants } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Auto-create a kitchen order if the tenant has kitchen printing enabled.
 * Call this after order creation.
 */
export function createKitchenOrderIfEnabled(
  tenantId: string,
  orderId: string,
  notes?: string | null
): boolean {
  const tenant = db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
  if (!tenant?.settings) return false;

  try {
    const settings = JSON.parse(tenant.settings);
    if (!settings.enableKitchenPrint) return false;
  } catch {
    return false;
  }

  db.insert(kitchenOrders).values({
    id: crypto.randomUUID(),
    orderId,
    tenantId,
    status: 'pending',
    priority: 0,
    notes: notes ?? null,
    createdAt: new Date(),
  }).run();

  return true;
}
