# Phase 4: 整合測試與最終打磨

## 前提
Phase 0-3 已完成。核心 POS、四產業模板、付費模組系統都已建置。

## 你的任務
端對端整合、UI 打磨、補齊缺失、撰寫最終文件。

## 實作項目

### 1. Dashboard 首頁 (`src/app/(dashboard)/page.tsx`)

設計一個資訊豐富的首頁：

**上方區塊（4 張統計卡片）：**
- 今日營收（金額 + 較昨日增減 %）
- 今日訂單數
- 平均客單價
- 庫存警示數（低庫存商品數量）

**中間區塊：**
- 左：最近 7 天營收趨勢（簡易長條圖，用 div 模擬即可）
- 右：今日熱門商品 Top 5

**下方區塊：**
- 最近 10 筆訂單快速列表
- 快捷操作按鈕（開始收銀、新增商品、查看報表）

呼叫 `GET /api/reports/dashboard` 取得資料。

### 2. Dashboard API (`src/app/api/reports/dashboard/route.ts`)

回傳：
```json
{
  "today": {
    "revenue": 15800,
    "orders": 23,
    "avgOrderValue": 687,
    "lowStockCount": 3,
    "revenueChange": 12.5
  },
  "weeklyRevenue": [
    { "date": "02/02", "amount": 12000 },
    ...
  ],
  "topProducts": [
    { "name": "美式咖啡", "quantity": 45, "revenue": 5400 },
    ...
  ],
  "recentOrders": [...]
}
```

### 3. 全局錯誤處理

建立以下 Next.js 特殊頁面：
- `src/app/error.tsx` — 全局錯誤邊界
- `src/app/not-found.tsx` — 404 頁面
- `src/app/(dashboard)/error.tsx` — Dashboard 區域錯誤
- `src/app/(dashboard)/loading.tsx` — Dashboard 載入中骨架屏

### 4. 完整 Onboarding → POS 流程串接

確認以下完整流程可走完：
1. 訪問首頁 → 跳轉到 Onboarding（無登入狀態時）
2. 填寫基本資料 → 選產業 → 一鍵生成
3. 自動登入 → 進入 Dashboard
4. Dashboard → 點「開始收銀」→ POS 頁面
5. 選商品 → 結帳 → 訂單建立
6. 返回 Dashboard → 數據更新

在串接過程中，用簡易的 cookie/localStorage 模擬登入狀態：
- Onboarding 完成後寫入 `tenant_id` 和 `user_id` 到 cookie
- Dashboard layout 讀取 cookie 判斷登入
- 未登入跳轉 Onboarding

### 5. 設定頁面 (`src/app/(dashboard)/settings/page.tsx`)

- 店舖資訊編輯（名稱、地址、電話）
- 稅率設定
- 收據格式預覽
- 帳號管理（密碼修改）

### 6. UI 打磨

- 確認所有頁面有適當的 Tailwind 樣式
- 確認 shadcn/ui 元件使用一致
- 表格有適當的空狀態（Empty State）
- 按鈕有 loading 狀態
- 表單有驗證錯誤提示
- Toast 通知用於成功/失敗操作
- 響應式：最少支援 tablet (768px+)

### 7. README.md

撰寫完整的 README：

```markdown
# OneKey POS — 一鍵生成 POS 系統

## 簡介
一句話描述

## 功能特色
- 一鍵生成：選擇產業即可立即使用
- 四大產業模板：餐飲、零售、醫療、服務業
- 模組化收費：基礎免費，進階功能按需解鎖
- 多租戶架構：每個商家資料完全隔離

## 技術棧
列出所有使用的技術

## 快速啟動
npm install → seed → dev 的步驟

## 專案結構
目錄說明

## API 文件
列出所有 API endpoint

## 產業模板
四個模板的說明

## 付費模組
模組列表與說明

## 開發筆記
特殊設計決策說明
```

### 8. 最終測試

新增/更新測試以涵蓋：
- `dashboard.test.ts`：Dashboard API 回傳正確格式
- `onboarding-flow.test.ts`：完整 setup 流程
- `feature-integration.test.ts`：功能解鎖後頁面正確顯示

### 9. 程式碼清理

- 移除所有 `console.log`（測試用的 console.error 可保留）
- 確認所有 import 使用正確
- 確認沒有未使用的變數/函式
- 確認 TypeScript 無型別錯誤

## 完成後

執行完整驗證：
```bash
# 清理並重新建置
rm -f data/pos.db
npm run build
npx tsx src/db/seed.ts
npx vitest run

# 最終品質閘門
bash pipeline/qg-4.sh .

# 啟動確認
npm run dev &
sleep 5
curl -s http://localhost:3000 | head -20
kill %1
```

若全部通過，這個 MVP 實驗就算成功完成！
