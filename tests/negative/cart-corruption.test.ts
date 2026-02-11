/**
 * 🟡 Cart State Corruption Tests
 *
 * Targets: Client-side cart store input validation
 * Files under test:
 *   - src/stores/cart-store.ts (no input validation on addItem, updateQuantity, getTax)
 */
import { describe, it, expect, beforeEach } from 'vitest';

// We can't use Zustand hooks directly in tests,
// so we replicate the core logic for testing
interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

function createCartState() {
  let items: CartItem[] = [];

  return {
    get items() { return items; },

    addItem(product: { id: string; name: string; price: number }) {
      const existing = items.find(i => i.productId === product.id);
      if (existing) {
        items = items.map(i =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      } else {
        items = [...items, { productId: product.id, name: product.name, price: product.price, quantity: 1 }];
      }
    },

    removeItem(productId: string) {
      items = items.filter(i => i.productId !== productId);
    },

    updateQuantity(productId: string, quantity: number) {
      if (quantity <= 0) {
        items = items.filter(i => i.productId !== productId);
        return;
      }
      items = items.map(i =>
        i.productId === productId ? { ...i, quantity } : i
      );
    },

    clearCart() { items = []; },

    getSubtotal() {
      return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    },

    getTax(rate: number) {
      const subtotal = this.getSubtotal();
      return Math.round(subtotal * rate * 100) / 100;
    },

    getTotal(taxRate: number) {
      return this.getSubtotal() + this.getTax(taxRate);
    },

    getItemCount() {
      return items.reduce((sum, i) => sum + i.quantity, 0);
    },
  };
}

describe('Cart State Corruption Attacks', () => {
  let cart: ReturnType<typeof createCartState>;

  beforeEach(() => {
    cart = createCartState();
  });

  /**
   * CC-01 [VULN] Negative price product
   *
   * addItem has no price validation → negative subtotal
   */
  it('[VULN] CC-01: 負價格商品使小計為負', () => {
    cart.addItem({ id: 'neg', name: 'Negative Price', price: -100 });

    expect(cart.items.length).toBe(1);
    expect(cart.items[0].price).toBe(-100);

    // VULNERABILITY: Subtotal is negative
    expect(cart.getSubtotal()).toBe(-100);
  });

  /**
   * CC-02 [VULN] Infinity price product
   */
  it('[VULN] CC-02: Infinity 價格使小計為 Infinity', () => {
    cart.addItem({ id: 'inf', name: 'Infinity Price', price: Infinity });

    expect(cart.getSubtotal()).toBe(Infinity);
    expect(cart.getTotal(0.05)).toBe(Infinity);
  });

  /**
   * CC-03 [VULN] NaN price product
   */
  it('[VULN] CC-03: NaN 價格使小計為 NaN', () => {
    cart.addItem({ id: 'nan', name: 'NaN Price', price: NaN });

    expect(Number.isNaN(cart.getSubtotal())).toBe(true);
    expect(Number.isNaN(cart.getTotal(0.05))).toBe(true);
  });

  /**
   * CC-04 [GUARD] Negative quantity update removes item
   *
   * updateQuantity: if (quantity <= 0) → removeItem
   */
  it('[GUARD] CC-04: 負數量更新移除商品', () => {
    cart.addItem({ id: 'prod-1', name: 'Product', price: 100 });
    expect(cart.items.length).toBe(1);

    cart.updateQuantity('prod-1', -5);
    expect(cart.items.length).toBe(0);
  });

  /**
   * CC-05 [VULN] Infinity quantity passes > 0 check
   */
  it('[VULN] CC-05: Infinity 數量通過 >0 檢查', () => {
    cart.addItem({ id: 'prod-1', name: 'Product', price: 100 });
    cart.updateQuantity('prod-1', Infinity);

    // Infinity > 0 is true → passes the check
    expect(cart.items[0].quantity).toBe(Infinity);
    expect(cart.getSubtotal()).toBe(Infinity);
    expect(cart.getItemCount()).toBe(Infinity);
  });

  /**
   * CC-06 [VULN] Negative tax rate produces negative tax
   */
  it('[VULN] CC-06: 負稅率產生負稅金', () => {
    cart.addItem({ id: 'prod-1', name: 'Product', price: 100 });

    const tax = cart.getTax(-0.5);

    // VULNERABILITY: Negative tax!
    expect(tax).toBe(-50);
    expect(cart.getTotal(-0.5)).toBe(50); // 100 + (-50) = 50
  });

  /**
   * CC-07 [VULN] Tax rate > 1 (e.g., 5 = 500% tax)
   */
  it('[VULN] CC-07: 超大稅率產生荒謬稅金', () => {
    cart.addItem({ id: 'prod-1', name: 'Product', price: 100 });

    const tax = cart.getTax(5); // 500% tax

    expect(tax).toBe(500);
    expect(cart.getTotal(5)).toBe(600); // 100 + 500
  });

  /**
   * CC-08 [VULN] Empty ID product
   *
   * addItem has no validation on product ID
   */
  it('[VULN] CC-08: 空 ID 商品可加入購物車', () => {
    cart.addItem({ id: '', name: 'No ID', price: 100 });

    expect(cart.items.length).toBe(1);
    expect(cart.items[0].productId).toBe('');

    // Adding another empty ID product would increment quantity
    cart.addItem({ id: '', name: 'No ID', price: 100 });
    expect(cart.items.length).toBe(1);
    expect(cart.items[0].quantity).toBe(2);
  });
});
