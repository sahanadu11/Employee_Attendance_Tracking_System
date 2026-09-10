#!/bin/sh
set -e
cd /app/backend
if [ "$RUN_SEED" = "true" ]; then
  node dist/seed/seedData.js || true
fi
exec node dist/src/index.js
