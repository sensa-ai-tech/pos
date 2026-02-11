# Phase 2: 四大產業模板

## 前提
Phase 0-1 已完成，核心 POS 收銀功能可運行。

## 你的任務
實作餐飲、零售、醫療、服務業四種產業模板，包含：
1. 各產業的預設 seed 資料
2. 產業專屬 UI 元件
3. 「一鍵生成」Onboarding 流程

## 實作項目

### 1. 產業模板資料 (`src/db/templates/`)

建立四個檔案，每個匯出 `{ categories, products, settings }` 物件：

#### `restaurant.ts` (餐飲)
```typescript
export const restaurantTemplate = {
  categories: [
    { name: '前菜', sort_order: 1 },
    { name: '主餐', sort_order: 2 },
    { name: '麵食/飯類', sort_order: 3 },
    { name: '飲料', sort_order: 4 },
    { name: '甜點', sort_order: 5 },
  ],
  products: [
    // 每個分類至少 2-3 個品項，共 12+ 項
    // 含 metadata: { prepTime, allergens, spiceLevel }
    { name: '凱薩沙拉', price: 180, category: '前菜', metadata: { prepTime: 10 } },
    { name: '蒜香麵包', price: 80, category: '前菜' },
    { name: '碳烤牛排', price: 580, category: '主餐', metadata: { prepTime: 25 } },
    { name: '香煎鮭魚', price: 420, category: '主餐' },
    { name: '義大利麵', price: 280, category: '麵食/飯類' },
    { name: '燉飯', price: 320, category: '麵食/飯類' },
    { name: '紅茶', price: 60, category: '飲料' },
    { name: '美式咖啡', price: 120, category: '飲料' },
    { name: '果汁', price: 100, category: '飲料' },
    { name: '提拉米蘇', price: 160, category: '甜點' },
    { name: '巧克力蛋糕', price: 140, category: '甜點' },
    { name: '冰淇淋', price: 100, category: '甜點' },
  ],
  settings: {
    enableTableManagement: true,
    enableDineInTakeout: true,
    enableKitchenPrint: true,
    taxRate: 0.05,
    currency: 'TWD',
  }
};
```

#### `retail.ts` (零售)
- 分類：服飾、配件、鞋類、生活用品、食品
- 商品含 metadata: { sku, barcode, variants: [{size, color, stock}] }
- 至少 12 個商品
- settings: { enableBarcode: true, enableVariants: true, lowStockAlert: true }

#### `medical.ts` (醫療)
- 分類：掛號費、診療項目、藥品、檢驗、耗材
- 商品含 metadata: { dosage, unit, requiresPrescription, expiryTracking }
- 至少 12 個項目
- settings: { enableAppointment: true, enablePrescription: true, enableExpiryTracking: true }

#### `service.ts` (服務業)
- 分類：基礎服務、進階服務、加值服務、商品、套票
- 商品含 metadata: { duration_minutes, technician_required, is_package }
- 至少 12 個項目
- settings: { enableBooking: true, enableTechnician: true, enableStoredValue: true }

### 2. 一鍵生成 Onboarding (`src/app/onboarding/page.tsx`)

三步驟流程：

**Step 1: 基本資料**
- 店名
- 聯絡 Email
- 密碼設定

**Step 2: 選擇產業** (四張卡片)
- 🍽️ 餐飲業 — 餐廳、咖啡廳、飲料店
- 🛍️ 零售業 — 服飾、超商、雜貨店
- 🏥 醫療業 — 診所、藥局、獸醫
- 💇 服務業 — 美容美髮、SPA、寵物美容

**Step 3: 確認生成**
- 顯示將建立的內容摘要
- 「一鍵生成我的 POS」按鈕
- 呼叫 `POST /api/tenants/setup`
- Loading 動畫（3 秒）
- 完成後跳轉到 Dashboard

### 3. Setup API (`src/app/api/tenants/setup/route.ts`)

```
POST /api/tenants/setup
Body: { name, email, password, industry }

邏輯：
1. 建立 tenant 記錄
2. 建立 owner user 記錄
3. 根據 industry 載入對應 template
4. 建立所有 categories
5. 建立所有 products（關聯正確的 category_id）
6. 啟用免費功能
7. 寫入 industry_templates 記錄
8. 回傳 { tenant_id, user_id, redirect: '/dashboard' }
```

### 4. 產業專屬 UI 元件

#### 餐飲專屬 (`src/components/pos/restaurant/`)
- `TableSelector.tsx`：桌號選擇（1-20 桌，格子顯示，顏色區分空桌/使用中）
- `DineInToggle.tsx`：內用/外帶切換按鈕
- POS 頁面在餐飲模式下顯示桌號選擇器和內用/外帶

#### 零售專屬 (`src/components/pos/retail/`)
- `BarcodeInput.tsx`：條碼輸入框（模擬掃碼，輸入條碼搜尋商品）
- `DiscountBadge.tsx`：折扣標籤顯示
- POS 頁面在零售模式下顯示條碼輸入和折扣功能

#### 醫療專屬 (`src/components/pos/medical/`)
- `AppointmentQueue.tsx`：候診列表（姓名、預約時間、狀態）
- `DiagnosisNote.tsx`：診療備註輸入（附加在訂單上）
- POS 頁面在醫療模式下顯示候診列和診療備註

#### 服務業專屬 (`src/components/pos/service/`)
- `BookingSlot.tsx`：時段預約選擇器（時間格子）
- `TechnicianSelect.tsx`：技師指派下拉選單
- POS 頁面在服務業模式下顯示預約和技師選擇

### 5. POS 頁面根據產業動態切換

修改 `src/app/(dashboard)/pos/page.tsx`：
- 從 tenant 資料取得 industry 類型
- 根據 industry 渲染對應的專屬元件
- 共用部分（商品網格、購物車、結帳）保持不變

```tsx
// 概念
const industryComponents = {
  restaurant: <RestaurantExtras />,
  retail: <RetailExtras />,
  medical: <MedicalExtras />,
  service: <ServiceExtras />,
};
```

### 6. 模板相關測試

- `template-data.test.ts`：每個模板至少有 5 個分類、10 個商品
- `setup-api.test.ts`：Setup API 建立完整資料
- `industry-switch.test.ts`：不同 industry 顯示正確元件

## 完成後

```bash
npm run build
npx vitest run
bash pipeline/qg-2.sh .
```
