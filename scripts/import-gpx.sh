#!/usr/bin/env bash
# scripts/import-gpx.sh
#
# Collects Nebo GPX exports from ~/Downloads (or a custom path),
# copies new files to .planning/data/gpx/, and regenerates daily route tracks.
#
# Usage:
#   npm run import-gpx                        # pull from ~/Downloads
#   npm run import-gpx -- ~/Desktop          # pull from a custom folder
#   bash scripts/import-gpx.sh ~/Desktop     # same, direct
#
# Phone-side workflow:
#   Nebo app → Settings → Trips → [tap trip] → Export GPX → AirDrop to Mac

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$PROJECT_ROOT/.planning/data/gpx"
SOURCE="${1:-$HOME/Downloads}"

if [ ! -d "$SOURCE" ]; then
  echo "Source directory not found: $SOURCE"
  exit 1
fi

mkdir -p "$DEST"

# Collect .gpx files from source (non-recursive — AirDrop lands at top level)
shopt -s nullglob
files=("$SOURCE"/*.gpx "$SOURCE"/*.GPX)
shopt -u nullglob

if [ ${#files[@]} -eq 0 ]; then
  echo "No .gpx files found in $SOURCE"
  echo ""
  echo "Export from Nebo: Settings → Trips → [trip] → Export GPX → AirDrop to Mac"
  exit 0
fi

echo "Found ${#files[@]} .gpx file(s) in $SOURCE"
echo ""

copied=0
skipped=0
for f in "${files[@]}"; do
  base="$(basename "$f")"
  if [ -f "$DEST/$base" ]; then
    skipped=$((skipped + 1))
  else
    cp "$f" "$DEST/$base"
    echo "  + $base"
    copied=$((copied + 1))
  fi
done

echo ""
if [ $copied -eq 0 ]; then
  echo "Nothing new (all ${skipped} file(s) already imported)."
  exit 0
fi

echo "Imported $copied new, skipped $skipped duplicate(s)."
echo ""
echo "Processing daily tracks..."
cd "$PROJECT_ROOT"
node scripts/08-slice-gpx-by-day.mjs
