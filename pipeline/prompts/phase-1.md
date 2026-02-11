# Phase 1: 核心 POS 功能

## 前提
Phase 0 已完成，專案在 `~/onekey-pos`，資料庫和 API 已可運行。

## 你的任務
實作基礎收銀、商品管理、訂單流程的完整 UI 和邏輯。

## 安裝額外依賴

```bash
cd ~/onekey-pos
npm install zustand zod lucide-react
npx shadcn-ui@latest init -y
npx shadcn-ui@latest add button card input dialog table badge tabs select toast sheet
```

## 實作項目

### 1. Layout 框架 (`src/app/(dashboard)/layout.tsx`)

側邊欄導航，包含：
- Dashboard（首頁）
- POS 收銀
- 商品管理
- 訂單紀錄
- 庫存管理
- 設定

頂部顯示當前租戶名稱。使用 Tailwind + shadcn/ui 建構。
側邊欄在手機上可收合。

### 2. 購物車狀態 (`src/stores/cart-store.ts`)

使用 Zustand 管理：

```typescript
interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTax: (rate: number) => number;
  getTotal: (taxRate: number) => number;
  getItemCount: () => number;
}
```

### 3. POS 收銀頁面 (`src/app/(dashboard)/pos/page.tsx`)

左右分割佈局：
- **左側 (60%)**: 商品網格
  - 頂部：分類篩選 tab
  - 網格：商品卡片（名稱 + 價格），點擊加入購物車
  - 搜尋框：即時篩選商品
- **右側 (40%)**: 購物車
  - 購物車項目清單（可調數量、刪除）
  - 小計 / 稅 / 總計
  - 付款方式選擇（現金/刷卡/轉帳）
  - 「結帳」按鈕

結帳流程：
1. 按下結帳 → 呼叫 `POST /api/orders`（含 items 和 payment info）
2. API 建立 order + order_items + payment 記錄
3. 自動扣減商品庫存 (stock_quantity)
4. 成功後清空購物車 + 顯示成功 toast
5. 顯示訂單編號

### 4. 商品管理頁面 (`src/app/(dashboard)/products/page.tsx`)

- 商品列表（表格形式）：名稱、分類、價格、庫存、狀態
- 「新增商品」按鈕 → Dialog 表單
- 每列有「編輯」「刪除」操作
- 分類篩選

商品表單欄位：
- 名稱（必填）
- 分類（選單）
- 價格（必填）
- 成本價（選填）
- SKU（選填）
- 庫存數量
- 低庫存警示門檻
- 啟用/停用

### 5. 訂單管理頁面 (`src/app/(dashboard)/orders/page.tsx`)

- 訂單列表：訂單號、日期時間、金額、狀態、付款方式
- 點擊展開訂單詳情（含明細項目）
- 按日期篩選
- 狀態篩選（全部/已完成/已取消）

### 6. 訂單建立 API 完善 (`src/app/api/orders/route.ts`)

POST handler 邏輯：
```
1. 驗證 tenant_id
2. Zod 驗證 request body (items[], payment_method)
3. 計算 subtotal, tax, total
4. 用 transaction 包裹：
   a. 建立 order 記錄
   b. 建立 order_items
   c. 建立 payment 記錄
   d. 扣減每個商品的 stock_quantity
5. 回傳完整 order 資料
```

### 7. 基礎報表 API (`src/app/api/reports/daily/route.ts`)

回傳：
- 今日訂單數
- 今日營收
- 今日平均客單價
- 付款方式分佈

### 8. 單元測試 (`tests/unit/`)

至少包含：
- `cart-store.test.ts`：購物車加減、清空、計算
- `order-api.test.ts`：訂單建立邏輯
- `inventory.test.ts`：庫存扣減驗證

## 完成後

```bash
npm run build
npx vitest run
bash pipeline/qg-1.sh .
```
