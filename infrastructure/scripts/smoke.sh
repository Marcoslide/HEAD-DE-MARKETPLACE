#!/usr/bin/env bash
# Smoke test pós-deploy: sobe API+worker no ambiente alvo e percorre a
# jornada crítica (signup -> login -> escopo -> upload -> fila -> apply).
# É o MESMO cenário do teste "34 - smoke" da suíte; aqui roda contra o
# processo real do ambiente.
set -euo pipefail
export HEAD_ENV="${HEAD_ENV:-STAGING}"
export HEAD_SECRET_STAGING="${HEAD_SECRET_STAGING:-defina-um-secret-real}"
node --test --test-name-pattern="34 · smoke" mos/test/production.test.js
echo "SMOKE OK em $HEAD_ENV"
