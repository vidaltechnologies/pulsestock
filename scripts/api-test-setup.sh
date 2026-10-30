#!/usr/bin/env bash
# Prepara um Supabase LOCAL (Docker) para os testes de integração da API:
# sobe só o que a API usa, recria o banco com as migrações, cria um
# administrador e um operador de teste e carrega os dados de demonstração.
# Nunca toca o projeto na nuvem. Grava as variáveis em .env.test.local.
#
# Uso: npm run test:api:setup  (depois: npm run build && npm start, e npm run test:api)
set -euo pipefail

# psql de dentro do contêiner do banco, para não depender de psql instalado.
DB_CONTAINER="supabase_db_$(sed -n 's/^project_id = "\(.*\)"/\1/p' supabase/config.toml)"
sql() { docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
ADMIN_EMAIL="admin@api-test.local"
OPERATOR_EMAIL="operador@api-test.local"
# Senhas só deste banco descartável.
PASSWORD="api-test-123456"

npx supabase start -x studio,imgproxy,storage-api,realtime,edge-runtime,logflare,vector,postgres-meta,supavisor,mailpit
npx supabase db reset --local --no-seed

eval "$(npx supabase status -o env)"

create_user() {
  curl -sf -X POST "$API_URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$PASSWORD\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"$2\"}}" \
    > /dev/null
}

create_user "$ADMIN_EMAIL" "Admin Teste"
create_user "$OPERATOR_EMAIL" "Operador Teste"
sql -c "update public.profiles set role = 'admin' where id = (select id from auth.users where email = '$ADMIN_EMAIL')"
sql < supabase/seed.sql

cat > .env.test.local <<ENV
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY
API_TEST_ADMIN_EMAIL=$ADMIN_EMAIL
API_TEST_OPERATOR_EMAIL=$OPERATOR_EMAIL
API_TEST_PASSWORD=$PASSWORD
ENV

echo "Supabase local pronto. Variáveis em .env.test.local."
