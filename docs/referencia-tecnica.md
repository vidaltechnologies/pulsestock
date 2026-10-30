# Pulse Stock: referência técnica

Detalhes do banco, das regras de acesso e da API. Para a visão geral do projeto, veja o [README](../README.md).

## Banco de dados

As migrações ficam em `supabase/migrations/`. A Supabase CLI já vem como dependência de desenvolvimento.

**Supabase local (Docker):**

```bash
npm run db:start   # sobe o Supabase local
npm run db:reset   # recria o banco aplicando as migrações e os dados de demonstração
```

**Projeto na nuvem:**

```bash
npx supabase login
npx supabase link --project-ref qhkemlxytksotndoxtak
npx supabase db push
```

`login` e `link` pedem o token de acesso e a senha do banco no seu terminal. Eles não devem ser salvos no repositório.

### Dados de demonstração

`supabase/seed.sql` cria 4 categorias, 16 produtos, 10 clientes e cerca de 110 pedidos espalhados pelos últimos 60 dias (a maioria entregue, alguns enviados, confirmados, pendentes e cancelados), além de 3 produtos com estoque baixo. Os pedidos passam pelas mesmas funções do app, então saldos, totais e histórico ficam coerentes.

- Não cria usuários nem senhas. Pedidos e movimentações ficam em nome do primeiro administrador ativo; sem administrador, só catálogo e clientes são criados.
- Roda uma vez só: se já existirem produtos com SKU `PS-`, não faz nada.
- No banco local roda junto com `npm run db:reset`. No projeto na nuvem: `npm run db:seed`.

### Modelo de dados

| Tabela | Uso |
| --- | --- |
| `profiles` | Perfil de cada usuário do Supabase Auth (`admin` ou `operator`) |
| `categories` | Categorias de produto |
| `products` | Catálogo, preços e saldo de estoque (nunca negativo) |
| `stock_movements` | Histórico imutável de entradas, saídas e ajustes |
| `customers` | Clientes com CPF ou CNPJ |
| `orders` | Pedidos de venda e seu status |
| `order_items` | Itens do pedido com preço congelado no momento da venda |

O estoque é baixado quando o pedido é confirmado.

## Autenticação

- Login por e-mail e senha (Supabase Auth). O cadastro público fica desativado: usuários são criados pelo painel do Supabase.
- Cada usuário novo ganha um perfil `operator` automaticamente. Para tornar alguém administrador, rode no SQL Editor do Supabase:

  ```sql
  update public.profiles
  set role = 'admin'
  where id = (select id from auth.users where email = 'seu-email@exemplo.com');
  ```

- `src/proxy.ts` renova a sessão a cada requisição e manda para `/login` quem acessa a área logada sem sessão. A autorização de fato acontece nas páginas, na API e no RLS.
- A sessão fica em cookies `httpOnly`, lidos só no servidor.

| Rota | Uso |
| --- | --- |
| `POST /api/v1/auth/login` | Login das telas: `{ email, password }` validado com Zod e sessão gravada em cookie. 401 para credenciais erradas, 403 para usuário desativado |
| `POST /api/v1/auth/token` | Login para clientes externos (Postman, outro sistema): mesmo corpo, devolve `{ tokenType, accessToken, refreshToken, expiresIn, expiresAt, user }` e não grava cookie |
| `POST /api/v1/auth/refresh` | `{ refreshToken }` → par de tokens novo. Token inválido ou já usado → 401 `invalid_refresh_token` |
| `POST /api/v1/auth/logout` | Encerra a sessão do cookie ou, com token, invalida o `refreshToken` dele |
| `POST /api/v1/auth/password/forgot` | `{ email }` → envia o e-mail de recuperação. Responde 202 com ou sem conta para o e-mail (não revela quem é usuário); 429 `too_many_requests` no limite de envios |
| `POST /api/v1/auth/password/reset` | `{ password }` (8 a 72 caracteres) com a sessão de recuperação → grava a senha, encerra a sessão e responde 204. Sem sessão → 401 `recovery_expired`; senha igual à atual ou fraca → 422 |
| `GET /api/v1/me` | Usuário logado e perfil (401 sem sessão) |

### Recuperação de senha

