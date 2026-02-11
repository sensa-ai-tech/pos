import { create } from 'zustand';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (product: { id: string; name: string; price: number }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTax: (rate: number) => number;
  getTotal: (taxRate: number) => number;
  getItemCount: () => number;
}

function isValidPrice(price: number): boolean {
  return typeof price === 'number' && Number.isFinite(price) && price >= 0;
}

function isValidQuantity(qty: number): boolean {
  return typeof qty === 'number' && Number.isFinite(qty) && Number.isInteger(qty) && qty > 0 && qty <= 9999;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (product) => {
    // Validate inputs
    if (!product.id || !product.name) return;
    if (!isValidPrice(product.price)) return;

    set((state) => {
      const existing = state.items.find((i) => i.productId === product.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === product.id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        };
      }
      return {
        items: [
          ...state.items,
          { productId: product.id, name: product.name, price: product.price, quantity: 1 },
        ],
      };
    });
  },

  removeItem: (productId) => {
    set((state) => ({
      items: state.items.filter((i) => i.productId !== productId),
    }));
  },

  updateQuantity: (productId, quantity) => {
    // Remove if invalid or <= 0
    if (!isValidQuantity(quantity)) {
      get().removeItem(productId);
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.productId === productId ? { ...i, quantity } : i
      ),
    }));
  },

  clearCart: () => set({ items: [] }),

  getSubtotal: () => {
    return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  },

  getTax: (rate) => {
    // Clamp rate to valid range
    const safeRate = Math.max(0, Math.min(1, Number.isFinite(rate) ? rate : 0));
    const subtotal = get().getSubtotal();
    return Math.round(subtotal * safeRate * 100) / 100;
  },

  getTotal: (taxRate) => {
    const subtotal = get().getSubtotal();
    const tax = get().getTax(taxRate);
    return subtotal + tax;
  },

  getItemCount: () => {
    return get().items.reduce((sum, i) => sum + i.quantity, 0);
  },
}));
