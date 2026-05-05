#!/usr/bin/env bash
# Initialize a new Nightshift shift directory.
#
# Usage: init-shift.sh <shift-name>
#
# Creates .nightshift/<shift-name>/ with manager.md and an empty table.csv.

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <shift-name>" >&2
  exit 2
fi

NAME="$1"

# Validate kebab-case
if ! printf '%s' "$NAME" | grep -Eq '^[a-z0-9]+(-[a-z0-9]+)*$'; then
  echo "Error: shift name must be kebab-case (lowercase letters, numbers, hyphens). Got: $NAME" >&2
  exit 1
fi

DIR=".nightshift/$NAME"

if [ -e "$DIR" ]; then
  echo "Error: $DIR already exists. Use /nightshift-start $NAME to resume." >&2
  exit 1
fi

mkdir -p "$DIR"

DATE="$(date +%Y-%m-%d)"

cat > "$DIR/manager.md" <<EOF
## Shift Configuration

- name: $NAME
- created: $DATE
<!-- - parallel: true -->
<!-- - current-batch-size: 2 -->
<!-- - max-batch-size: 10 -->
<!-- - disable-self-improvement: true -->

## Task Order

(no tasks yet — use \`/nightshift-add-task $NAME\` to add tasks)
EOF

# Empty table.csv (no header row; columns added by /nightshift-add-task)
: > "$DIR/table.csv"

echo "Created $DIR/manager.md"
echo "Created $DIR/table.csv (empty)"
