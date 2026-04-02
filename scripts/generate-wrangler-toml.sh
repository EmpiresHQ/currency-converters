#!/bin/bash
set -euo pipefail
# Usage: ./generate-wrangler-toml.sh <slug> <db-id>
SLUG=$1
DB_ID=$2

cat <<EOF
name = "cc-${SLUG}"
main = "src/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "./public"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = true

[triggers]
crons = ["*/1 * * * *"]

[[d1_databases]]
binding = "DB"
database_name = "cc-${SLUG}-db"
database_id = "${DB_ID}"
migrations_dir = "migrations"

[durable_objects]
bindings = [
  { name = "RATE_TICKER", class_name = "RateTicker" }
]

[[migrations]]
tag = "v1"
new_sqlite_classes = ["RateTicker"]

[[routes]]
pattern = "${SLUG}.ui.ee"
custom_domain = true
EOF
