#!/usr/bin/env bash
# dispatch-batch.sh — Spawn N concurrent `claude -p` subprocesses to execute
# Nightshift dev work, wait for all to finish, parse each result, and emit a
# single consolidated JSON document on stdout.
#
# Used by the nightshift-manager subagent for both serial (one item) and
# parallel (multiple items) dispatch.
#
# Usage:
#   dispatch-batch.sh --manifest <path-to-json>
#   dispatch-batch.sh                              # reads manifest from stdin
#   dispatch-batch.sh --probe                      # auto-mode availability probe (returns JSON)
#
# Manifest format:
#   {
#     "shift": "my-shift",
#     "items": [
#       {"item_id": "1", "task": "create_page"},
#       {"item_id": "2", "task": "create_page"}
#     ],
#     "permission_mode": "auto" | "bypassPermissions",
#     "log_dir": ".nightshift/my-shift/logs",
#     "read_only": false
#   }
#
# Output format:
#   {
#     "results": [
#       {
#         "item_id": "1",
#         "exit_code": 0,
#         "status": "done",
#         "attempts": 1,
#         "recommendations": "None",
#         "error": null,
#         "log_path": ".nightshift/my-shift/logs/1-create_page-2026-05-15T12-34-56.jsonl"
#       },
#       ...
#     ]
#   }

set -u

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

die() {
  printf 'dispatch-batch.sh: %s\n' "$*" >&2
  exit 2
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

# ----------------------------------------------------------------------------
# Auto-mode probe
# ----------------------------------------------------------------------------

probe_auto_mode() {
  # Test-runner escape hatch: skip the real probe and force the
  # bypassPermissions fallback. Useful on environments where auto mode is
  # unavailable (Pro plan, Bedrock/Vertex, or older Claude Code) so the
  # integration suite can still exercise the subprocess dispatch path.
  if [ -n "${NIGHTSHIFT_TEST_NO_AUTO_MODE:-}" ]; then
    printf '{"auto_mode":"unavailable","reason":"NIGHTSHIFT_TEST_NO_AUTO_MODE set"}\n'
    return 0
  fi

  if claude --permission-mode auto -p "echo ready" \
      --output-format json >/dev/null 2>&1; then
    printf '{"auto_mode":"available","reason":null}\n'
  else
    local detail
    detail=$(claude --permission-mode auto -p "echo ready" --output-format json 2>&1 || true)
    # Strip newlines and quote for JSON
    detail=$(printf '%s' "$detail" | tr '\n' ' ' | sed 's/"/\\"/g' | head -c 500)
    printf '{"auto_mode":"unavailable","reason":"%s"}\n' "${detail:-probe failed}"
  fi
}

# ----------------------------------------------------------------------------
# Argument parsing
# ----------------------------------------------------------------------------

MANIFEST_PATH=""
PROBE_MODE=false

while [ $# -gt 0 ]; do
  case "$1" in
    --probe)
      PROBE_MODE=true
      shift
      ;;
    --manifest)
      MANIFEST_PATH="${2:-}"
      shift 2
      ;;
    -h|--help)
      sed -n '2,40p' "$0"
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

if [ "$PROBE_MODE" = true ]; then
  require_cmd claude
  probe_auto_mode
  exit 0
fi

require_cmd claude
require_cmd jq

# ----------------------------------------------------------------------------
# Load manifest
# ----------------------------------------------------------------------------

if [ -n "$MANIFEST_PATH" ]; then
  [ -f "$MANIFEST_PATH" ] || die "manifest not found: $MANIFEST_PATH"
  MANIFEST=$(cat "$MANIFEST_PATH")
else
  MANIFEST=$(cat)
fi

SHIFT_NAME=$(printf '%s' "$MANIFEST" | jq -r '.shift // empty')
PERMISSION_MODE=$(printf '%s' "$MANIFEST" | jq -r '.permission_mode // "auto"')
LOG_DIR=$(printf '%s' "$MANIFEST" | jq -r '.log_dir // empty')
READ_ONLY=$(printf '%s' "$MANIFEST" | jq -r '.read_only // false')

[ -n "$SHIFT_NAME" ] || die "manifest missing required field: shift"
[ -n "$LOG_DIR" ]    || die "manifest missing required field: log_dir"

mkdir -p "$LOG_DIR"

ITEM_COUNT=$(printf '%s' "$MANIFEST" | jq '.items | length')
[ "$ITEM_COUNT" -gt 0 ] || die "manifest items array is empty"

# ----------------------------------------------------------------------------
# Spawn subprocesses in parallel
# ----------------------------------------------------------------------------

TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%S")
PIDS=()
LOG_PATHS=()
ITEM_IDS=()
TASK_NAMES=()

for i in $(seq 0 $((ITEM_COUNT - 1))); do
  ITEM_ID=$(printf '%s' "$MANIFEST" | jq -r ".items[$i].item_id")
  TASK=$(printf '%s' "$MANIFEST" | jq -r ".items[$i].task")
  LOG_PATH="${LOG_DIR}/${ITEM_ID}-${TASK}-${TIMESTAMP}.jsonl"

  ARGS="$SHIFT_NAME $TASK $ITEM_ID"
  if [ "$READ_ONLY" = "true" ]; then
    ARGS="$ARGS --read-only"
  fi

  # Spawn in background; redirect stream-json to per-item log.
  # --permission-mode bypassPermissions is equivalent to --dangerously-skip-permissions
  # per the Claude Code docs, so we pass it through --permission-mode in both modes.
  # --verbose is required when pairing -p with --output-format stream-json.
  claude -p "/nightshift-do-task $ARGS" \
    --output-format stream-json \
    --verbose \
    --permission-mode "$PERMISSION_MODE" \
    > "$LOG_PATH" 2>&1 &

  PIDS+=("$!")
  LOG_PATHS+=("$LOG_PATH")
  ITEM_IDS+=("$ITEM_ID")
  TASK_NAMES+=("$TASK")
