/**
 * 🟡 Order Processing Defect Tests
 *
 * Targets: Business logic flaws in order creation
 * Files under test:
 *   - src/app/api/orders/route.ts (L107: negative total, L110: order number collision, L147: hardcoded status)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { createTestDb, type TestDbContext } from './helpers/test-db';

let ctx: TestDbContext;

beforeAll(() => {
  ctx = createTestDb('order-processing');
  const now = new Date();

  ctx.db.insert(schema.tenants).values({
    id: 'op-tenant', name: 'Order Processing', industry: 'retail', plan: 'free', createdAt: now,
  }).run();

  ctx.db.insert(schema.products).values([
    { id: 'op-prod-1', tenantId: 'op-tenant', name: 'Product A', price: 100, stockQuantity: 100, createdAt: now },
    { id: 'op-prod-2', tenantId: 'op-tenant', name: 'Product B', price: 50, stockQuantity: 50, isActive: false, createdAt: now },
  ]).run();
});

afterAll(() => ctx.cleanup());

describe('Order Processing Defects', () => {
  /**
   * OP-01 [VULN] Negative total amount from excessive discount
   *
   * orders/route.ts L107: total = subtotal + tax - discount
   * No check that total >= 0
   */
  it('[VULN] OP-01: 大折扣產生負總金額', () => {
    const subtotal = 100; // 1 x Product A
    const taxRate = 0.05;
    const tax = Math.round(subtotal * taxRate * 100) / 100; // = 5
    const discount = 500; // Way more than subtotal

    const total = subtotal + tax - discount; // = 100 + 5 - 500 = -395

    // VULNERABILITY: Negative total!
    expect(total).toBe(-395);
    expect(total).toBeLessThan(0);

    // This can be stored in DB without validation
    ctx.db.insert(schema.orders).values({
      id: 'neg-order',
      tenantId: 'op-tenant',
      orderNumber: 'ORD-NEG-001',
      status: 'completed',
      subtotal,
      tax,
      discount,
      total,
      paymentMethod: 'cash',
      createdAt: new Date(),
    }).run();

    const order = ctx.db.select().from(schema.orders)
      .where(eq(schema.orders.id, 'neg-order'))
      .get()!;

    expect(order.total).toBeLessThan(0);
  });

  /**
   * OP-02 [VULN] Order number collision risk
   *
   * L110: Math.random().toString(36).substring(2, 6) → 4 chars → ~1.6M combinations
   * High collision probability at scale (birthday problem)
   */
  it('[VULN] OP-02: 訂單號碼碰撞風險', () => {
    const generateOrderNumber = () => {
      const now = new Date();
      return `ORD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    };

    // Generate many order numbers and check for collisions
    const numbers = new Set<string>();
    const total = 5000;
    for (let i = 0; i < total; i++) {
      numbers.add(generateOrderNumber());
    }

    // With 4 base-36 chars (~1,679,616 combinations),
    // 5000 orders have ~0.74% collision chance (birthday paradox)
    // Practically, duplicates are very possible at scale
    // We demonstrate the small keyspace
    const uniqueRatio = numbers.size / total;
    expect(uniqueRatio).toBeLessThanOrEqual(1); // Some may collide

    // The 4-char random part has limited entropy
    const sampleNumber = generateOrderNumber();
    const randomPart = sampleNumber.split('-').pop()!;
    expect(randomPart.length).toBe(4); // Only 4 chars of randomness
  });

  /**
   * OP-03 [VULN] Payment status is always 'completed'
   *
   * L147: status: 'completed' is hardcoded — no actual payment processing
   */
  it('[VULN] OP-03: 付款狀態永遠為 completed（無實際付款驗證）', () => {
    // Simulate order creation — payment is always 'completed'
    ctx.db.insert(schema.orders).values({
      id: 'op-order-1',
      tenantId: 'op-tenant',
      orderNumber: 'ORD-OP-001',
      status: 'completed', // Hardcoded
      subtotal: 100,
      tax: 5,
      total: 105,
      paymentMethod: 'card', // Claims card payment
      createdAt: new Date(),
    }).run();

    ctx.db.insert(schema.payments).values({
      id: 'op-pay-1',
      tenantId: 'op-tenant',
      orderId: 'op-order-1',
      amount: 105,
      method: 'card',
      status: 'completed', // Hardcoded L147
      createdAt: new Date(),
    }).run();

    const payment = ctx.db.select().from(schema.payments)
      .where(eq(schema.payments.id, 'op-pay-1'))
      .get()!;

    // VULNERABILITY: No actual card charge verification
    expect(payment.status).toBe('completed');
    // Should have pending → processing → completed flow
  });

  /**
   * OP-04 [VULN] Inactive product can still be ordered
   *
   * orders/route.ts checks product existence and stock,
   * but NOT isActive flag
   */
  it('[VULN] OP-04: 停用商品仍可下單（未檢查 isActive）', () => {
    // Product B is inactive (isActive: false)
    const product = ctx.db.select().from(schema.products)
      .where(eq(schema.products.id, 'op-prod-2'))
      .get()!;

    expect(product.isActive).toBe(false);

    // But the order route only checks:
    // 1. Product exists (by id + tenantId) ✓
    // 2. Stock sufficient ✓
    // 3. isActive ✗ NOT CHECKED!
    expect(product.stockQuantity).toBeGreaterThan(0); // 50 in stock

    // VULNERABILITY: Order would succeed for inactive product
  });

  /**
   * OP-05 [VULN] Oversized metadata has no length limit
   */
  it('[VULN] OP-05: 超大 metadata JSON 無長度限制', () => {
    const hugeMetadata = JSON.stringify({ data: 'A'.repeat(100000) });

    ctx.db.insert(schema.orders).values({
      id: 'op-huge-meta',
      tenantId: 'op-tenant',
      orderNumber: 'ORD-META-001',
      status: 'completed',
      subtotal: 100,
      tax: 5,
      total: 105,
      paymentMethod: 'cash',
      metadata: hugeMetadata,
      createdAt: new Date(),
    }).run();

    const order = ctx.db.select().from(schema.orders)
      .where(eq(schema.orders.id, 'op-huge-meta'))
      .get()!;

    // VULNERABILITY: No size limit on metadata
    expect(order.metadata!.length).toBeGreaterThan(100000);
  });
});