1. Em `/login`, **Esqueci minha senha** leva a `/esqueci-senha`, que chama `POST /api/v1/auth/password/forgot`.
2. O link do e-mail aponta para `/auth/confirm?token_hash=...&type=recovery`. Essa rota valida o token com `verifyOtp`, cria a sessão e segue para `/redefinir-senha`. Link inválido, usado ou vencido volta para `/esqueci-senha` com um aviso.
3. `/redefinir-senha` grava a nova senha e manda para o login com o aviso de senha alterada.

O link usa `token_hash` (e não o `code` do fluxo PKCE) para funcionar mesmo se o e-mail for aberto em outro navegador ou no celular. Para isso, o modelo do e-mail precisa apontar para `/auth/confirm`:

- **Local:** já configurado em `supabase/config.toml` com `supabase/templates/recovery.html`. Os e-mails aparecem no Mailpit (`http://127.0.0.1:54324`).
- **Nuvem:** em **Authentication → URL Configuration**, o **Site URL** precisa ser o endereço do app (`http://localhost:3000` para testar no computador, o da Vercel depois do deploy). Em **Authentication → Emails → Reset password**, troque o conteúdo pelo de `supabase/templates/recovery.html`.

O envio de e-mail padrão do Supabase só entrega para e-mails da equipe do projeto e tem limite baixo por hora. Para usuários de verdade, configure um SMTP próprio em **Authentication → Emails → SMTP Settings**.

### Token (Authorization: Bearer)

Toda rota aceita o cabeçalho `Authorization: Bearer <accessToken>` no lugar do cookie. O token é o JWT do próprio Supabase Auth: o app o valida e repassa ao banco, então o RLS vale igual para quem usa as telas e para quem chama a API. Nenhuma chave secreta nova entra no projeto.

```bash
curl -X POST https://seu-app/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email":"voce@exemplo.com","password":"sua-senha"}'

curl https://seu-app/api/v1/products?lowStock=true \
  -H "Authorization: Bearer <accessToken>"
```

- O `accessToken` vale `expiresIn` segundos (1 hora no padrão do Supabase). Depois, use `POST /api/v1/auth/refresh`.
- Token inválido, expirado ou de usuário desativado → 401 `invalid_token`.
- Usuário desativado não recebe token (403 `user_inactive`).

## Convenções da API

A documentação interativa fica em **`/api/docs`** (Swagger UI): dá para gerar o token, clicar em **Authorize** e testar cada rota no navegador. A especificação OpenAPI 3.1 está em `/api/v1/openapi.json` e pode ser importada no Postman (Import → Link). Ela é gerada em `src/lib/openapi/` a partir dos mesmos esquemas Zod que validam as requisições, e `openapi.test.ts` falha se uma rota existir sem documentação ou se o formato de uma resposta mudar sem a documentação mudar junto.

As coleções do Postman em `postman/`, uma por idioma (pt, en, es), saem da mesma especificação (`src/lib/openapi/postman.ts`, com as traduções em `postman-i18n.ts`, gravadas por `npm run postman`). Cada uma manda `Accept-Language` no seu idioma, então os erros da API vêm traduzidos. Cada request tem corpo de exemplo e teste de status; o de token e os de cadastro guardam `accessToken` e os ids para os seguintes, então a coleção roda inteira no Collection Runner. `postman.test.ts` falha se um arquivo estiver desatualizado, se faltar alguma rota ou tradução ou se um corpo de exemplo não passar na validação. A troca de senha (`/auth/password/reset`) só roda com `newPassword` preenchido no ambiente, porque vale para qualquer sessão aberta, e o logout fica por último.

- Base: `/api/v1`. JSON na entrada e na saída.
- Resposta de sucesso: `{ "data": ... }`. Listas: `{ "data": [...], "pagination": { "page", "pageSize", "total", "totalPages" } }`.
- Erro: `{ "error": { "code", "message", "details"? } }`. `details` traz os erros por campo da validação. A mensagem sai no idioma de quem chamou (cookie do seletor ou `Accept-Language`).
- Paginação: `page` (a partir de 1) e `pageSize` (1 a 100, padrão 20).
- Ordenação: `sort=campo` (crescente) ou `sort=-campo` (decrescente), com os campos listados em cada recurso. Filtro ou ordenação inválidos caem no padrão em vez de dar erro.
- Criação: `201 Created` com o cabeçalho `Location` do recurso novo (exceto movimentações de estoque, que são um histórico sem rota de detalhe).
- Toda resposta leva `X-Request-Id`. Quem chama pode mandar o próprio id nesse cabeçalho.
- Não há `DELETE`: produto, cliente e usuário são inativados com `PATCH { "active": false }`, para não perder o histórico dos pedidos.

