import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db, sqlite } from '@/db';
import { tenants, users, categories, products, featureCatalog, tenantFeatures } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { restaurantTemplate } from '@/db/templates/restaurant';
import { retailTemplate } from '@/db/templates/retail';
import { medicalTemplate } from '@/db/templates/medical';
import { serviceTemplate } from '@/db/templates/service';
import { cafeTemplate } from '@/db/templates/cafe';
import { gymTemplate } from '@/db/templates/gym';
import { educationTemplate } from '@/db/templates/education';
import { petshopTemplate } from '@/db/templates/petshop';
import { repairTemplate } from '@/db/templates/repair';
import { beautyTemplate } from '@/db/templates/beauty';
import { TENANT_SESSION_MAX_AGE_SECONDS, signSession } from '@/lib/session';
import { setTenantSessionCookies } from '@/lib/tenant-session-cookies';
import { LEGACY_DEFAULT_EMPLOYEE_PASSWORD } from '@/lib/tenant-login';

function hashPassword(password: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

const setupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(128)
    .refine((value) => value !== LEGACY_DEFAULT_EMPLOYEE_PASSWORD, { message: '這組密碼不能使用' }),
  industry: z.enum(['restaurant', 'retail', 'medical', 'service', 'cafe', 'gym', 'education', 'petshop', 'repair', 'beauty']),
});

const templates = {
  restaurant: restaurantTemplate,
  retail: retailTemplate,
  medical: medicalTemplate,
  service: serviceTemplate,
  cafe: cafeTemplate,
  gym: gymTemplate,
  education: educationTemplate,
  petshop: petshopTemplate,
  repair: repairTemplate,
  beauty: beautyTemplate,
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
    // Sign before writing so a missing SESSION_SECRET cannot leave a half-onboarded tenant.
    const sessionToken = await signSession(
      { kind: 'tenant', tenantId, userId },
      TENANT_SESSION_MAX_AGE_SECONDS
    );

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

    setTenantSessionCookies(response, { sessionToken, tenantId, tenantName: name });

    return response;
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
