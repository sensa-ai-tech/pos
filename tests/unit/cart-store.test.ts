import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from '@/stores/cart-store';

describe('Cart Store', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [] });
  });

  it('should add an item to the cart', () => {
    const { addItem } = useCartStore.getState();
    addItem({ id: 'p1', name: 'Test Product', price: 100 });

    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe('p1');
    expect(items[0].quantity).toBe(1);
  });

  it('should increment quantity when adding same item', () => {
    const { addItem } = useCartStore.getState();
    addItem({ id: 'p1', name: 'Test', price: 100 });
    addItem({ id: 'p1', name: 'Test', price: 100 });

    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it('should remove an item', () => {
    const store = useCartStore.getState();
    store.addItem({ id: 'p1', name: 'A', price: 100 });
    store.addItem({ id: 'p2', name: 'B', price: 200 });

    useCartStore.getState().removeItem('p1');

    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe('p2');
  });

  it('should update quantity', () => {
    const store = useCartStore.getState();
    store.addItem({ id: 'p1', name: 'A', price: 100 });

    useCartStore.getState().updateQuantity('p1', 5);

    const { items } = useCartStore.getState();
    expect(items[0].quantity).toBe(5);
  });

  it('should remove item when quantity set to 0', () => {
    const store = useCartStore.getState();
    store.addItem({ id: 'p1', name: 'A', price: 100 });

    useCartStore.getState().updateQuantity('p1', 0);

    const { items } = useCartStore.getState();
    expect(items).toHaveLength(0);
  });

  it('should clear cart', () => {
    const store = useCartStore.getState();
    store.addItem({ id: 'p1', name: 'A', price: 100 });
    store.addItem({ id: 'p2', name: 'B', price: 200 });

    useCartStore.getState().clearCart();

    const { items } = useCartStore.getState();
    expect(items).toHaveLength(0);
  });

  it('should calculate subtotal correctly', () => {
    const store = useCartStore.getState();
    store.addItem({ id: 'p1', name: 'A', price: 100 });
    store.addItem({ id: 'p1', name: 'A', price: 100 }); // qty 2
    store.addItem({ id: 'p2', name: 'B', price: 200 });

    expect(useCartStore.getState().getSubtotal()).toBe(400); // 100*2 + 200*1
  });

  it('should calculate tax correctly', () => {
    const store = useCartStore.getState();
    store.addItem({ id: 'p1', name: 'A', price: 1000 });

    expect(useCartStore.getState().getTax(0.05)).toBe(50);
  });

  it('should calculate total correctly', () => {
    const store = useCartStore.getState();
    store.addItem({ id: 'p1', name: 'A', price: 1000 });

    expect(useCartStore.getState().getTotal(0.05)).toBe(1050);
  });

  it('should return correct item count', () => {
    const store = useCartStore.getState();
    store.addItem({ id: 'p1', name: 'A', price: 100 });
    store.addItem({ id: 'p1', name: 'A', price: 100 }); // qty 2
    store.addItem({ id: 'p2', name: 'B', price: 200 }); // qty 1

    expect(useCartStore.getState().getItemCount()).toBe(3);
  });
});
