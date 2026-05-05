#!/usr/bin/env bash
# Pre-flight check for /nightshift-start.
#
# Usage:
#   preflight.sh <shift-name>           # JSON output (machine-readable)
#   preflight.sh <shift-name> --human   # human-readable summary
#
# Exits 0 always (the skill body interprets the output). Designed for use as a
# `!` block — no stderr is emitted under normal operation.

set -uo pipefail

# Count rows where COL equals VALUE in TABLE. Returns 0 when there are no
# matches. Implemented as a function so we can isolate the `qsv search → qsv
# count` pipeline: under `pipefail`, qsv search exits non-zero when there are
# zero matches, which would otherwise make the caller's `|| echo 0` rescue
# fire alongside qsv count's "0" output and produce a multi-line value that
# breaks downstream arithmetic.
count_status() {
  local table="$1" value="$2" col="$3" out
  out=$(flock -x "$table" qsv search --exact "$value" --select "$col" "$table" 2>/dev/null | qsv count 2>/dev/null || true)
  printf '%s' "${out:-0}"
}

NAME="${1:-}"
MODE="${2:-json}"

if [ -z "$NAME" ]; then
  if [ "$MODE" = "--human" ]; then
    echo "Error: shift name is empty."
  else
    echo '{"error":"missing_argument"}'
  fi
  exit 0
fi

DIR=".nightshift/$NAME"
TABLE="$DIR/table.csv"
MANAGER="$DIR/manager.md"

if [ ! -d "$DIR" ]; then
  if [ "$MODE" = "--human" ]; then
    echo "Shift $NAME not found at $DIR."
  else
    printf '{"error":"shift_not_found","shift":"%s"}\n' "$NAME"
  fi
  exit 0
fi

if [ ! -f "$TABLE" ]; then
  if [ "$MODE" = "--human" ]; then
    echo "Shift $NAME has no table.csv."
  else
    printf '{"error":"shift_not_found","shift":"%s"}\n' "$NAME"
  fi
  exit 0
fi

# qsv count returns 0 when the file is empty; treat that as "no items"
TOTAL="$(flock -x "$TABLE" qsv count "$TABLE" 2>/dev/null || echo 0)"
if [ -z "$TOTAL" ] || [ "$TOTAL" = "0" ]; then
  if [ "$MODE" = "--human" ]; then
    echo "Shift $NAME has no items."
  else
    printf '{"error":"no_items","shift":"%s"}\n' "$NAME"
  fi
  exit 0
fi

# Headers, comma-separated
HEADERS_RAW="$(flock -x "$TABLE" qsv headers --just-names "$TABLE" 2>/dev/null || true)"
if [ -z "$HEADERS_RAW" ]; then
  if [ "$MODE" = "--human" ]; then
    echo "Shift $NAME table has no headers."
  else
    printf '{"error":"no_tasks","shift":"%s"}\n' "$NAME"
  fi
  exit 0
fi

# Identify task columns: any column containing only the values todo|done|failed
# in the data rows.
TASK_COLS=""
NON_TASK_COLS=""
for COL in $HEADERS_RAW; do
  TODO_C=$(count_status "$TABLE" todo "$COL")
  DONE_C=$(count_status "$TABLE" done "$COL")
  FAIL_C=$(count_status "$TABLE" failed "$COL")
  SUM=$((TODO_C + DONE_C + FAIL_C))
  if [ "$SUM" = "$TOTAL" ] && [ "$TOTAL" -gt 0 ]; then
    TASK_COLS="$TASK_COLS $COL"
  else
    NON_TASK_COLS="$NON_TASK_COLS $COL"
  fi
done

# Trim leading spaces
TASK_COLS="$(printf '%s' "$TASK_COLS" | sed 's/^ *//')"

if [ -z "$TASK_COLS" ]; then
  if [ "$MODE" = "--human" ]; then
    echo "Shift $NAME has no task columns."
  else
    printf '{"error":"no_tasks","shift":"%s"}\n' "$NAME"
  fi
  exit 0
fi

# Aggregate counts and per-task counts
TODO_TOTAL=0
DONE_TOTAL=0
FAILED_TOTAL=0
TASKS_JSON=""
TASKS_HUMAN=""

for COL in $TASK_COLS; do
  T=$(count_status "$TABLE" todo "$COL")
  D=$(count_status "$TABLE" done "$COL")
  F=$(count_status "$TABLE" failed "$COL")
  TODO_TOTAL=$((TODO_TOTAL + T))
  DONE_TOTAL=$((DONE_TOTAL + D))
  FAILED_TOTAL=$((FAILED_TOTAL + F))
  TASKS_JSON="$TASKS_JSON,{\"task\":\"$COL\",\"todo\":$T,\"done\":$D,\"failed\":$F}"
  TASKS_HUMAN="$TASKS_HUMAN  - $COL: $T todo, $D done, $F failed\n"
done
TASKS_JSON="${TASKS_JSON#,}"

if [ "$TODO_TOTAL" = "0" ]; then
  if [ "$MODE" = "--human" ]; then
    printf "Shift %s is complete.\nTotal items: %s\nDone: %s, Failed: %s\n" "$NAME" "$TOTAL" "$DONE_TOTAL" "$FAILED_TOTAL"
  else
    printf '{"status":"complete","shift":"%s","total":%s,"done":%s,"failed":%s,"todo":0,"tasks":[%s]}\n' "$NAME" "$TOTAL" "$DONE_TOTAL" "$FAILED_TOTAL" "$TASKS_JSON"
  fi
  exit 0
fi

if [ "$MODE" = "--human" ]; then
  printf "Shift %s\n" "$NAME"
  printf "Total items: %s\n" "$TOTAL"
  printf "Aggregate: %s todo, %s done, %s failed\n" "$TODO_TOTAL" "$DONE_TOTAL" "$FAILED_TOTAL"
  printf "Per task:\n"
  printf "%b" "$TASKS_HUMAN"
else
  printf '{"status":"ready","shift":"%s","total":%s,"todo":%s,"done":%s,"failed":%s,"tasks":[%s]}\n' "$NAME" "$TOTAL" "$TODO_TOTAL" "$DONE_TOTAL" "$FAILED_TOTAL" "$TASKS_JSON"
fi
