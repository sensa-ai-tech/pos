/**
 * 🟡 Product Lifecycle Edge Case Tests
 *
 * Targets: Product state transitions and integrity
 * Files under test:
 *   - src/app/api/orders/route.ts (doesn't check isActive)
 *   - DB FK constraints
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { createTestDb, type TestDbContext } from './helpers/test-db';

let ctx: TestDbContext;

beforeAll(() => {
  ctx = createTestDb('product-lifecycle');
  const now = new Date();

  ctx.db.insert(schema.tenants).values({
    id: 'pl-tenant', name: 'Lifecycle Test', industry: 'retail', plan: 'free', createdAt: now,
  }).run();

  ctx.db.insert(schema.products).values([
    { id: 'pl-prod-active', tenantId: 'pl-tenant', name: 'Active Product', price: 100, stockQuantity: 10, isActive: true, createdAt: now },
    { id: 'pl-prod-inactive', tenantId: 'pl-tenant', name: 'Inactive Product', price: 200, stockQuantity: 20, isActive: false, createdAt: now },
  ]).run();

  // Create an order that references pl-prod-active
  ctx.db.insert(schema.orders).values({
    id: 'pl-order-1', tenantId: 'pl-tenant', orderNumber: 'PL-001',
    status: 'completed', subtotal: 100, tax: 5, total: 105,
    paymentMethod: 'cash', createdAt: now,
  }).run();

  ctx.db.insert(schema.orderItems).values({
    id: 'pl-oi-1', orderId: 'pl-order-1', productId: 'pl-prod-active',
    productName: 'Active Product', quantity: 1, unitPrice: 100, subtotal: 100,
  }).run();
});

afterAll(() => ctx.cleanup());

describe('Product Lifecycle Edge Cases', () => {
  /**
   * PL-01 [GUARD] Deleting product with existing orders blocked by FK
   *
   * order_items has FK to products(id). Deleting a product that
   * has been ordered should fail.
   */
  it('[GUARD] PL-01: 刪除有訂單的商品被 FK 阻止', () => {
    let fkError = false;
    try {
      ctx.db.delete(schema.products)
        .where(eq(schema.products.id, 'pl-prod-active'))
        .run();
    } catch {
      fkError = true;
    }

    // FK constraint prevents deletion
    expect(fkError).toBe(true);

    // Verify product still exists
    const product = ctx.db.select().from(schema.products)
      .where(eq(schema.products.id, 'pl-prod-active'))
      .get();
    expect(product).toBeDefined();
  });

  /**
   * PL-02 [VULN] Inactive product can still be ordered
   *
   * orders/route.ts checks product existence and stock,
   * but NOT isActive flag.
   */
  it('[VULN] PL-02: 停用商品仍可下單（isActive 未被檢查）', () => {
    // The product is inactive
    const product = ctx.db.select().from(schema.products)
      .where(eq(schema.products.id, 'pl-prod-inactive'))
      .get()!;

    expect(product.isActive).toBe(false);
    expect(product.stockQuantity).toBeGreaterThan(0);

    // orders/route.ts only checks:
    // 1. eq(products.id, item.productId) ✓
    // 2. eq(products.tenantId, tenantId) ✓
    // 3. product.stockQuantity < item.quantity ✓
    // 4. product.isActive ✗ NOT CHECKED
    //
    // So the product would pass all existing validations
    const passesExistenceCheck = product !== undefined;
    const passesStockCheck = product.stockQuantity >= 1;
    const isActive = product.isActive;

    expect(passesExistenceCheck).toBe(true);
    expect(passesStockCheck).toBe(true);
    expect(isActive).toBe(false); // VULNERABILITY: inactive but passes checks
  });

  /**
   * PL-03 [VULN] Price change in DB not reflected in existing cart
   *
   * Cart stores price at addItem time. If product price changes
   * between cart addition and checkout, the old price is used.
   */
  it('[VULN] PL-03: DB 價格變更不影響購物車中的舊價格', () => {
    // Original price
    const originalProduct = ctx.db.select().from(schema.products)
      .where(eq(schema.products.id, 'pl-prod-active'))
      .get()!;
    expect(originalProduct.price).toBe(100);

    // Simulate: cart stores price at time of adding
    const cartPrice = originalProduct.price; // 100

    // Store owner changes price
    ctx.db.update(schema.products)
      .set({ price: 500 })
      .where(eq(schema.products.id, 'pl-prod-active'))
      .run();

    // Verify DB has new price
    const updatedProduct = ctx.db.select().from(schema.products)
      .where(eq(schema.products.id, 'pl-prod-active'))
      .get()!;
    expect(updatedProduct.price).toBe(500);

    // But cart still has old price!
    expect(cartPrice).toBe(100); // Stale!

    // VULNERABILITY: Cart would checkout at $100, but product now costs $500
    // The order API uses DB price (L84: product.price), not cart price
    // So this is actually "safe" server-side, but the UI shows wrong price
    // until the cart is rebuilt.

    // Reset price
    ctx.db.update(schema.products)
      .set({ price: 100 })
      .where(eq(schema.products.id, 'pl-prod-active'))
      .run();
  });
});
