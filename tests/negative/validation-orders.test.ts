/**
 * 🟡 Order Validation Adversarial Tests
 *
 * Targets: Input validation for order creation
 * Files under test:
 *   - src/app/api/orders/route.ts (createOrderSchema + POST logic)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { createTestDb, type TestDbContext } from './helpers/test-db';

// Replicate the schema from orders/route.ts
const orderItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  notes: z.string().optional().nullable(),
});

const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'other']),
  customerId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  metadata: z.string().optional().nullable(),
  taxRate: z.number().min(0).max(1).optional(),
  discount: z.number().min(0).optional(),
});

let ctx: TestDbContext;

beforeAll(() => {
  ctx = createTestDb('validation-orders');
  const now = new Date();

  ctx.db.insert(schema.tenants).values({
    id: 'vo-tenant', name: 'Validation Test', industry: 'retail', plan: 'free', createdAt: now,
  }).run();

  ctx.db.insert(schema.products).values([
    { id: 'vo-prod-1', tenantId: 'vo-tenant', name: 'Valid Product', price: 100, stockQuantity: 50, createdAt: now },
    { id: 'vo-prod-2', tenantId: 'vo-tenant', name: 'Another Product', price: 200, stockQuantity: 30, createdAt: now },
  ]).run();
});

afterAll(() => ctx.cleanup());

describe('Order Validation Attacks', () => {
  /**
   * VO-01 [GUARD] Empty items array should be rejected
   */
  it('[GUARD] VO-01: 空商品陣列應被 Zod .min(1) 攔截', () => {
    const result = createOrderSchema.safeParse({
      items: [],
      paymentMethod: 'cash',
    });
    expect(result.success).toBe(false);
  });

  /**
   * VO-02 [GUARD] Quantity = 0 should be rejected
   */
  it('[GUARD] VO-02: 數量=0 應被 .positive() 攔截', () => {
    const result = createOrderSchema.safeParse({
      items: [{ productId: 'vo-prod-1', quantity: 0 }],
      paymentMethod: 'cash',
    });
    expect(result.success).toBe(false);
  });

  /**
   * VO-03 [GUARD] Negative quantity should be rejected
   */
  it('[GUARD] VO-03: 負數量應被拒絕', () => {
    const result = createOrderSchema.safeParse({
      items: [{ productId: 'vo-prod-1', quantity: -1 }],
      paymentMethod: 'cash',
    });
    expect(result.success).toBe(false);
  });

  /**
   * VO-04 [GUARD] Float quantity should be rejected
   */
  it('[GUARD] VO-04: 浮點數量應被 .int() 攔截', () => {
    const result = createOrderSchema.safeParse({
      items: [{ productId: 'vo-prod-1', quantity: 1.5 }],
      paymentMethod: 'cash',
    });
    expect(result.success).toBe(false);
  });

  /**
   * VO-05 [VULN] Discount exceeding subtotal creates negative total
   *
   * orders/route.ts L107: total = subtotal + tax - discount
   * discount has no upper bound in schema (.min(0) only)
   */
  it('[VULN] VO-05: 折扣超過小計可產生負總金額', () => {
    const result = createOrderSchema.safeParse({
      items: [{ productId: 'vo-prod-1', quantity: 1 }],
      paymentMethod: 'cash',
      discount: 99999,
    });

    // Zod allows this — no max on discount
    expect(result.success).toBe(true);

    // Simulate the calculation: subtotal=100, tax=5, discount=99999
    const subtotal = 100;
    const taxRate = 0.05;
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    const total = subtotal + tax - 99999;

    // VULNERABILITY: Total is negative!
    expect(total).toBeLessThan(0);
    expect(total).toBe(100 + 5 - 99999);
  });

  /**
   * VO-06 [GUARD] Tax rate = 0 is valid boundary
   */
  it('[GUARD] VO-06: 稅率=0 應為合法邊界值', () => {
    const result = createOrderSchema.safeParse({
      items: [{ productId: 'vo-prod-1', quantity: 1 }],
      paymentMethod: 'cash',
      taxRate: 0,
    });
    expect(result.success).toBe(true);
  });

  /**
   * VO-07 [GUARD] Tax rate = 1 (100%) is valid boundary
   */
  it('[GUARD] VO-07: 稅率=1 (100%) 應為合法邊界值', () => {
    const result = createOrderSchema.safeParse({
      items: [{ productId: 'vo-prod-1', quantity: 1 }],
      paymentMethod: 'cash',
      taxRate: 1,
    });
    expect(result.success).toBe(true);
  });

  /**
   * VO-08 [GUARD] Tax rate > 1 should be rejected
   */
  it('[GUARD] VO-08: 稅率>1 應被 .max(1) 攔截', () => {
    const result = createOrderSchema.safeParse({
      items: [{ productId: 'vo-prod-1', quantity: 1 }],
      paymentMethod: 'cash',
      taxRate: 1.5,
    });
    expect(result.success).toBe(false);
  });

  /**
   * VO-09 [GUARD] Non-existent product ID
   *
   * orders/route.ts L67-72 checks product existence with tenantId filter
   */
  it('[GUARD] VO-09: 不存在的商品 ID 查詢返回空', () => {
    const product = ctx.db.select().from(schema.products)
      .where(eq(schema.products.id, 'fake-product-uuid'))
      .get();

    expect(product).toBeUndefined();
  });

  /**
   * VO-10 [GUARD] Malformed JSON should be caught
   */
  it('[GUARD] VO-10: 畸形 JSON 應被 safeParse 攔截', () => {
    // Simulate parsing invalid JSON that became an invalid object
    const result = createOrderSchema.safeParse('not-json');
    expect(result.success).toBe(false);

    const result2 = createOrderSchema.safeParse(null);
    expect(result2.success).toBe(false);

    const result3 = createOrderSchema.safeParse(undefined);
    expect(result3.success).toBe(false);
  });

  /**
   * VO-11 [GUARD] Duplicate product IDs in same order
   *
   * The schema allows this — each item is processed independently.
   * Stock might be double-deducted but the order is "valid."
   */
  it('[VULN] VO-11: 重複商品 ID 在同一訂單不被攔截', () => {
    const result = createOrderSchema.safeParse({
      items: [
        { productId: 'vo-prod-1', quantity: 1 },
        { productId: 'vo-prod-1', quantity: 2 }, // same product, different item
      ],
      paymentMethod: 'cash',
    });

    // Zod allows duplicate productIds — no uniqueness check
    expect(result.success).toBe(true);
    expect(result.data!.items.length).toBe(2);
  });
});
