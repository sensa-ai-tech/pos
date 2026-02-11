#!/bin/bash
# QG-0: 基礎建設品質閘門
# 檢查：編譯、資料庫、Seed、API、多租戶隔離

PROJECT_DIR="${1:-.}"
cd "$PROJECT_DIR"

PASS=0
FAIL=0
CHECKS="["

add_check() {
  local name=$1 passed=$2 detail=$3
  [[ $PASS -gt 0 || $FAIL -gt 0 ]] && CHECKS="$CHECKS,"
  CHECKS="$CHECKS{\"name\":\"$name\",\"pass\":$passed,\"detail\":\"$detail\"}"
  if [[ "$passed" == "true" ]]; then ((PASS++)); else ((FAIL++)); fi
}

echo "══════ QG-0: 基礎建設檢查 ══════"

# 1. npm run build
echo "▸ 檢查: npm run build"
if npm run build --no-warnings 2>&1 | tail -5; then
  add_check "build" "true" ""
  echo "  ✓ Build 成功"
else
  add_check "build" "false" "Build failed"
  echo "  ✗ Build 失敗"
fi

# 2. 資料庫 Schema 存在
echo "▸ 檢查: 資料庫 Schema"
if [[ -f "src/db/schema.ts" ]]; then
  # 檢查關鍵表是否定義
  required_tables=("tenants" "users" "products" "orders" "order_items" "payments" "categories" "customers" "tenant_features" "feature_catalog")
  missing=()
  for table in "${required_tables[@]}"; do
    if ! grep -q "$table" src/db/schema.ts 2>/dev/null; then
      missing+=("$table")
    fi
  done
  if [[ ${#missing[@]} -eq 0 ]]; then
    add_check "schema" "true" ""
    echo "  ✓ Schema 完整 (${#required_tables[@]} 表)"
  else
    add_check "schema" "false" "缺少表: ${missing[*]}"
    echo "  ✗ 缺少表: ${missing[*]}"
  fi
else
  add_check "schema" "false" "schema.ts not found"
  echo "  ✗ schema.ts 不存在"
fi

# 3. Migration 執行
echo "▸ 檢查: 資料庫 Migration"
if npx drizzle-kit push 2>&1 | tail -3; then
  add_check "migration" "true" ""
  echo "  ✓ Migration 成功"
else
  # 嘗試替代方式
  if npx drizzle-kit generate 2>&1 && npx drizzle-kit migrate 2>&1; then
    add_check "migration" "true" ""
    echo "  ✓ Migration 成功 (generate+migrate)"
  else
    add_check "migration" "false" "Migration failed"
    echo "  ✗ Migration 失敗"
  fi
fi

# 4. Seed 腳本
echo "▸ 檢查: Seed 腳本"
if [[ -f "src/db/seed.ts" ]] || [[ -f "src/db/seed.js" ]]; then
  if npx tsx src/db/seed.ts 2>&1 || node src/db/seed.js 2>&1; then
    add_check "seed" "true" ""
    echo "  ✓ Seed 成功"
  else
    add_check "seed" "false" "Seed script execution failed"
    echo "  ✗ Seed 執行失敗"
  fi
else
  add_check "seed" "false" "No seed script found"
  echo "  ✗ 找不到 Seed 腳本"
fi

# 5. API Routes 存在
echo "▸ 檢查: API Routes"
required_routes=("tenants" "products" "orders")
found_routes=0
for route in "${required_routes[@]}"; do
  if find src/app/api -name "route.ts" -path "*${route}*" 2>/dev/null | grep -q .; then
    ((found_routes++))
  fi
done
if [[ $found_routes -ge ${#required_routes[@]} ]]; then
  add_check "api_routes" "true" ""
  echo "  ✓ API Routes 完整 (${found_routes}/${#required_routes[@]})"
else
  add_check "api_routes" "false" "只找到 ${found_routes}/${#required_routes[@]} 路由"
  echo "  ✗ API Routes 不完整 (${found_routes}/${#required_routes[@]})"
fi

# 6. 多租戶機制
echo "▸ 檢查: 多租戶隔離"
if grep -rq "tenant" src/lib/ 2>/dev/null || grep -rq "tenant" src/middleware* 2>/dev/null; then
  add_check "multi_tenant" "true" ""
  echo "  ✓ 多租戶機制存在"
else
  add_check "multi_tenant" "false" "No tenant isolation found"
  echo "  ✗ 找不到多租戶隔離機制"
fi

# ── 結果彙總 ──
CHECKS="$CHECKS]"
TOTAL=$((PASS + FAIL))
echo ""
echo "══════ QG-0 結果: ${PASS}/${TOTAL} 通過 ══════"

# 寫入報告
REPORTS_DIR="pipeline/reports"
mkdir -p "$REPORTS_DIR"

OVERALL="FAIL"
[[ $FAIL -eq 0 ]] && OVERALL="PASS"

cat > "$REPORTS_DIR/qg-0-latest.json" <<EOF
{
  "phase": 0,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "passed": $PASS,
  "failed": $FAIL,
  "total": $TOTAL,
  "overall": "$OVERALL",
  "checks": $CHECKS
}
EOF

[[ $FAIL -eq 0 ]]
