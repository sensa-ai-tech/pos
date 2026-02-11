#!/bin/bash
# QG-1: 核心 POS 功能品質閘門

PROJECT_DIR="${1:-.}"
cd "$PROJECT_DIR"

PASS=0; FAIL=0; CHECKS="["
add_check() {
  local name=$1 passed=$2 detail=$3
  [[ $PASS -gt 0 || $FAIL -gt 0 ]] && CHECKS="$CHECKS,"
  CHECKS="$CHECKS{\"name\":\"$name\",\"pass\":$passed,\"detail\":\"$detail\"}"
  if [[ "$passed" == "true" ]]; then ((PASS++)); else ((FAIL++)); fi
}

echo "══════ QG-1: 核心 POS 功能檢查 ══════"

# 1. Build
echo "▸ 檢查: npm run build"
if npm run build 2>&1 | tail -5; then
  add_check "build" "true" ""
else
  add_check "build" "false" "Build failed"
fi

# 2. 商品管理頁面存在
echo "▸ 檢查: 商品管理頁面"
if [[ -f "src/app/(dashboard)/products/page.tsx" ]] || find src -name "page.tsx" -path "*product*" 2>/dev/null | grep -q .; then
  add_check "products_page" "true" ""
  echo "  ✓ 商品管理頁面存在"
else
  add_check "products_page" "false" "Products page not found"
  echo "  ✗ 商品管理頁面不存在"
fi

# 3. POS 收銀介面存在
echo "▸ 檢查: POS 收銀介面"
if [[ -f "src/app/(dashboard)/pos/page.tsx" ]] || find src -name "page.tsx" -path "*pos*" 2>/dev/null | grep -q .; then
  add_check "pos_page" "true" ""
  echo "  ✓ POS 頁面存在"
else
  add_check "pos_page" "false" "POS page not found"
  echo "  ✗ POS 頁面不存在"
fi

# 4. 訂單頁面存在
echo "▸ 檢查: 訂單管理頁面"
if find src -name "page.tsx" -path "*order*" 2>/dev/null | grep -q .; then
  add_check "orders_page" "true" ""
  echo "  ✓ 訂單頁面存在"
else
  add_check "orders_page" "false" "Orders page not found"
  echo "  ✗ 訂單頁面不存在"
fi

# 5. 購物車/結帳邏輯
echo "▸ 檢查: 購物車狀態管理"
if grep -rq "cart\|Cart\|addItem\|checkout" src/stores/ src/lib/ src/components/ 2>/dev/null; then
  add_check "cart_logic" "true" ""
  echo "  ✓ 購物車邏輯存在"
else
  add_check "cart_logic" "false" "No cart/checkout logic found"
  echo "  ✗ 找不到購物車邏輯"
fi

# 6. 庫存扣減邏輯
echo "▸ 檢查: 庫存扣減"
if grep -rq "inventory\|stock\|quantity" src/app/api/orders/ src/lib/ 2>/dev/null; then
  add_check "inventory_deduct" "true" ""
  echo "  ✓ 庫存扣減邏輯存在"
else
  add_check "inventory_deduct" "false" "No inventory deduction logic"
  echo "  ✗ 找不到庫存扣減邏輯"
fi

# 7. 訂單 API 可建立訂單
echo "▸ 檢查: 訂單建立 API"
if find src/app/api -name "route.ts" -path "*order*" 2>/dev/null | grep -q .; then
  # 檢查是否有 POST handler
  if grep -rq "POST\|post" src/app/api/orders/ 2>/dev/null; then
    add_check "order_api" "true" ""
    echo "  ✓ 訂單 POST API 存在"
  else
    add_check "order_api" "false" "No POST handler for orders"
    echo "  ✗ 訂單 API 缺少 POST handler"
  fi
else
  add_check "order_api" "false" "Orders API route not found"
  echo "  ✗ 訂單 API 不存在"
fi

# 8. 單元測試
echo "▸ 檢查: 單元測試"
if [[ -f "vitest.config.ts" ]] || [[ -f "vitest.config.js" ]]; then
  if npx vitest run --reporter=verbose 2>&1 | tail -10; then
    add_check "unit_tests" "true" ""
    echo "  ✓ 單元測試通過"
  else
    add_check "unit_tests" "false" "Some tests failed"
    echo "  ✗ 部分測試失敗"
  fi
else
  add_check "unit_tests" "false" "No vitest config found"
  echo "  ✗ 找不到 vitest 配置"
fi

# ── 結果 ──
CHECKS="$CHECKS]"
TOTAL=$((PASS + FAIL))
echo ""
echo "══════ QG-1 結果: ${PASS}/${TOTAL} 通過 ══════"

REPORTS_DIR="pipeline/reports"
mkdir -p "$REPORTS_DIR"
OVERALL="FAIL"; [[ $FAIL -eq 0 ]] && OVERALL="PASS"

cat > "$REPORTS_DIR/qg-1-latest.json" <<EOF
{"phase":1,"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","passed":$PASS,"failed":$FAIL,"total":$TOTAL,"overall":"$OVERALL","checks":$CHECKS}
EOF

[[ $FAIL -eq 0 ]]
