import { db } from '@/db';
import { featureCatalog, tenantFeatures } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// Re-export from feature-ids for server-side consumers
export { FEATURES, type FeatureId } from '@/lib/feature-ids';

export function hasFeature(tenantId: string, featureId: string): boolean {
  const feature = db
    .select()
    .from(tenantFeatures)
    .where(
      and(
        eq(tenantFeatures.tenantId, tenantId),
        eq(tenantFeatures.featureId, featureId),
        eq(tenantFeatures.isActive, true)
      )
    )
    .get();

  if (!feature) return false;

  // Check expiration
  if (feature.expiresAt && feature.expiresAt < new Date()) {
    return false;
  }

  return true;
}

export function getTenantFeatures(tenantId: string) {
  const active = db
    .select({
      featureId: tenantFeatures.featureId,
      featureName: featureCatalog.name,
      featureDescription: featureCatalog.description,
      category: featureCatalog.category,
      priceMonthly: featureCatalog.priceMonthly,
      isFree: featureCatalog.isFree,
      isActive: tenantFeatures.isActive,
      activatedAt: tenantFeatures.activatedAt,
      expiresAt: tenantFeatures.expiresAt,
    })
    .from(tenantFeatures)
    .innerJoin(featureCatalog, eq(tenantFeatures.featureId, featureCatalog.id))
    .where(eq(tenantFeatures.tenantId, tenantId))
    .all();

  return active;
}

export function activateFeature(tenantId: string, featureId: string) {
  // Check if already activated
  const existing = db
    .select()
    .from(tenantFeatures)
    .where(
      and(
        eq(tenantFeatures.tenantId, tenantId),
        eq(tenantFeatures.featureId, featureId)
      )
    )
    .get();

  if (existing) {
    // Reactivate
    db.update(tenantFeatures)
      .set({ isActive: true, activatedAt: new Date() })
      .where(
        and(
          eq(tenantFeatures.tenantId, tenantId),
          eq(tenantFeatures.featureId, featureId)
        )
      )
      .run();
  } else {
    db.insert(tenantFeatures)
      .values({
        id: crypto.randomUUID(),
        tenantId,
        featureId,
        isActive: true,
        activatedAt: new Date(),
      })
      .run();
  }
}

export function deactivateFeature(tenantId: string, featureId: string) {
  db.update(tenantFeatures)
    .set({ isActive: false })
    .where(
      and(
        eq(tenantFeatures.tenantId, tenantId),
        eq(tenantFeatures.featureId, featureId)
      )
    )
    .run();
}

export function getAllFeatures() {
  return db.select().from(featureCatalog).all();
}
