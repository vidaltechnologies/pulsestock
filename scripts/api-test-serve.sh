#!/usr/bin/env bash
# Compila e sobe o app apontando para o Supabase local de .env.test.local
# (as variáveis do ambiente valem mais que as do .env.local).
set -euo pipefail
set -a
# shellcheck disable=SC1091
source .env.test.local
set +a
npx next build
exec npx next start -p "${PORT:-3100}"
