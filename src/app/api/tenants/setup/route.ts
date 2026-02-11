import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { db, sqlite } from '@/db';
import { tenants, users, categories, products, featureCatalog, tenantFeatures } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { restaurantTemplate } from '@/db/templates/restaurant';
import { retailTemplate } from '@/db/templates/retail';
import { medicalTemplate } from '@/db/templates/medical';
import { serviceTemplate } from '@/db/templates/service';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(salt + password).digest('hex');
  return `sha256:${salt}:${hash}`;
}

const setupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  industry: z.enum(['restaurant', 'retail', 'medical', 'service']),
});

const templates = {
  restaurant: restaurantTemplate,
  retail: retailTemplate,
  medical: medicalTemplate,
  service: serviceTemplate,
} as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = setupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const { name, email, password, industry } = parsed.data;

    // Check for duplicate email
    const existingUser = db.select().from(users)
      .where(eq(users.email, email))
      .get();
    if (existingUser) {
      return NextResponse.json({ error: '此 Email 已被使用' }, { status: 409 });
    }

    const template = templates[industry];
    const tenantId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const now = new Date();

    const setup = sqlite.transaction(() => {
      // 1. Create tenant
      db.insert(tenants).values({
        id: tenantId,
        name,
        industry,
        plan: 'free',
        settings: JSON.stringify(template.settings),
        createdAt: now,
      }).run();

      // 2. Create owner user
      db.insert(users).values({
        id: userId,
        tenantId,
        email,
        passwordHash: hashPassword(password),
        name: name + ' 管理員',
        role: 'owner',
        createdAt: now,
      }).run();

      // 3. Create categories
      const categoryIdMap = new Map<string, string>();
      for (const cat of template.categories) {
        const catId = crypto.randomUUID();
        categoryIdMap.set(cat.name, catId);
        db.insert(categories).values({
          id: catId,
          tenantId,
          name: cat.name,
          sortOrder: cat.sortOrder,
        }).run();
      }

      // 4. Create products
      for (const prod of template.products) {
        db.insert(products).values({
          id: crypto.randomUUID(),
          tenantId,
          categoryId: categoryIdMap.get(prod.category) ?? null,
          name: prod.name,
          price: prod.price,
          stockQuantity: prod.stockQuantity,
          sku: ('sku' in prod) ? (prod as { sku: string }).sku : null,
          barcode: ('barcode' in prod) ? (prod as { barcode: string }).barcode : null,
          metadata: ('metadata' in prod) ? (prod as { metadata: string }).metadata : null,
          createdAt: now,
        }).run();
      }

      // 5. Activate free features
      const freeFeatures = db.select().from(featureCatalog)
        .where(eq(featureCatalog.isFree, true))
        .all();

      for (const feature of freeFeatures) {
        db.insert(tenantFeatures).values({
          id: crypto.randomUUID(),
          tenantId,
          featureId: feature.id,
          isActive: true,
          activatedAt: now,
        }).run();
      }
    });

    setup();

    const response = NextResponse.json({
      tenantId,
      userId,
      redirect: '/pos',
    }, { status: 201 });

    // Set cookies for auth
    response.cookies.set('tenant_id', tenantId, { path: '/', maxAge: 86400 * 30 });
    response.cookies.set('user_id', userId, { path: '/', maxAge: 86400 * 30 });
    response.cookies.set('tenant_name', name, { path: '/', maxAge: 86400 * 30 });

    return response;
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