| Código | Status |
| --- | --- |
| `invalid_json`, `validation_error`, `invalid_data`, `invalid_reference` | 400 |
| `unauthorized`, `invalid_token`, `invalid_credentials`, `invalid_refresh_token`, `recovery_expired` | 401 |
| `forbidden`, `user_inactive` | 403 |
| `not_found` | 404 |
| `conflict`, `insufficient_stock`, `inactive_product`, `invalid_transition`, `not_editable`, `self_change` | 409 |
| `same_password`, `weak_password` | 422 |
| `too_many_requests` | 429 |
| `internal_error` | 500 |

## Perfis de acesso

As regras ficam no banco (RLS e privilégios por coluna, em `supabase/migrations/20261029000003_rls_policies.sql`) e são repetidas no app para mostrar só o que cada perfil pode fazer.

| Recurso | Administrador | Operador |
| --- | --- | --- |
| Perfis | Lê todos; altera nome, perfil e status (o próprio, só o nome) | Lê o próprio |
| Produtos e categorias | Cria, edita e inativa | Consulta |
| Estoque | Entradas, saídas manuais e ajustes | Entradas |
| Clientes | Cria, edita e inativa | Cria e edita |
| Pedidos e itens | Cria, edita enquanto pendente, muda status e cancela | Cria, edita enquanto pendente e muda status (sem cancelar) |

- Sem login (`anon`) e com perfil inativo, nenhuma tabela é acessível.
- Nada é excluído fisicamente, exceto itens de pedido pendente. Registros são inativados.
- Saldo de estoque, status e total do pedido não podem ser alterados direto pela API. Eles mudam só pelas funções das etapas de estoque e pedidos.

Para conferir as regras no banco, rode `npm run db:test:rls`. O script `supabase/tests/rls_check.sql` cria usuários e dados de teste dentro de uma transação, testa 45 operações por perfil e desfaz tudo no final.

## Produtos

Telas em `/produtos` (lista com busca por nome ou SKU, filtro por categoria e status, paginação de 20 itens), `/produtos/novo`, `/produtos/{id}` e `/produtos/categorias`. O operador só consulta; cadastro, edição, inativação e categorias são do administrador.

| Rota | Uso | Perfil |
| --- | --- | --- |
| `GET /api/v1/products` | Lista. Filtros: `q`, `categoryId`, `status` (`active`, `inactive`, `all`), `lowStock` (`true`, `false`), `page`, `pageSize`. `sort`: `name` (padrão), `sku`, `salePrice`, `stockQuantity`, `createdAt` | Ambos |
| `POST /api/v1/products` | Cadastra. Corpo: `sku`, `name`, `salePrice` e opcionais `description`, `categoryId`, `unit`, `costPrice`, `minStock` | Admin |
| `GET /api/v1/products/{id}` | Detalhe | Ambos |
| `PATCH /api/v1/products/{id}` | Edição parcial. Inativar: `{ "active": false }` | Admin |
| `GET /api/v1/categories` · `POST /api/v1/categories` | Lista e cadastra categorias (`{ "name" }`) | Ambos · Admin |
| `GET /api/v1/categories/{id}` · `PATCH /api/v1/categories/{id}` | Detalhe e renomeia (`{ "name" }`). Nome repetido → 409 | Ambos · Admin |

- Erros seguem `{ error: { code, message, details } }`: 400 com mensagens por campo, 401, 403, 404 e 409 para SKU ou categoria repetidos.
- O saldo (`stockQuantity`) é só leitura: o produto nasce com zero e o saldo muda pelas movimentações de estoque (etapa 5).
- A validação fica em `src/lib/validations/product.ts` e é a mesma no formulário e na API. Os testes estão em `product.test.ts` (`npm test`).

