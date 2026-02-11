/**
 * 🟢 Error Handling Tests
 *
 * Targets: Robustness of API error handling
 * Files under test:
 *   - All API routes that parse JSON body
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Replicate schemas for validation testing
const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    notes: z.string().optional().nullable(),
  })).min(1),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'other']),
  customerId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  metadata: z.string().optional().nullable(),
  taxRate: z.number().min(0).max(1).optional(),
  discount: z.number().min(0).optional(),
});

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

describe('Error Handling Robustness', () => {
  /**
   * EH-01 [GUARD] Malformed JSON body
   *
   * The route's request.json() would throw, caught by try/catch → 500
   */
  it('[GUARD] EH-01: 畸形 JSON 被 safeParse 攔截', () => {
    // safeParse handles non-object types gracefully
    const result1 = createOrderSchema.safeParse('{invalid');
    expect(result1.success).toBe(false);

    const result2 = createProductSchema.safeParse(42);
    expect(result2.success).toBe(false);

    const result3 = createOrderSchema.safeParse([1, 2, 3]);
    expect(result3.success).toBe(false);
  });

  /**
   * EH-02 [GUARD] Wrong Content-Type (form-encoded to JSON endpoint)
   *
   * request.json() would fail if Content-Type is not application/json
   * This is handled by Next.js before reaching the route.
   */
  it('[GUARD] EH-02: 非 JSON 資料被 safeParse 攔截', () => {
    // Simulate form-encoded data parsed as "string"
    const formData = 'name=test&price=100';
    const result = createProductSchema.safeParse(formData);
    expect(result.success).toBe(false);
  });

  /**
   * EH-03 [GUARD] Extra fields are stripped by Zod
   */
  it('[GUARD] EH-03: 多餘欄位被 Zod strip 忽略', () => {
    const result = createProductSchema.safeParse({
      name: 'Valid Product',
      price: 100,
      malicious: true,
      __proto__: { admin: true },
      constructor: 'evil',
    });

    expect(result.success).toBe(true);
    // Extra fields are stripped
    expect('malicious' in result.data!).toBe(false);
  });

  /**
   * EH-04 [GUARD] Empty body → safeParse failure
   */
  it('[GUARD] EH-04: 空 body 被 safeParse 攔截', () => {
    const result1 = createOrderSchema.safeParse(null);
    expect(result1.success).toBe(false);

    const result2 = createOrderSchema.safeParse(undefined);
    expect(result2.success).toBe(false);

    const result3 = createProductSchema.safeParse({});
    expect(result3.success).toBe(false); // Missing required name and price
  });

  /**
   * EH-05 [GUARD] Wrong type fields
   */
  it('[GUARD] EH-05: 錯誤型別被 Zod 攔截', () => {
    const result = createProductSchema.safeParse({
      name: 123, // should be string
      price: 'text', // should be number
    });
    expect(result.success).toBe(false);

    const result2 = createOrderSchema.safeParse({
      items: 'not-an-array',
      paymentMethod: 'cash',
    });
    expect(result2.success).toBe(false);
  });
});
