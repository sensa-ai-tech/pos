#!/bin/bash
# ============================================================
# OneKey POS — 全自動建置流水線主控腳本
# 設計用於 Claude Code CLI 自動執行
# ============================================================

set -euo pipefail

# ── 配置 ──────────────────────────────────────────────────
PROJECT_NAME="onekey-pos"
PROJECT_DIR="$HOME/$PROJECT_NAME"
PIPELINE_DIR="$PROJECT_DIR/pipeline"
REPORTS_DIR="$PIPELINE_DIR/reports"
MAX_RETRIES=3
TOTAL_PHASES=5  # Phase 0-4

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ── 工具函式 ──────────────────────────────────────────────

timestamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

log() { echo -e "${BLUE}[$(timestamp)]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# 產出 JSON 報告
write_report() {
  local phase=$1
  local attempt=$2
  local overall=$3
  local checks_json=$4
  local report_file="$REPORTS_DIR/phase-${phase}-attempt-${attempt}.json"

  cat > "$report_file" <<EOF
{
  "phase": $phase,
  "attempt": $attempt,
  "timestamp": "$(timestamp)",
  "overall": "$overall",
  "checks": $checks_json
}
EOF
  log "報告已寫入: $report_file"
}

# ── 品質閘門執行器 ────────────────────────────────────────

run_quality_gate() {
  local phase=$1
  local qg_script="$PIPELINE_DIR/qg-${phase}.sh"

  if [[ ! -f "$qg_script" ]]; then
    log_warn "品質閘門腳本不存在: $qg_script，跳過檢查"
    return 0
  fi

  chmod +x "$qg_script"
  log "執行品質閘門 QG-${phase}..."

  if bash "$qg_script" "$PROJECT_DIR"; then
    log_pass "QG-${phase} 通過"
    return 0
  else
    log_fail "QG-${phase} 未通過"
    return 1
  fi
}

# ── Phase 執行器 (呼叫 Claude Code) ──────────────────────

execute_phase_with_claude() {
  local phase=$1
  local attempt=$2
  local prompt_file="$PIPELINE_DIR/prompts/phase-${phase}.md"

  if [[ ! -f "$prompt_file" ]]; then
    log_fail "Phase ${phase} 提示檔不存在: $prompt_file"
    return 1
  fi

  local prompt
  prompt=$(cat "$prompt_file")

  # 如果是重試，附加錯誤報告
  if [[ $attempt -gt 1 ]]; then
    local prev_report="$REPORTS_DIR/phase-${phase}-attempt-$((attempt-1)).json"
    if [[ -f "$prev_report" ]]; then
      prompt="$prompt

---
## ⚠️ 重試 Attempt ${attempt}/${MAX_RETRIES}

上次嘗試的品質閘門報告：
\`\`\`json
$(cat "$prev_report")
\`\`\`

請根據上述失敗項目進行修正。如果是 Attempt 3，請考慮完全重寫有問題的模組。"
    fi
  fi

  log "執行 Phase ${phase} (Attempt ${attempt})..."
  log "呼叫 Claude Code..."

  # 使用 Claude Code CLI 執行
  # --print 模式讓 Claude 直接輸出結果
  # --dangerously-skip-permissions 跳過確認（全自動）
  echo "$prompt" | claude --print \
    --dangerously-skip-permissions \
    --output-format text \
    2>&1 | tee "$REPORTS_DIR/phase-${phase}-attempt-${attempt}-log.txt"

  return ${PIPESTATUS[1]:-0}
}

# ── 主流程 ────────────────────────────────────────────────

main() {
  log "╔═══════════════════════════════════════════════╗"
  log "║  OneKey POS 全自動建置流水線                    ║"
  log "║  Phases: 0-4 | Max Retries: ${MAX_RETRIES}/phase       ║"
  log "╚═══════════════════════════════════════════════╝"

  # 初始化報告目錄
  mkdir -p "$REPORTS_DIR"

  # 最終摘要資料
  declare -A phase_results
  declare -A phase_attempts
  local degraded_phases=()

  # 逐 Phase 執行
  for phase in $(seq 0 $((TOTAL_PHASES - 1))); do
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "開始 Phase ${phase}"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    local passed=false

    for attempt in $(seq 1 $MAX_RETRIES); do
      log "Phase ${phase} — Attempt ${attempt}/${MAX_RETRIES}"

      # 執行建置
      execute_phase_with_claude "$phase" "$attempt" || true

      # 執行品質閘門
      if run_quality_gate "$phase"; then
        passed=true
        phase_results[$phase]="PASS"
        phase_attempts[$phase]=$attempt
        log_pass "Phase ${phase} 在 Attempt ${attempt} 通過!"
        break
      else
        log_fail "Phase ${phase} Attempt ${attempt} 未通過品質閘門"

        if [[ $attempt -eq $MAX_RETRIES ]]; then
          log_warn "Phase ${phase} 已達最大重試次數，降級處理"
          phase_results[$phase]="DEGRADED"
          phase_attempts[$phase]=$MAX_RETRIES
          degraded_phases+=("$phase")
        fi
      fi
    done
  done

  # ── 最終報告 ──────────────────────────────────────────

  log ""
  log "╔═══════════════════════════════════════════════╗"
  log "║              最終建置報告                       ║"
  log "╚═══════════════════════════════════════════════╝"
  log ""

  local total_pass=0
  local total_degraded=0

  for phase in $(seq 0 $((TOTAL_PHASES - 1))); do
    local result="${phase_results[$phase]:-SKIP}"
    local attempts="${phase_attempts[$phase]:-0}"

    case $result in
      PASS)
        log_pass "Phase ${phase}: 通過 (${attempts} 次嘗試)"
        ((total_pass++))
        ;;
      DEGRADED)
        log_warn "Phase ${phase}: 降級 (${attempts} 次嘗試後)"
        ((total_degraded++))
        ;;
      *)
        log_fail "Phase ${phase}: 跳過"
        ;;
    esac
  done

  log ""
  log "通過: ${total_pass}/${TOTAL_PHASES}"
  log "降級: ${total_degraded}/${TOTAL_PHASES}"

  if [[ ${#degraded_phases[@]} -gt 0 ]]; then
    log_warn "降級的 Phase: ${degraded_phases[*]}"
  fi

  # 寫入最終摘要
  cat > "$REPORTS_DIR/final-summary.json" <<EOF
{
  "timestamp": "$(timestamp)",
  "total_phases": $TOTAL_PHASES,
  "passed": $total_pass,
  "degraded": $total_degraded,
  "degraded_phases": [$(IFS=,; echo "${degraded_phases[*]:-}")],
  "phase_details": {
$(for phase in $(seq 0 $((TOTAL_PHASES - 1))); do
    echo "    \"phase_${phase}\": { \"result\": \"${phase_results[$phase]:-SKIP}\", \"attempts\": ${phase_attempts[$phase]:-0} }$([ $phase -lt $((TOTAL_PHASES - 1)) ] && echo ",")"
done)
  }
}
EOF

  log "最終報告: $REPORTS_DIR/final-summary.json"

  # 結束狀態
  if [[ $total_pass -eq $TOTAL_PHASES ]]; then
    log_pass "🎉 全部 Phase 通過！實驗成功！"
    exit 0
  elif [[ $total_pass -ge 3 ]]; then
    log_warn "⚠️ 部分降級，但核心功能完成"
    exit 0
  else
    log_fail "❌ 多數 Phase 失敗"
    exit 1
  fi
}

# ── 執行 ──────────────────────────────────────────────────
main "$@"
