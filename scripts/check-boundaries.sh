#!/bin/bash
set -euo pipefail

# check-boundaries.sh — Import boundary enforcement for mdyoink
# Adapted from jeffgreendesign/project-scaffold architecture test patterns.
#
# Rules:
#   1. content/content.js and content/youtube.js are injected via executeScript —
#      they MUST NOT use ES module imports (no import/from statements).
#   2. content/picker.js is a self-contained IIFE —
#      it MUST NOT use ES module imports.
#   3. Only service-worker.js, popup/popup.js, and options/options.js
#      may import from lib/.
#   4. popup/ and options/ MUST NOT import from each other.
#   5. No file outside lib/ should define deepMerge (reuse from lib/output-modes.js).
#
# Usage:
#   bash scripts/check-boundaries.sh

VIOLATIONS=0

echo "=== mdyoink import boundary check ==="
echo ""

# --- Rule 1 & 2: Content scripts must not use ES module imports ---
echo "-- Checking content scripts for ES module imports..."
for file in content/content.js content/youtube.js content/picker.js; do
  if [ ! -f "$file" ]; then continue; fi
  MATCHES=$(grep -nE '^\s*(import\s|export\s)' "$file" 2>/dev/null | grep -v '^\s*//' || true)
  if [ -n "$MATCHES" ]; then
    echo "  VIOLATION: $file uses ES module import/export (injected scripts cannot)"
    echo "$MATCHES" | sed 's/^/    /'
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

# --- Rule 3: Only allowed files may import from lib/ ---
echo "-- Checking that only approved files import from lib/..."
ALLOWED_IMPORTERS="service-worker.js popup/popup.js options/options.js"

# Find all JS files that import from lib/
IMPORTERS=$(grep -rlE "from\s+['\"](\.\./)*lib/" --include='*.js' . 2>/dev/null | sed 's|^\./||' || true)

for file in $IMPORTERS; do
  ALLOWED=false
  for ok in $ALLOWED_IMPORTERS; do
    if [ "$file" = "$ok" ]; then
      ALLOWED=true
      break
    fi
  done
  if [ "$ALLOWED" = false ]; then
    echo "  VIOLATION: $file imports from lib/ but is not in the approved list"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

# --- Rule 4: popup/ and options/ must not import from each other ---
echo "-- Checking popup/options cross-imports..."
POPUP_CROSS=$(grep -rnE "from\s+['\"](\.\./)?options/" popup/ 2>/dev/null | grep -v '^\s*//' || true)
if [ -n "$POPUP_CROSS" ]; then
  echo "  VIOLATION: popup/ imports from options/"
  echo "$POPUP_CROSS" | sed 's/^/    /'
  VIOLATIONS=$((VIOLATIONS + 1))
fi

OPTIONS_CROSS=$(grep -rnE "from\s+['\"](\.\./)?popup/" options/ 2>/dev/null | grep -v '^\s*//' || true)
if [ -n "$OPTIONS_CROSS" ]; then
  echo "  VIOLATION: options/ imports from popup/"
  echo "$OPTIONS_CROSS" | sed 's/^/    /'
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# --- Rule 5: deepMerge must only be defined in lib/output-modes.js ---
echo "-- Checking deepMerge is not redefined outside lib/..."
REDEFINES=$(grep -rnE '^\s*(function\s+deepMerge|const\s+deepMerge|let\s+deepMerge|var\s+deepMerge)' \
  --include='*.js' . 2>/dev/null \
  | grep -v 'lib/output-modes.js' \
  | grep -v '^\s*//' || true)
if [ -n "$REDEFINES" ]; then
  echo "  VIOLATION: deepMerge redefined outside lib/output-modes.js"
  echo "$REDEFINES" | sed 's/^/    /'
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# --- Summary ---
echo ""
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "=== $VIOLATIONS boundary violation(s) found ==="
  exit 1
else
  echo "=== All import boundaries clean. ==="
  exit 0
fi
