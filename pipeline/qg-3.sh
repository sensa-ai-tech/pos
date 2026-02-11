#!/bin/bash
# QG-3: 付費模組解鎖系統品質閘門

PROJECT_DIR="${1:-.}"
cd "$PROJECT_DIR"

PASS=0; FAIL=0; CHECKS="["
add_check() {
  local name=$1 passed=$2 detail=$3
  [[ $PASS -gt 0 || $FAIL -gt 0 ]] && CHECKS="$CHECKS,"
  CHECKS="$CHECKS{\"name\":\"$name\",\"pass\":$passed,\"detail\":\"$detail\"}"
  if [[ "$passed" == "true" ]]; then ((PASS++)); else ((FAIL++)); fi
}

echo "══════ QG-3: 付費模組系統檢查 ══════"

# 1. Build
echo "▸ 檢查: Build"
if npm run build 2>&1 | tail -3; then add_check "build" "true" ""
else add_check "build" "false" "Build failed"; fi

# 2. Feature Gate 核心邏輯
echo "▸ 檢查: Feature Gate 機制"
if find src -name "*.ts" -o -name "*.tsx" 2>/dev/null | xargs grep -l "feature.gate\|featureGate\|hasFeature\|checkFeature\|FeatureGate" 2>/dev/null | grep -q .; then
  add_check "feature_gate_logic" "true" ""
  echo "  ✓ Feature Gate 邏輯存在"
else
  add_check "feature_gate_logic" "false" "No feature gate implementation"
  echo "  ✗ Feature Gate 邏輯不存在"
fi

# 3. 模組目錄定義
echo "▸ 檢查: 模組目錄"
modules=("advanced_inventory\|inventory" "crm\|customer" "multi_store\|multiStore" "employee\|staff" "analytics" "loyalty\|reward" "api_access\|apiAccess")
found_modules=0
for mod in "${modules[@]}"; do
  if grep -rq "$mod" src/db/schema.ts src/db/seed.ts src/lib/feature* 2>/dev/null; then
    ((found_modules++))
  fi
done
if [[ $found_modules -ge 4 ]]; then
  add_check "module_catalog" "true" "${found_modules} modules defined"
  echo "  ✓ ${found_modules} 個模組已定義"
else
  add_check "module_catalog" "false" "Only ${found_modules} modules (need >=4)"
  echo "  ✗ 模組定義不足 (${found_modules})"
fi

# 4. 訂閱管理頁面
echo "▸ 檢查: 訂閱管理頁面"
if find src -name "page.tsx" -path "*subscription*" 2>/dev/null | grep -q . || \
   find src -name "page.tsx" -path "*pricing*" 2>/dev/null | grep -q . || \
   find src -name "page.tsx" -path "*plan*" 2>/dev/null | grep -q .; then
  add_check "subscription_page" "true" ""
  echo "  ✓ 訂閱頁面存在"
else
  add_check "subscription_page" "false" "No subscription page"
  echo "  ✗ 訂閱頁面不存在"
fi

# 5. Upgrade Prompt 元件
echo "▸ 檢查: Upgrade Prompt UI"
if grep -rq "upgrade\|Upgrade\|UpgradePrompt\|paywall\|locked" src/components/ 2>/dev/null; then
  add_check "upgrade_prompt" "true" ""
  echo "  ✓ Upgrade Prompt 元件存在"
else
  add_check "upgrade_prompt" "false" "No upgrade prompt component"
  echo "  ✗ Upgrade Prompt 不存在"
fi

# 6. Feature API endpoint
echo "▸ 檢查: Feature 解鎖 API"
if find src/app/api -name "route.ts" -path "*feature*" 2>/dev/null | grep -q . || \
   find src/app/api -name "route.ts" -path "*subscription*" 2>/dev/null | grep -q .; then
  add_check "feature_api" "true" ""
  echo "  ✓ Feature API 存在"
else
  add_check "feature_api" "false" "No feature/subscription API"
  echo "  ✗ Feature API 不存在"
fi

# 7. Tests
echo "▸ 檢查: 測試"
if npx vitest run 2>&1 | tail -5; then add_check "tests" "true" ""
else add_check "tests" "false" "Tests failed"; fi

# ── 結果 ──
CHECKS="$CHECKS]"
TOTAL=$((PASS + FAIL))
echo "══════ QG-3 結果: ${PASS}/${TOTAL} 通過 ══════"

REPORTS_DIR="pipeline/reports"; mkdir -p "$REPORTS_DIR"
OVERALL="FAIL"; [[ $FAIL -eq 0 ]] && OVERALL="PASS"
cat > "$REPORTS_DIR/qg-3-latest.json" <<EOF
{"phase":3,"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","passed":$PASS,"failed":$FAIL,"total":$TOTAL,"overall":"$OVERALL","checks":$CHECKS}
EOF
[[ $FAIL -eq 0 ]]
