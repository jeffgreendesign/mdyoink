#!/bin/bash
set -euo pipefail

# security-check.sh — Source-level security scanner for mdyoink
# Adapted from jeffgreendesign/project-scaffold patterns.
# Scans staged files (or all source files) for common vulnerability patterns.
#
# Usage:
#   bash scripts/security-check.sh            # warn mode (exit 0)
#   bash scripts/security-check.sh --strict   # fail on findings (exit 1)

STRICT=false
if [ "${1:-}" = "--strict" ]; then
  STRICT=true
fi

FINDINGS=0
SRC_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep '\.js$' || true)

# Fall back to all JS source files if nothing is staged
if [ -z "$SRC_FILES" ]; then
  SRC_FILES=$(find . -name '*.js' \
    -not -path './node_modules/*' \
    -not -path './.git/*' \
    -not -path './lib/readability.js' \
    -not -path './lib/turndown.js' \
    -not -path './lib/turndown-plugin-gfm.js' \
    | sort)
fi

echo "=== mdyoink security scan ==="
echo ""

# --- 1. eval() usage (code injection risk) ---
echo "-- Checking for eval() usage..."
while IFS= read -r file; do
  [ -z "$file" ] && continue
  MATCHES=$(grep -nE '\beval\s*\(' "$file" 2>/dev/null | grep -v '^\s*//' || true)
  if [ -n "$MATCHES" ]; then
    echo "  WARN: eval() in $file"
    echo "$MATCHES" | sed 's/^/    /'
    FINDINGS=$((FINDINGS + 1))
  fi
done <<< "$SRC_FILES"

# --- 2. Hardcoded secrets (API keys, tokens, passwords) ---
echo "-- Checking for hardcoded secrets..."
while IFS= read -r file; do
  [ -z "$file" ] && continue
  # Skip .example and .template files
  case "$file" in *.example|*.template) continue ;; esac
  MATCHES=$(grep -nEi '(api_key|apikey|api_secret|secret_key|password|token|private_key)\s*[:=]\s*["\x27][A-Za-z0-9_\-]{8,}' "$file" 2>/dev/null | grep -v '^\s*//' || true)
  if [ -n "$MATCHES" ]; then
    echo "  WARN: Possible hardcoded secret in $file"
    echo "$MATCHES" | sed 's/^/    /'
    FINDINGS=$((FINDINGS + 1))
  fi
done <<< "$SRC_FILES"

# --- 3. innerHTML assignment (XSS risk) ---
echo "-- Checking for innerHTML assignments..."
while IFS= read -r file; do
  [ -z "$file" ] && continue
  MATCHES=$(grep -nE '\.innerHTML\s*=' "$file" 2>/dev/null | grep -v '^\s*//' || true)
  if [ -n "$MATCHES" ]; then
    echo "  WARN: innerHTML assignment in $file"
    echo "$MATCHES" | sed 's/^/    /'
    FINDINGS=$((FINDINGS + 1))
  fi
done <<< "$SRC_FILES"

# --- 4. document.write (XSS/injection risk) ---
echo "-- Checking for document.write..."
while IFS= read -r file; do
  [ -z "$file" ] && continue
  MATCHES=$(grep -nE 'document\.write\s*\(' "$file" 2>/dev/null | grep -v '^\s*//' || true)
  if [ -n "$MATCHES" ]; then
    echo "  WARN: document.write() in $file"
    echo "$MATCHES" | sed 's/^/    /'
    FINDINGS=$((FINDINGS + 1))
  fi
done <<< "$SRC_FILES"

# --- 5. Unescaped URL/text interpolation into markdown ---
# Looks for string templates building markdown links without using escape helpers
echo "-- Checking for unescaped markdown interpolation..."
while IFS= read -r file; do
  [ -z "$file" ] && continue
  # Look for template literals building markdown links: `[${...}](${...})`
  # that don't use escapeMarkdownText/escapeMarkdownUrl
  MATCHES=$(grep -nE '\[.*\$\{.*\}\].*\(.*\$\{.*\}\)' "$file" 2>/dev/null | grep -v 'escapeMark' | grep -v '^\s*//' || true)
  if [ -n "$MATCHES" ]; then
    echo "  WARN: Possible unescaped markdown interpolation in $file"
    echo "$MATCHES" | sed 's/^/    /'
    FINDINGS=$((FINDINGS + 1))
  fi
done <<< "$SRC_FILES"

# --- 6. new URL() without try/catch ---
echo "-- Checking for unguarded new URL()..."
while IFS= read -r file; do
  [ -z "$file" ] && continue
  # Find lines with new URL( that aren't inside a try block (rough heuristic)
  MATCHES=$(grep -nE '\bnew URL\(' "$file" 2>/dev/null | grep -v '^\s*//' || true)
  if [ -n "$MATCHES" ]; then
    # Check if there's a try block within 3 lines before each match
    while IFS= read -r match; do
      LINE_NUM=$(echo "$match" | cut -d: -f1)
      START=$((LINE_NUM > 3 ? LINE_NUM - 3 : 1))
      CONTEXT=$(sed -n "${START},${LINE_NUM}p" "$file")
      if ! echo "$CONTEXT" | grep -q 'try'; then
        echo "  WARN: new URL() without try/catch in $file:$LINE_NUM"
        echo "    $match"
        FINDINGS=$((FINDINGS + 1))
      fi
    done <<< "$MATCHES"
  fi
done <<< "$SRC_FILES"

# --- Summary ---
echo ""
if [ "$FINDINGS" -gt 0 ]; then
  echo "=== $FINDINGS finding(s) ==="
  if [ "$STRICT" = true ]; then
    echo "Strict mode: failing."
    exit 1
  else
    echo "Run with --strict to fail on findings."
    exit 0
  fi
else
  echo "=== No findings. ==="
  exit 0
fi
