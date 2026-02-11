/**
 * 🟡 Product Validation Adversarial Tests
 *
 * Targets: Input validation for product creation
 * Files under test:
 *   - src/app/api/products/route.ts (createProductSchema)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { createTestDb, type TestDbContext } from './helpers/test-db';

// Replicate the schema from products/route.ts
const createProductSchema = z.object({
  categoryId: z.string().optional().nullable(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  price: z.number().positive(),
  cost: z.number().optional().nullable(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  metadata: z.string().optional().nullable(),
});

let ctx: TestDbContext;

beforeAll(() => {
  ctx = createTestDb('validation-products');
  const now = new Date();

  ctx.db.insert(schema.tenants).values({
    id: 'vp-tenant', name: 'Product Validation', industry: 'retail', plan: 'free', createdAt: now,
  }).run();
});

afterAll(() => ctx.cleanup());

describe('Product Validation Attacks', () => {
  /**
   * VP-01 [GUARD] Negative price should be rejected
   */
  it('[GUARD] VP-01: 負價格應被 .positive() 攔截', () => {
    const result = createProductSchema.safeParse({
      name: 'Bad Product',
      price: -100,
    });
    expect(result.success).toBe(false);
  });

  /**
   * VP-02 [GUARD] Price = 0 should be rejected
   *
   * .positive() excludes 0 (only > 0 is valid)
   */
  it('[GUARD] VP-02: 價格=0 應被 .positive() 攔截', () => {
    const result = createProductSchema.safeParse({
      name: 'Zero Product',
      price: 0,
    });
    expect(result.success).toBe(false);
  });

  /**
   * VP-03 [VULN] Infinity price passes Zod validation
   *
   * z.number().positive() allows Infinity!
   */
  it('[VULN] VP-03: Infinity 價格通過 Zod 驗證', () => {
    const result = createProductSchema.safeParse({
      name: 'Infinity Product',
      price: Infinity,
    });

    // VULNERABILITY: Infinity passes .positive() check!
    // z.number().positive() → Infinity > 0 is true
    expect(result.success).toBe(true);
  });

  /**
   * VP-04 [GUARD] NaN price should be rejected
   */
  it('[GUARD] VP-04: NaN 價格應被拒絕', () => {
    const result = createProductSchema.safeParse({
      name: 'NaN Product',
      price: NaN,
    });
    expect(result.success).toBe(false);
  });

  /**
   * VP-05 [VULN] Extremely large price passes validation
   *
   * No maximum price limit in schema
   */
  it('[VULN] VP-05: 超大價格通過驗證', () => {
    const result = createProductSchema.safeParse({
      name: 'Expensive Product',
      price: Number.MAX_SAFE_INTEGER + 1,
    });

    // No max price limit
    expect(result.success).toBe(true);
  });

  /**
   * VP-06 [VULN] Whitespace-only name passes .min(1) check
   *
   * .min(1) only checks string length, not content
   */
  it('[VULN] VP-06: 空白名稱通過 .min(1) 驗證', () => {
    const result = createProductSchema.safeParse({
      name: '   ', // 3 spaces
      price: 100,
    });

    // VULNERABILITY: Whitespace passes .min(1) — it only checks length
    expect(result.success).toBe(true);
  });

  /**
   * VP-07 [VULN] Extremely long name has no maxLength
   */
  it('[VULN] VP-07: 超長名稱無 maxLength 限制', () => {
    const longName = 'A'.repeat(10000);
    const result = createProductSchema.safeParse({
      name: longName,
      price: 100,
    });

    // No maxLength check
    expect(result.success).toBe(true);
    expect(result.data!.name.length).toBe(10000);
  });

  /**
   * VP-08 [GUARD] Negative stock quantity should be rejected
   */
  it('[GUARD] VP-08: 負庫存應被 .min(0) 攔截', () => {
    const result = createProductSchema.safeParse({
      name: 'Negative Stock',
      price: 100,
      stockQuantity: -5,
    });
    expect(result.success).toBe(false);
  });

  /**
   * VP-09 [VULN] Extremely large stock quantity has no limit
   */
  it('[VULN] VP-09: 超大庫存數無上限', () => {
    const result = createProductSchema.safeParse({
      name: 'Huge Stock',
      price: 100,
      stockQuantity: Number.MAX_SAFE_INTEGER,
    });

    expect(result.success).toBe(true);
  });

  /**
   * VP-10 [VULN] XSS in metadata is not sanitized
   *
   * metadata is stored as-is in DB, no sanitization
   */
  it('[VULN] VP-10: XSS metadata 未被清理', () => {
    const xssPayload = '<script>alert("xss")</script>';
    const result = createProductSchema.safeParse({
      name: 'XSS Product',
      price: 100,
      metadata: xssPayload,
    });

    // No sanitization
    expect(result.success).toBe(true);
    expect(result.data!.metadata).toBe(xssPayload);

    // Also verify it can be stored in DB
    ctx.db.insert(schema.products).values({
      id: 'xss-product',
      tenantId: 'vp-tenant',
      name: 'XSS Product',
      price: 100,
      metadata: xssPayload,
      createdAt: new Date(),
    }).run();

    const stored = ctx.db.select().from(schema.products)
      .where(eq(schema.products.id, 'xss-product'))
      .get()!;

    // VULNERABILITY: XSS stored as-is
    expect(stored.metadata).toBe(xssPayload);
  });
});
