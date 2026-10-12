#!/bin/bash
cd "$(dirname "$0")"

echo "=== Demarrage Docker ==="
open -a Docker
sleep 20

echo "=== Demarrage Supabase ==="
cd supabase
docker compose up -d
sleep 30

echo "=== Demarrage App ==="
cd ../web
open http://localhost:3000
node_modules/.bin/next start