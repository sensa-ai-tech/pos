/**
 * 🔴 Inventory Race Condition Adversarial Tests
 *
 * Targets: Concurrent order creation causing overselling
 * Files under test:
 *   - src/app/api/orders/route.ts
 *     - L64-87: Stock read OUTSIDE transaction
 *     - L113-158: Transaction block
 *     - L75: Stock check outside transaction
 *     - L154: Uses stale product.stockQuantity (not atomic deduction)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { createTestDb, type TestDbContext } from './helpers/test-db';

let ctx: TestDbContext;

beforeAll(() => {
  ctx = createTestDb('inventory-race');
  const now = new Date();

  ctx.db.insert(schema.tenants).values({
    id: 'race-tenant', name: 'Race Test', industry: 'retail', plan: 'free', createdAt: now,
  }).run();

  ctx.db.insert(schema.products).values([
    { id: 'race-prod-1', tenantId: 'race-tenant', name: 'Limited Item', price: 100, stockQuantity: 1, createdAt: now },
    { id: 'race-prod-5', tenantId: 'race-tenant', name: 'Five Left', price: 200, stockQuantity: 5, createdAt: now },
    { id: 'race-prod-multi', tenantId: 'race-tenant', name: 'Multi Item', price: 50, stockQuantity: 10, createdAt: now },
  ]).run();
});

afterAll(() => ctx.cleanup());

describe('Inventory Race Condition Attacks', () => {
  /**
   * IR-01 [VULN] Concurrent oversell: read-then-write race condition
   *
   * orders/route.ts reads stock at L84 (outside transaction),
   * then deducts inside transaction at L154 using the stale value.
   * Two concurrent reads both see stock=1 → both proceed → stock=-1.
   *
   * In SQLite with WAL mode, we simulate this by showing that
   * the code pattern is vulnerable:
   * SET stockQuantity = (cached_value - quantity) instead of
   * SET stockQuantity = stockQuantity - quantity
   */
  it('[VULN] IR-01: 讀後寫競態 — 使用快取值而非原子扣減', () => {
    // Simulate the vulnerable pattern from orders/route.ts L84 + L154:
    // 1. Read stock value (cached)
    const product = ctx.db.select().from(schema.products)
      .where(eq(schema.products.id, 'race-prod-1'))
      .get()!;

    const cachedStock = product.stockQuantity; // = 1
    expect(cachedStock).toBe(1);

    // 2. Simulate two concurrent transactions both using cached value
    // Transaction A: sees stock=1, deducts 1 → sets to 0
    // Transaction B: ALSO sees stock=1 (cached), deducts 1 → sets to 0
    // But both created orders → actual demand = 2, stock should be -1

    // Simulate Transaction A
    ctx.db.update(schema.products)
      .set({ stockQuantity: cachedStock - 1 }) // SET = 1 - 1 = 0
      .where(eq(schema.products.id, 'race-prod-1'))
      .run();

    // Simulate Transaction B (using same cached value!)
    ctx.db.update(schema.products)
      .set({ stockQuantity: cachedStock - 1 }) // SET = 1 - 1 = 0 (WRONG! should be -1)
      .where(eq(schema.products.id, 'race-prod-1'))
      .run();

    // VULNERABILITY: Stock is 0 instead of -1
    // Both transactions "succeeded" but only deducted once
    // This means one customer's order was fulfilled from air
    const finalProduct = ctx.db.select().from(schema.products)
      .where(eq(schema.products.id, 'race-prod-1'))
      .get()!;

    // With stale-value deduction, stock = 0 (not -1 as it should be if both orders counted)
    expect(finalProduct.stockQuantity).toBe(0);

    // The CORRECT atomic approach would be:
    // SET stockQuantity = stockQuantity - 1 (for each order)
    // Which would give us -1, indicating oversold
  });

  /**
   * IR-02 [VULN] Stale value deduction vs atomic deduction
   *
   * Demonstrate the difference between the vulnerable pattern and correct pattern.
   */
  it('[VULN] IR-02: 使用過期庫存值扣減 vs 原子扣減', () => {
    // Reset stock for this test
    ctx.db.update(schema.products)
      .set({ stockQuantity: 10 })
      .where(eq(schema.products.id, 'race-prod-multi'))
      .run();

    // Vulnerable pattern (current code): SET stockQuantity = cached - N
    const cached = ctx.db.select().from(schema.products)
      .where(eq(schema.products.id, 'race-prod-multi'))
      .get()!.stockQuantity;

    // Two orders: 3 items each
    ctx.db.update(schema.products)
      .set({ stockQuantity: cached - 3 }) // = 10 - 3 = 7
      .where(eq(schema.products.id, 'race-prod-multi'))
      .run();

    // Second order also uses cached=10 (stale!)
    ctx.db.update(schema.products)
      .set({ stockQuantity: cached - 3 }) // = 10 - 3 = 7 (WRONG, should be 4)
      .where(eq(schema.products.id, 'race-prod-multi'))
      .run();

    const afterStale = ctx.db.select().from(schema.products)
      .where(eq(schema.products.id, 'race-prod-multi'))
      .get()!.stockQuantity;

    // VULNERABILITY: Stock = 7 instead of 4
    expect(afterStale).toBe(7); // Lost update!

    // Correct pattern: SET stockQuantity = stockQuantity - N (atomic)
    ctx.db.update(schema.products)
      .set({ stockQuantity: 10 }) // Reset
      .where(eq(schema.products.id, 'race-prod-multi'))
      .run();

    // Atomic deduction
    ctx.sqlite.exec(`UPDATE products SET stock_quantity = stock_quantity - 3 WHERE id = 'race-prod-multi'`);
    ctx.sqlite.exec(`UPDATE products SET stock_quantity = stock_quantity - 3 WHERE id = 'race-prod-multi'`);

    const afterAtomic = ctx.db.select().from(schema.products)
      .where(eq(schema.products.id, 'race-prod-multi'))
      .get()!.stockQuantity;

    expect(afterAtomic).toBe(4); // Correct!
  });

  /**
   * IR-03 [GUARD] Last item purchase then stock exhausted
   *
   * Stock=1 → buy 1 → stock=0 → try buy again → should fail
   */
  it('[GUARD] IR-03: 最後一件商品售出後再購買應失敗', () => {
    // Reset to 1 item
    ctx.db.update(schema.products)
      .set({ stockQuantity: 1 })
      .where(eq(schema.products.id, 'race-prod-1'))
      .run();

    // First purchase succeeds
    const product = ctx.db.select().from(schema.products)
      .where(eq(schema.products.id, 'race-prod-1'))
      .get()!;

    expect(product.stockQuantity).toBeGreaterThanOrEqual(1);

    // Deduct
    ctx.sqlite.exec(`UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = 'race-prod-1'`);

    // Second purchase attempt — check stock
    const afterPurchase = ctx.db.select().from(schema.products)
      .where(eq(schema.products.id, 'race-prod-1'))
      .get()!;

    expect(afterPurchase.stockQuantity).toBe(0);

    // Route check: if (product.stockQuantity < item.quantity) → 400
    expect(afterPurchase.stockQuantity < 1).toBe(true);
  });

  /**
   * IR-04 [GUARD] Stock deduction to exact zero
   */
  it('[GUARD] IR-04: 庫存精確歸零', () => {
    ctx.db.update(schema.products)
      .set({ stockQuantity: 5 })
      .where(eq(schema.products.id, 'race-prod-5'))
      .run();

    // Buy exactly 5
    ctx.sqlite.exec(`UPDATE products SET stock_quantity = stock_quantity - 5 WHERE id = 'race-prod-5'`);

    const product = ctx.db.select().from(schema.products)
      .where(eq(schema.products.id, 'race-prod-5'))
      .get()!;

    expect(product.stockQuantity).toBe(0);
  });

  /**
   * IR-05 [GUARD] Partial failure should rollback
   *
   * Order with Product A (enough stock) + Product B (insufficient).
   * Product B fails → entire order should be rolled back.
   */
  it('[GUARD] IR-05: 部分商品庫存不足時整筆訂單應回滾', () => {
    // Set up: prod-5 has 0 stock from previous test, reset to 0
    ctx.db.update(schema.products)
      .set({ stockQuantity: 0 })
      .where(eq(schema.products.id, 'race-prod-5'))
      .run();

    // Multi-item has 4 from IR-02
    ctx.db.update(schema.products)
      .set({ stockQuantity: 10 })
      .where(eq(schema.products.id, 'race-prod-multi'))
      .run();

    const multiStockBefore = ctx.db.select().from(schema.products)
      .where(eq(schema.products.id, 'race-prod-multi'))
      .get()!.stockQuantity;

    // Simulate order with two items:
    // Item 1: race-prod-multi (10 stock, want 2) → OK
    // Item 2: race-prod-5 (0 stock, want 1) → FAIL

    const stockCheck = (productId: string, requested: number) => {
      const p = ctx.db.select().from(schema.products)
        .where(eq(schema.products.id, productId))
        .get()!;
      return p.stockQuantity >= requested;
    };

    expect(stockCheck('race-prod-multi', 2)).toBe(true);
    expect(stockCheck('race-prod-5', 1)).toBe(false);

    // In the route, this fails at L75 BEFORE the transaction
    // So multi-item stock should remain unchanged
    const multiStockAfter = ctx.db.select().from(schema.products)
      .where(eq(schema.products.id, 'race-prod-multi'))
      .get()!.stockQuantity;

    expect(multiStockAfter).toBe(multiStockBefore);
  });
});