## Estoque

O saldo (`products.stock_quantity`) só muda por movimentações em `stock_movements`. Um gatilho no banco (`20261029000004_stock.sql`) aplica cada movimentação ao saldo na mesma transação, travando o produto para que movimentações simultâneas não se atropelem. Uma saída ou um ajuste que deixaria o saldo negativo é recusado, e nada é gravado.

| Tipo | Quantidade | Quem registra |
| --- | --- | --- |
| Entrada | Positiva, soma ao saldo | Admin e operador |
| Saída | Positiva, subtrai do saldo | Admin |
| Ajuste | Diferença com sinal (ex.: `-3`) | Admin |

- A tela `/estoque` tem o formulário de movimentação, o alerta de estoque baixo (produtos ativos com saldo no mínimo ou abaixo, pela coluna gerada `low_stock`) e o histórico com filtros por produto e tipo.
- O histórico mostra quem fez cada movimentação. Como o operador só lê o próprio perfil, os nomes vêm da função `user_display_names`, que devolve apenas id e nome.
- O histórico é imutável: não há edição nem exclusão. Para corrigir, registre um ajuste.

| Rota | Uso | Perfil |
| --- | --- | --- |
| `GET /api/v1/stock-movements` | Histórico. Filtros: `productId`, `type` (`in`, `out`, `adjustment`), `page`, `pageSize`. `sort`: `-createdAt` (padrão), `createdAt`, `quantity` | Ambos |
| `POST /api/v1/stock-movements` | `{ productId, type, quantity, reason? }`. Devolve a movimentação e o novo saldo. Saldo insuficiente → 409 `insufficient_stock` | Entrada: ambos · Saída e ajuste: admin |

Para conferir as regras de saldo no banco, rode `npm run db:test:stock` (22 verificações, sem gravar nada).

## Clientes

Telas em `/clientes` (lista com busca por nome, e-mail ou CPF/CNPJ e filtro de status), `/clientes/novo` e `/clientes/{id}`. Admin e operador cadastram e editam; só o admin inativa ou reativa.

- CPF e CNPJ são opcionais, mas quando informados precisam ter os dígitos verificadores corretos. Aceitam máscara e são gravados só com números (únicos no banco).
- E-mail é gravado em minúsculas, e a UF é escolhida da lista dos 27 estados.

| Rota | Uso | Perfil |
| --- | --- | --- |
| `GET /api/v1/customers` | Lista. Filtros: `q`, `status` (`active`, `inactive`, `all`), `page`, `pageSize`. `sort`: `name` (padrão), `createdAt` | Ambos |
| `POST /api/v1/customers` | `{ name, document?, email?, phone?, city?, state? }`. Documento repetido → 409 | Ambos |
| `GET /api/v1/customers/{id}` | Detalhe | Ambos |
| `PATCH /api/v1/customers/{id}` | Edição parcial. `active` só para admin (403 para operador) | Ambos |

## Pedidos

Telas em `/pedidos` (lista com busca por número ou nome do cliente e filtro de status), `/pedidos/novo`, `/pedidos/{id}` (detalhe com as ações de status) e `/pedidos/{id}/editar` (só enquanto pendente).

O pedido é gravado pela função `save_order` e o status muda só por `change_order_status`, ambas em `20261029000005_orders.sql`. Cada uma roda numa transação: ou tudo é gravado, ou nada.

- O preço de cada item é o preço de venda do produto no momento em que ele entra no pedido. O total é recalculado por gatilho e não pode ser gravado pela API.
- O mesmo produto repetido vira um item só, com as quantidades somadas. Produto inativo não entra em pedido.
- O estoque só baixa quando o pedido é confirmado. A confirmação confere o saldo de todos os itens antes de baixar qualquer um: se faltar saldo de um, nada é baixado e a resposta diz qual produto e quanto há. Cada item gera uma saída em `stock_movements` ligada ao pedido.
- Cancelar um pedido confirmado devolve o estoque com entradas ligadas ao pedido.

| De | Para | Quem |
| --- | --- | --- |
| Pendente | Confirmado | Ambos |
| Confirmado | Enviado | Ambos |
| Enviado | Entregue | Ambos |
| Pendente ou confirmado | Cancelado | Admin |

