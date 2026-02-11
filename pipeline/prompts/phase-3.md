# Phase 3: 付費模組解鎖系統

## 前提
Phase 0-2 已完成，四大產業模板和核心 POS 可運行。

## 你的任務
實作功能模組的付費解鎖（Feature Gating）機制。

## 實作項目

### 1. Feature Gate 核心 (`src/lib/feature-gate.ts`)

```typescript
// 模組 ID 列舉
export const FEATURES = {
  ADVANCED_INVENTORY: 'advanced_inventory',
  CRM: 'crm',
  MULTI_STORE: 'multi_store',
  EMPLOYEE_MGMT: 'employee_mgmt',
  ANALYTICS: 'analytics',
  ONLINE_ORDERING: 'online_ordering',
  LOYALTY: 'loyalty',
  API_ACCESS: 'api_access',
} as const;

// 檢查租戶是否有權限使用該功能
export async function hasFeature(tenantId: string, featureId: string): Promise<boolean>

// 取得租戶所有已啟用功能
export async function getTenantFeatures(tenantId: string): Promise<string[]>

// 啟用功能
export async function activateFeature(tenantId: string, featureId: string): Promise<void>

// 停用功能
export async function deactivateFeature(tenantId: string, featureId: string): Promise<void>
```

### 2. Feature Gate Middleware (`src/lib/with-feature.ts`)

API Route 用的 Higher-Order Function：

```typescript
export function withFeature(featureId: string, handler: NextHandler) {
  return async (request: NextRequest, context: any) => {
    const tenantId = getTenantId(request);
    const allowed = await hasFeature(tenantId, featureId);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Feature not available', feature: featureId, upgrade: true },
        { status: 403 }
      );
    }
    return handler(request, context);
  };
}
```

### 3. Upgrade Prompt 元件 (`src/components/upgrade-prompt.tsx`)

美觀的提示元件，用於未解鎖功能的頁面：

```tsx
interface UpgradePromptProps {
  featureId: string;
  featureName: string;
  description: string;
  price: number;
}

// 顯示：
// - 功能名稱與說明
// - 月費價格
// - 「升級解鎖」按鈕 → 跳轉到訂閱頁
// - 「了解更多」連結
// 設計要美觀，有漸層背景和圖示
```

### 4. FeatureGate 元件 (`src/components/feature-gate.tsx`)

包裹子元件，根據功能狀態決定顯示內容：

```tsx
interface FeatureGateProps {
  featureId: string;
  featureName: string;
  description: string;
  price: number;
  children: React.ReactNode;
}

export function FeatureGate({ featureId, children, ...upgradeProps }: FeatureGateProps) {
  const { hasFeature, loading } = useFeatureCheck(featureId);
  
  if (loading) return <Skeleton />;
  if (!hasFeature) return <UpgradePrompt featureId={featureId} {...upgradeProps} />;
  return <>{children}</>;
}
```

### 5. 受保護的頁面

將以下頁面包裹在 FeatureGate 中：

- `/dashboard/customers` → 需要 CRM 模組
- `/dashboard/employees` → 需要 EMPLOYEE_MGMT 模組
- `/dashboard/analytics` → 需要 ANALYTICS 模組

建立這些頁面的基本 UI（即使簡單也沒關係），但未解鎖時顯示 UpgradePrompt。

#### 客戶管理頁面（CRM 模組）
- 客戶列表
- 新增客戶
- 消費紀錄

#### 員工管理頁面（Employee 模組）
- 員工列表
- 角色設定

#### 數據分析頁面（Analytics 模組）
- 營收趨勢圖（折線圖）
- 熱門商品排行
- 付款方式分佈（圓餅圖）

### 6. 訂閱管理頁面 (`src/app/(dashboard)/subscription/page.tsx`)

顯示：
- 當前方案（Free / Basic / Pro）
- 已啟用的模組（綠色勾勾）
- 可升級的模組（價格 + 解鎖按鈕）

模組價格表（寫死即可，不需要真實金流）：
```
advanced_inventory: NT$299/月
crm: NT$499/月
multi_store: NT$799/月
employee_mgmt: NT$299/月
analytics: NT$399/月
online_ordering: NT$599/月
loyalty: NT$499/月
api_access: NT$999/月
```

### 7. 模擬解鎖 API (`src/app/api/features/`)

- `GET /api/features` → 列出所有模組及狀態
- `POST /api/features/activate` → 啟用模組 `{ feature_id }`
- `POST /api/features/deactivate` → 停用模組

不需要真實支付，POST activate 直接寫入 tenant_features 即可。
但要模擬流程：點擊「升級」→ 確認 Dialog → 呼叫 API → 成功通知 → 頁面刷新顯示功能

### 8. Feature Gate 測試

- `feature-gate.test.ts`：hasFeature 正確判斷
- `feature-middleware.test.ts`：未授權回 403
- `activate.test.ts`：啟用/停用流程

## 完成後

```bash
npm run build
npx vitest run
bash pipeline/qg-3.sh .
```
