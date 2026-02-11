#!/bin/bash
# QG-2: 產業模板品質閘門

PROJECT_DIR="${1:-.}"
cd "$PROJECT_DIR"

PASS=0; FAIL=0; CHECKS="["
add_check() {
  local name=$1 passed=$2 detail=$3
  [[ $PASS -gt 0 || $FAIL -gt 0 ]] && CHECKS="$CHECKS,"
  CHECKS="$CHECKS{\"name\":\"$name\",\"pass\":$passed,\"detail\":\"$detail\"}"
  if [[ "$passed" == "true" ]]; then ((PASS++)); else ((FAIL++)); fi
}

echo "══════ QG-2: 產業模板檢查 ══════"

# 1. Build
echo "▸ 檢查: Build"
if npm run build 2>&1 | tail -3; then
  add_check "build" "true" ""
else
  add_check "build" "false" "Build failed"
fi

# 2. Onboarding 頁面（一鍵生成入口）
echo "▸ 檢查: Onboarding 流程"
if find src -name "page.tsx" -path "*onboarding*" 2>/dev/null | grep -q . || \
   find src -name "page.tsx" -path "*setup*" 2>/dev/null | grep -q .; then
  add_check "onboarding" "true" ""
  echo "  ✓ Onboarding 頁面存在"
else
  add_check "onboarding" "false" "No onboarding page"
  echo "  ✗ Onboarding 頁面不存在"
fi

# 3-6. 四大模板檔案
templates=("restaurant:餐飲" "retail:零售" "medical:醫療" "service:服務業")
for entry in "${templates[@]}"; do
  IFS=':' read -r key label <<< "$entry"
  echo "▸ 檢查: ${label}模板"
  if find src -name "*.ts" -o -name "*.tsx" 2>/dev/null | xargs grep -l "$key" 2>/dev/null | grep -qi "template\|seed\|data"; then
    add_check "template_${key}" "true" ""
    echo "  ✓ ${label}模板資料存在"
  else
    add_check "template_${key}" "false" "${label} template data not found"
    echo "  ✗ ${label}模板資料不存在"
  fi
done

# 7. 模板至少各有 5 個預設項目
echo "▸ 檢查: 模板預設項目數量"
template_dir="src/db/templates"
if [[ -d "$template_dir" ]]; then
  min_items=999
  for f in "$template_dir"/*.ts; do
    if [[ -f "$f" ]]; then
      count=$(grep -c "name:" "$f" 2>/dev/null || echo 0)
      [[ $count -lt $min_items ]] && min_items=$count
    fi
  done
  if [[ $min_items -ge 5 ]]; then
    add_check "template_items" "true" "最少 ${min_items} 項"
    echo "  ✓ 每個模板至少 ${min_items} 項"
  else
    add_check "template_items" "false" "最少只有 ${min_items} 項 (需要 >=5)"
    echo "  ✗ 模板項目不足 (最少 ${min_items})"
  fi
else
  # 也可能是寫在 seed.ts 裡面
  if grep -c "name:" src/db/seed.ts 2>/dev/null | head -1; then
    add_check "template_items" "true" "在 seed.ts 中"
  else
    add_check "template_items" "false" "Template directory not found"
  fi
fi

# 8. 產業專屬功能元件
echo "▸ 檢查: 產業專屬元件"
specialty_found=0
# 餐飲：桌號 or 菜單
grep -rq "table.*management\|tableNumber\|dineIn\|takeout\|桌號" src/ 2>/dev/null && ((specialty_found++))
# 零售：條碼 or 庫存警示
grep -rq "barcode\|lowStock\|variant\|discount" src/ 2>/dev/null && ((specialty_found++))
# 醫療：掛號 or 診療
grep -rq "appointment\|diagnosis\|prescription\|掛號\|診療" src/ 2>/dev/null && ((specialty_found++))
# 服務：預約 or 技師
grep -rq "booking\|technician\|schedule\|storedValue\|預約" src/ 2>/dev/null && ((specialty_found++))

if [[ $specialty_found -ge 3 ]]; then
  add_check "specialty_features" "true" "${specialty_found}/4 產業特殊功能"
  echo "  ✓ ${specialty_found}/4 產業有專屬功能"
else
  add_check "specialty_features" "false" "只有 ${specialty_found}/4"
  echo "  ✗ 產業專屬功能不足 (${specialty_found}/4)"
fi

# 9. Vitest
echo "▸ 檢查: 測試"
if npx vitest run 2>&1 | tail -5; then
  add_check "tests" "true" ""
else
  add_check "tests" "false" "Tests failed"
fi

# ── 結果 ──
CHECKS="$CHECKS]"
TOTAL=$((PASS + FAIL))
echo "══════ QG-2 結果: ${PASS}/${TOTAL} 通過 ══════"

REPORTS_DIR="pipeline/reports"; mkdir -p "$REPORTS_DIR"
OVERALL="FAIL"; [[ $FAIL -eq 0 ]] && OVERALL="PASS"
cat > "$REPORTS_DIR/qg-2-latest.json" <<EOF
{"phase":2,"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","passed":$PASS,"failed":$FAIL,"total":$TOTAL,"overall":"$OVERALL","checks":$CHECKS}
EOF
[[ $FAIL -eq 0 ]]
