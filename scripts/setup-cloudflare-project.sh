#!/bin/bash
set -euo pipefail
# Usage: ./setup-cloudflare-project.sh <slug>
SLUG=$1
DB_NAME="cc-${SLUG}-db"

# Use wrangler d1 info (targets a specific DB) instead of wrangler d1 list (which may paginate)
DB_ID=$(wrangler d1 info "$DB_NAME" --json 2>/dev/null | jq -r '.uuid // empty' || true)

if [ -z "$DB_ID" ]; then
  echo "Creating D1 database: $DB_NAME" >&2
  RESULT=$(wrangler d1 create "$DB_NAME" 2>&1)
  echo "$RESULT" >&2
  # d1 create doesn't support --json — parse UUID from text output
  DB_ID=$(echo "$RESULT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
else
  echo "D1 database already exists: $DB_NAME ($DB_ID)" >&2
fi

if [ -z "$DB_ID" ]; then
  echo "Error: Failed to create or find D1 database: $DB_NAME" >&2
  exit 1
fi

echo "$DB_ID"