| Rota | Uso | Perfil |
| --- | --- | --- |
| `GET /api/v1/orders` | Lista. Filtros: `q` (número ou cliente), `status`, `customerId`, `page`, `pageSize`. `sort`: `-number` (padrão), `number`, `createdAt`, `totalAmount` | Ambos |
| `POST /api/v1/orders` | `{ customerId, items: [{ productId, quantity }], notes? }`. Devolve o pedido (201) | Ambos |
| `GET /api/v1/orders/{id}` | Detalhe com cliente e itens | Ambos |
| `PATCH /api/v1/orders/{id}` | Mesmo corpo do POST; substitui cliente, itens e observações. Pedido não pendente → 409 `not_editable` | Ambos |
| `POST /api/v1/orders/{id}/status` | `{ status }` (`confirmed`, `shipped`, `delivered`, `cancelled`). Erros 409: `insufficient_stock`, `inactive_product`, `invalid_transition` | Ambos · Cancelar: admin |

Para conferir as regras no banco, rode `npm run db:test:orders` (37 verificações, sem gravar nada).

## Dashboard

A tela `/dashboard` mostra os indicadores do mês e três gráficos do período escolhido (7, 30 ou 90 dias, pela URL `?periodo=`). Os números são calculados no banco pela função `dashboard_summary` (`20261029000006_dashboard.sql`), numa consulta só.

- Venda é um pedido confirmado, enviado ou entregue, contado pela data de confirmação. Pendentes e cancelados ficam fora dos valores.
- Os dias são agrupados no fuso de São Paulo: uma venda confirmada às 23h é do dia dela, mesmo que já seja o dia seguinte em UTC.
- Indicadores: vendas do mês, pedidos vendidos no mês, ticket médio (vendas ÷ pedidos) e pedidos pendentes. Gráficos: vendas por dia, os 5 produtos mais vendidos (por valor) e pedidos criados no período por status. Abaixo, os produtos com estoque baixo.
- Só o administrador vê a margem estimada do mês e o valor do estoque a preço de custo. A margem usa o custo atual do produto, porque o item do pedido não guarda o custo da época. Para o operador, a função devolve esses campos como `null`.

| Rota | Uso | Perfil |
| --- | --- | --- |
| `GET /api/v1/dashboard` | Indicadores e séries. Filtro: `days` (7, 30 ou 90; padrão 30) | Ambos |

Para conferir os números no banco, rode `npm run db:test:dashboard` (28 verificações, sem gravar nada). O script cria pedidos de teste, compara o resultado com o que era antes e desfaz tudo.

## Usuários

Tela `/usuarios`, só para o administrador (o operador não vê o menu e volta ao dashboard se abrir o endereço). Mostra nome, e-mail, status e último acesso de cada pessoa, com o perfil e o botão de desativar ou reativar na própria linha.

- Novos usuários são criados ou convidados no painel do Supabase (Authentication → Users). O perfil nasce como operador e ativo.
- O e-mail e o último acesso ficam em `auth.users`, fora do alcance da API; a função `list_users` (`20261029000007_users.sql`) os devolve só para o administrador.
- O administrador não muda o próprio perfil nem desativa a si mesmo (a API responde 409 `self_change` e o banco também recusa). Assim sempre sobra ao menos um administrador ativo.
- Desativar corta o acesso na hora: o banco deixa de responder a esse usuário, a API devolve 401 e, se ele estiver com o sistema aberto, a próxima página encerra a sessão e mostra o aviso no login.

| Rota | Uso | Perfil |
| --- | --- | --- |
| `GET /api/v1/users` | Lista com e-mail, perfil, status e último acesso | Admin |
| `PATCH /api/v1/users/{id}` | `{ fullName?, role?, active? }`. O próprio perfil ou status → 409 | Admin |

Para conferir as regras no banco, rode `npm run db:test:users` (22 verificações, sem gravar nada).

## Integração contínua

O workflow `.github/workflows/ci.yml` roda em cada pull request e em cada push na `main`:

