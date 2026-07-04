#!/usr/bin/env bash
# Smoke pós-deploy. LOCAL: jornada completa da API (teste 34).
# STAGING/PRODUCTION: exige PostgreSQL+Redis reais (npm run smoke:staging),
# que FALHA se SQLite for usado, Redis estiver fora ou worker sem heartbeat.
set -euo pipefail
if [ "${HEAD_ENV:-LOCAL}" = "LOCAL" ]; then
  node --test --test-name-pattern="34 · smoke" mos/test/production.test.js
else
  npm run smoke:staging
fi
echo "SMOKE OK em ${HEAD_ENV:-LOCAL}"
