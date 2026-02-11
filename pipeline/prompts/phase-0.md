# Phase 0: 基礎建設

## 你的任務

在 `~/onekey-pos` 目錄建立一個 Next.js 14 專案，包含完整的資料庫 Schema 和基礎 API。
這是一個「一鍵生成 POS 系統」平台的 MVP。

## 嚴格要求

1. 使用 Next.js 14 App Router
2. 使用 SQLite + better-sqlite3 + Drizzle ORM（零外部依賴）
3. 使用 Tailwind CSS
4. TypeScript strict mode

## 步驟

### Step 1: 初始化專案

```bash
cd ~
npx create-next-app@14 onekey-pos --typescript --tailwind --eslint --app --src-dir --no-import-alias
cd onekey-pos
npm install better-sqlite3 drizzle-orm
npm install -D drizzle-kit @types/better-sqlite3 tsx vitest
```

### Step 2: Drizzle 配置

建立 `drizzle.config.ts`：
- driver: better-sqlite3
- schema: ./src/db/schema.ts
- dbCredentials: { url: './data/pos.db' }

### Step 3: 資料庫 Schema (`src/db/schema.ts`)

定義以下表，所有表都必須有 `tenant_id` 欄位（tenants 表除外）用於多租戶隔離：

```
tenants:
  id (text, PK, uuid)
  name (text)
  industry (text: 'restaurant' | 'retail' | 'medical' | 'service')
  plan (text: 'free' | 'basic' | 'pro' | 'enterprise', default 'free')
  created_at (integer, unix timestamp)

users:
  id (text, PK, uuid)
  tenant_id (text, FK → tenants)
  email (text, unique)
  password_hash (text)
  name (text)
  role (text: 'owner' | 'manager' | 'cashier')
  created_at (integer)

categories:
  id (text, PK, uuid)
  tenant_id (text, FK)
  name (text)
  sort_order (integer, default 0)

products:
  id (text, PK, uuid)
  tenant_id (text, FK)
  category_id (text, FK → categories, nullable)
  name (text)
  description (text, nullable)
  price (real)
  cost (real, nullable)
  sku (text, nullable)
  barcode (text, nullable)
  image_url (text, nullable)
  is_active (integer, default 1)
  stock_quantity (integer, default 0)
  low_stock_threshold (integer, default 5)
  metadata (text, nullable, JSON string for industry-specific fields)
  created_at (integer)

orders:
  id (text, PK, uuid)
  tenant_id (text, FK)
  order_number (text)
  customer_id (text, FK → customers, nullable)
  status (text: 'pending' | 'completed' | 'cancelled' | 'refunded')
  subtotal (real)
  tax (real, default 0)
  discount (real, default 0)
  total (real)
  payment_method (text: 'cash' | 'card' | 'transfer' | 'other')
  notes (text, nullable)
  metadata (text, nullable, JSON for industry-specific: table_number, dine_in, etc.)
  created_at (integer)

order_items:
  id (text, PK, uuid)
  order_id (text, FK → orders)
  product_id (text, FK → products)
  product_name (text) -- snapshot at time of order
  quantity (integer)
  unit_price (real)
  subtotal (real)
  notes (text, nullable)

payments:
  id (text, PK, uuid)
  tenant_id (text, FK)
  order_id (text, FK → orders)
  amount (real)
  method (text)
  status (text: 'completed' | 'pending' | 'failed')
  created_at (integer)

customers:
  id (text, PK, uuid)
  tenant_id (text, FK)
  name (text)
  phone (text, nullable)
  email (text, nullable)
  notes (text, nullable)
  total_spent (real, default 0)
  visit_count (integer, default 0)
  created_at (integer)

feature_catalog:
  id (text, PK)
  name (text)
  description (text)
  category (text)
  price_monthly (real)
  is_free (integer, default 0)

tenant_features:
  id (text, PK, uuid)
  tenant_id (text, FK)
  feature_id (text, FK → feature_catalog)
  is_active (integer, default 1)
  activated_at (integer)
  expires_at (integer, nullable)

industry_templates:
  id (text, PK)
  industry (text)
  template_data (text, JSON - contains categories and products)
  description (text)
```

### Step 4: DB 連線 (`src/db/index.ts`)

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { mkdirSync } from 'fs';

mkdirSync('./data', { recursive: true });
const sqlite = new Database('./data/pos.db');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
```

### Step 5: Seed 腳本 (`src/db/seed.ts`)

建立 seed 腳本，填入：
- 2 個測試租戶（tenant-a: 餐飲, tenant-b: 零售）
- 每個租戶各 1 個 owner 用戶
- Feature catalog（8 個模組：advanced_inventory, crm, multi_store, employee_mgmt, analytics, online_ordering, loyalty, api_access）
- 免費功能預設解鎖

### Step 6: API Routes

建立以下 API Routes（所有需要 tenant 隔離的路由，從 header `x-tenant-id` 取得 tenant context）：

- `POST/GET /api/tenants` - 建立/列表租戶
- `GET/POST /api/products` - 商品 CRUD
- `GET/PUT/DELETE /api/products/[id]` - 單一商品操作
- `GET/POST /api/orders` - 訂單
- `GET /api/orders/[id]` - 訂單詳情

每個 API 必須：
- 驗證 `x-tenant-id` header
- 只回傳該 tenant 的資料
- 回傳正確的 HTTP status code（200, 201, 400, 404）
- 使用 Zod 驗證 request body

### Step 7: 多租戶中間件

建立 `src/lib/tenant-context.ts`，提供：
- `getTenantId(request)` - 從 header 取得 tenant ID
- `validateTenant(tenantId)` - 驗證租戶存在

### Step 8: 基礎測試

建立 `vitest.config.ts` 和至少 3 個測試：
- Schema import 測試
- Seed 後資料驗證
- 多租戶隔離驗證

## 完成後

執行以下驗證：
```bash
npm run build
npx tsx src/db/seed.ts
npx vitest run
```

確保全部通過後，執行品質閘門：
```bash
bash pipeline/qg-0.sh .
```