1. **App:** `npm ci`, lint, typecheck, testes unitários e build.
2. **Banco:** sobe o Postgres local do Supabase no runner, aplica todas as migrações, cria um administrador de teste, carrega os dados de demonstração e roda as cinco verificações (`supabase/tests/*_check.sql`). Qualquer verificação que falhar derruba o job.
3. **API:** sobe um Supabase local completo (banco, login e API REST), cria um administrador e um operador de teste, carrega os dados de demonstração, compila e liga o app e roda os testes de integração em `tests/api/` contra a API de verdade, com token. Depois roda as três coleções do Postman inteiras com o Newman, como administrador.

### Testes de integração da API

Os testes em `tests/api/` chamam `/api/v1` como um cliente externo faria e cobrem:

- **Autenticação:** token, senha errada, token inválido, renovação, erros traduzidos pelo `Accept-Language` e `X-Request-Id`.
- **Perfis:** o que o operador lê e o que só o administrador faz (403).
- **Catálogo:** cadastro com `Location`, nome e SKU repetidos (409), validação campo a campo, filtros, ordenação e paginação.
- **Pedidos e estoque:** pedido pendente não mexe no estoque; confirmar baixa; sem saldo → 409 sem baixar nada; transição inválida e edição de pedido confirmado → 409; só o administrador cancela, e o cancelamento devolve o estoque.

Para rodar no seu computador (precisa do Docker). **Atenção:** o passo 1 recria o banco do Supabase local; o projeto na nuvem não é tocado.

```bash
npm run test:api:setup   # 1. Supabase local, usuários de teste e dados de demonstração
npm run test:api:serve   # 2. compila e liga o app em http://localhost:3100 (deixe rodando)
npm run test:api         # 3. em outro terminal, roda os testes
```

Os testes só aceitam rodar contra `localhost`, porque criam produtos, clientes e pedidos.

## Deploy na Vercel

O app roda na Vercel sem configuração extra (Next.js é detectado sozinho). Só duas variáveis são necessárias, e as duas são públicas: a URL do projeto e a chave publicável. A chave secreta do Supabase não é usada pelo app.

1. Em [vercel.com/new](https://vercel.com/new), importe o repositório `vidaltechnologies/pulsestock`.
2. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://qhkemlxytksotndoxtak.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = a chave publicável (Supabase → Project Settings → API Keys)
3. Clique em **Deploy**.
4. No Supabase, em **Authentication → URL Configuration**, troque o **Site URL** pelo endereço da Vercel (por exemplo `https://pulsestock.vercel.app`). Os e-mails de convite e de recuperação de senha passam a apontar para o site publicado.

Cada push na `main` gera um novo deploy, e cada pull request ganha um endereço de prévia.

## Acessibilidade

As telas principais (login, dashboard, produtos, estoque, clientes, pedidos e usuários) passam sem violações na verificação automática do [axe-core](https://github.com/dequelabs/axe-core) com as regras WCAG 2.1 AA. Para isso o azul dos botões e textos (`--primary`) é um tom um pouco mais escuro do azul da marca, com contraste acima de 4,5:1. Os gráficos têm tooltip e a opção "Ver dados em tabela", e todas as telas funcionam no celular sem rolagem horizontal.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Gera os tipos de rota do Next.js e roda o TypeScript |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:api:setup` / `test:api:serve` / `test:api` | Testes de integração da API contra um Supabase local (veja acima) |
| `npm run postman` | Gera de novo as coleções (pt, en, es) e o ambiente do Postman a partir da especificação |
| `npm run db:start` / `db:stop` | Sobe ou para o Supabase local |
| `npm run db:reset` | Recria o banco local com as migrações |
| `npm run db:test:rls` | Verifica as regras de acesso no projeto vinculado (sem gravar nada) |
| `npm run db:test:stock` | Verifica as regras de saldo de estoque no projeto vinculado (sem gravar nada) |
| `npm run db:test:orders` | Verifica as regras de pedidos no projeto vinculado (sem gravar nada) |
| `npm run db:test:dashboard` | Confere os números do dashboard no projeto vinculado (sem gravar nada) |
| `npm run db:test:users` | Verifica as regras de usuários no projeto vinculado (sem gravar nada) |
| `npm run db:seed` | Carrega os dados de demonstração no projeto vinculado (uma vez só) |
| `npm run db:types` | Gera os tipos TypeScript a partir do projeto Supabase vinculado |
