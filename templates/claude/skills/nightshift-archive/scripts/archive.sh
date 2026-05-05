#!/usr/bin/env bash
# Archive a Nightshift shift to .nightshift/archive/YYYY-MM-DD-<name>/.
#
# Usage: archive.sh <shift-name>
#
# Exits 0 on success, non-zero on missing shift or archive collision.

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <shift-name>" >&2
  exit 2
fi

NAME="$1"
SRC=".nightshift/$NAME"
DATE="$(date +%Y-%m-%d)"
DEST=".nightshift/archive/${DATE}-${NAME}"

if [ ! -d "$SRC" ]; then
  echo "Error: shift directory $SRC does not exist." >&2
  exit 1
fi

if [ -e "$DEST" ]; then
  echo "Error: archive target $DEST already exists. Cannot overwrite." >&2
  exit 1
fi

mkdir -p ".nightshift/archive"
mv "$SRC" "$DEST"

echo "Moved $SRC → $DEST"
