#!/bin/bash
set -euo pipefail
# Usage: ./deploy-model.sh <model-folder-name>
MODEL_DIR=$1
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SLUG=$("$SCRIPT_DIR/sanitize-name.sh" "$MODEL_DIR")
MODEL_PATH="models/$MODEL_DIR"

echo "=== Deploying $MODEL_DIR as cc-$SLUG ==="

# 1. Setup Cloudflare resources (create D1 if needed)
DB_ID=$("$SCRIPT_DIR/setup-cloudflare-project.sh" "$SLUG")
echo "D1 database ID: $DB_ID"

# 2. Generate wrangler.toml (overwrites any LLM-generated one)
"$SCRIPT_DIR/generate-wrangler-toml.sh" "$SLUG" "$DB_ID" > "$MODEL_PATH/apps/api/wrangler.toml"

# 3. Install deps
cd "$MODEL_PATH"
bun install

# 4. Build frontend
cd apps/frontend
bun run build

# 5. Copy built assets to api/public
rm -rf ../api/public
cp -r dist ../api/public

# 6. Run D1 migrations (plain .sql files in apps/api/migrations/)
cd ../api
wrangler d1 migrations apply "cc-${SLUG}-db" --remote

# 7. Deploy worker (also attaches custom domain via [[routes]] custom_domain = true)
wrangler deploy

echo "=== Deployed: https://${SLUG}.ui.ee ==="
