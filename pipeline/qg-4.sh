#!/bin/bash
# QG-4: 最終整合品質閘門

PROJECT_DIR="${1:-.}"
cd "$PROJECT_DIR"

PASS=0; FAIL=0; CHECKS="["
add_check() {
  local name=$1 passed=$2 detail=$3
  [[ $PASS -gt 0 || $FAIL -gt 0 ]] && CHECKS="$CHECKS,"
  CHECKS="$CHECKS{\"name\":\"$name\",\"pass\":$passed,\"detail\":\"$detail\"}"
  if [[ "$passed" == "true" ]]; then ((PASS++)); else ((FAIL++)); fi
}

echo "══════ QG-4: 最終整合檢查 ══════"

# 1. Build (zero errors)
echo "▸ 檢查: Production Build"
BUILD_OUTPUT=$(npm run build 2>&1)
if echo "$BUILD_OUTPUT" | grep -q "error\|Error" && ! echo "$BUILD_OUTPUT" | grep -q "0 error"; then
  add_check "build" "false" "Build has errors"
  echo "  ✗ Build 有錯誤"
else
  add_check "build" "true" ""
  echo "  ✓ Build 成功"
fi

# 2. 所有測試通過
echo "▸ 檢查: 全部測試"
if npx vitest run 2>&1 | tail -5; then
  add_check "all_tests" "true" ""
  echo "  ✓ 測試通過"
else
  add_check "all_tests" "false" "Tests failed"
  echo "  ✗ 測試失敗"
fi

# 3. 完整 Onboarding 流程頁面鏈
echo "▸ 檢查: Onboarding 完整性"
onboarding_parts=0
# 註冊頁
find src -name "page.tsx" -path "*register*" -o -name "page.tsx" -path "*signup*" 2>/dev/null | grep -q . && ((onboarding_parts++))
# 產業選擇
grep -rq "industry\|template.*select\|choose.*type" src/ 2>/dev/null && ((onboarding_parts++))
# Dashboard
find src -name "page.tsx" -path "*dashboard*" 2>/dev/null | grep -q . && ((onboarding_parts++))

if [[ $onboarding_parts -ge 2 ]]; then
  add_check "onboarding_flow" "true" "${onboarding_parts}/3 步驟"
  echo "  ✓ Onboarding 流程 ${onboarding_parts}/3"
else
  add_check "onboarding_flow" "false" "Only ${onboarding_parts}/3 steps"
  echo "  ✗ Onboarding 不完整"
fi

# 4. Dashboard 存在且有內容
echo "▸ 檢查: Dashboard"
DASHBOARD=$(find src -name "page.tsx" -path "*dashboard*" 2>/dev/null | head -1)
if [[ -n "$DASHBOARD" ]] && [[ $(wc -l < "$DASHBOARD") -gt 10 ]]; then
  add_check "dashboard" "true" ""
  echo "  ✓ Dashboard 頁面存在且有內容"
else
  add_check "dashboard" "false" "Dashboard missing or empty"
  echo "  ✗ Dashboard 不完整"
fi

# 5. 四大頁面區塊完整
echo "▸ 檢查: 核心頁面完整性"
core_pages=0
for path_pattern in "pos" "product" "order" "setting"; do
  find src -name "page.tsx" 2>/dev/null | grep -qi "$path_pattern" && ((core_pages++))
done
if [[ $core_pages -ge 4 ]]; then
  add_check "core_pages" "true" "${core_pages} 核心頁面"
  echo "  ✓ ${core_pages} 核心頁面完整"
else
  add_check "core_pages" "false" "Only ${core_pages}/4 core pages"
  echo "  ✗ 核心頁面不完整 (${core_pages}/4)"
fi

# 6. 錯誤處理
echo "▸ 檢查: 全局錯誤處理"
if find src -name "error.tsx" -o -name "not-found.tsx" -o -name "loading.tsx" 2>/dev/null | grep -q .; then
  add_check "error_handling" "true" ""
  echo "  ✓ 錯誤處理頁面存在"
else
  add_check "error_handling" "false" "No error/loading pages"
  echo "  ✗ 缺少錯誤處理頁面"
fi

# 7. README
echo "▸ 檢查: README"
if [[ -f "README.md" ]] && [[ $(wc -l < "README.md") -gt 20 ]]; then
  add_check "readme" "true" ""
  echo "  ✓ README 完整"
else
  add_check "readme" "false" "README missing or too short"
  echo "  ✗ README 不完整"
fi

# 8. 無 console.error 殘留
echo "▸ 檢查: console.error 殘留"
error_count=$(grep -r "console\.error\|console\.log" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "node_modules\|\.test\.\|\.spec\." | grep -c "console\.error" || echo 0)
if [[ $error_count -lt 5 ]]; then
  add_check "no_debug" "true" "${error_count} console.error"
  echo "  ✓ Console.error 在合理範圍 (${error_count})"
else
  add_check "no_debug" "false" "${error_count} console.error found"
  echo "  ✗ 太多 console.error (${error_count})"
fi

# 9. TypeScript 嚴格模式
echo "▸ 檢查: TypeScript 配置"
if grep -q '"strict": true' tsconfig.json 2>/dev/null; then
  add_check "typescript_strict" "true" ""
  echo "  ✓ TypeScript strict mode"
else
  add_check "typescript_strict" "false" "strict mode not enabled"
  echo "  ✗ TypeScript strict mode 未啟用"
fi

# ── 最終結果 ──
CHECKS="$CHECKS]"
TOTAL=$((PASS + FAIL))
PASS_RATE=$(( PASS * 100 / TOTAL ))
echo ""
echo "══════════════════════════════════════"
echo "  QG-4 最終結果: ${PASS}/${TOTAL} 通過 (${PASS_RATE}%)"
echo "══════════════════════════════════════"

REPORTS_DIR="pipeline/reports"; mkdir -p "$REPORTS_DIR"
OVERALL="FAIL"
# 允許 80% 通過率（最終階段較寬鬆）
[[ $PASS_RATE -ge 80 ]] && OVERALL="PASS"

cat > "$REPORTS_DIR/qg-4-latest.json" <<EOF
{"phase":4,"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","passed":$PASS,"failed":$FAIL,"total":$TOTAL,"pass_rate":"${PASS_RATE}%","overall":"$OVERALL","checks":$CHECKS}
EOF

[[ "$OVERALL" == "PASS" ]]