done

# Wait for all and capture exit codes (parallel-safe)
EXIT_CODES=()
for pid in "${PIDS[@]}"; do
  if wait "$pid"; then
    EXIT_CODES+=(0)
  else
    EXIT_CODES+=($?)
  fi
done

# ----------------------------------------------------------------------------
# Parse each log and emit consolidated JSON
# ----------------------------------------------------------------------------

# Build results array using jq
RESULTS_JSON='[]'

for i in $(seq 0 $((ITEM_COUNT - 1))); do
  ITEM_ID="${ITEM_IDS[$i]}"
  LOG_PATH="${LOG_PATHS[$i]}"
  EXIT_CODE="${EXIT_CODES[$i]}"

  # Find the last line in the log that parses as a JSON object with .type
  # equal to "result". We forward-scan and keep the most recent match — this
  # avoids relying on `tac` (which is GNU-only; macOS doesn't ship it).
  RESULT_LINE=""
  if [ -f "$LOG_PATH" ]; then
    while IFS= read -r line; do
      if printf '%s' "$line" | jq -e 'type == "object" and .type == "result"' >/dev/null 2>&1; then
        RESULT_LINE="$line"
      fi
    done < "$LOG_PATH"
  fi

  if [ -n "$RESULT_LINE" ]; then
    # Extract a do-task structured payload from the Claude stream-json envelope.
    # The envelope's .result field is a STRING containing the model's final
    # message. The do-task skill emits JSON in that message. We try, in order:
    #   1. The whole .result string parses as JSON (skill emitted bare JSON).
    #   2. A markdown ```json … ``` fenced block inside .result (skill wrapped it).
    #   3. The first {…} substring inside .result (skill emitted prose around it).
    # If none match, fall back to an empty object and the entry will be marked
    # failed downstream.
    RESULT_STR=$(printf '%s' "$RESULT_LINE" | jq -r '
      if (.result | type) == "string" then .result
      else (. | tojson)
      end
    ' 2>/dev/null || true)

    INNER=""
    if [ -n "$RESULT_STR" ]; then
      # Strategy 1: bare JSON
      if printf '%s' "$RESULT_STR" | jq -e 'type == "object"' >/dev/null 2>&1; then
        INNER=$(printf '%s' "$RESULT_STR" | jq -c '.')
      fi

      # Strategy 2: markdown ```json fenced block
      if [ -z "$INNER" ]; then
        FENCED=$(printf '%s' "$RESULT_STR" | awk '
          /^[[:space:]]*```(json)?[[:space:]]*$/ { in_block = !in_block; next }
          in_block { print }
        ' | head -c 8192)
        if [ -n "$FENCED" ] && printf '%s' "$FENCED" | jq -e 'type == "object"' >/dev/null 2>&1; then
          INNER=$(printf '%s' "$FENCED" | jq -c '.')
        fi
      fi

      # Strategy 3: first {…} JSON object substring. Brace-balanced scan to
      # avoid grabbing only `{"type":"result"` and stopping at first `}`.
      if [ -z "$INNER" ]; then
        SUBSTR=$(printf '%s' "$RESULT_STR" | awk '
          BEGIN { depth = 0; started = 0; out = "" }
          {
            line = $0
            for (i = 1; i <= length(line); i++) {
              c = substr(line, i, 1)
              if (!started && c == "{") { started = 1; depth = 1; out = c; continue }
              if (started) {
                out = out c
                if (c == "{") depth++
                else if (c == "}") { depth--; if (depth == 0) { print out; exit } }
              }
            }
            if (started) out = out "\n"
          }
        ')
        if [ -n "$SUBSTR" ] && printf '%s' "$SUBSTR" | jq -e 'type == "object"' >/dev/null 2>&1; then
          INNER=$(printf '%s' "$SUBSTR" | jq -c '.')
        fi
      fi
    fi

    if [ -z "$INNER" ]; then INNER='{}'; fi

    STATUS=$(printf '%s' "$INNER" | jq -r '.status // "failed"')
    ATTEMPTS=$(printf '%s' "$INNER" | jq -r '.attempts // 0')
    RECOMMENDATIONS=$(printf '%s' "$INNER" | jq -r '.recommendations // "None"')
    ERROR=$(printf '%s' "$INNER" | jq -c '.error // null')
  else
    STATUS="failed"
    ATTEMPTS=0
    RECOMMENDATIONS="None"
    ERROR=$(printf 'subprocess exited with code %s and produced no result event' "$EXIT_CODE" | jq -Rs '.')
  fi

  # Override status to failed if exit code non-zero
  if [ "$EXIT_CODE" != "0" ] && [ "$STATUS" = "done" ]; then
    STATUS="failed"
  fi

  RESULTS_JSON=$(printf '%s' "$RESULTS_JSON" | jq \
    --arg item_id "$ITEM_ID" \
    --argjson exit_code "$EXIT_CODE" \
    --arg status "$STATUS" \
    --argjson attempts "$ATTEMPTS" \
    --arg recommendations "$RECOMMENDATIONS" \
    --argjson error "$ERROR" \
    --arg log_path "$LOG_PATH" \
    '. + [{
      item_id: $item_id,
      exit_code: $exit_code,
      status: $status,
      attempts: $attempts,
      recommendations: $recommendations,
      error: $error,
      log_path: $log_path
    }]')
done

printf '{"results":%s}\n' "$RESULTS_JSON"
