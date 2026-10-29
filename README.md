# Pulse Stock

Mini ERP de estoque e pedidos de venda, feito como projeto de portfólio.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase (PostgreSQL + Auth) · Zod · Recharts

## Status

| Etapa | Conteúdo | Situação |
| --- | --- | --- |
| 0 | Base Next.js, Tailwind, shadcn/ui e identidade visual | Concluída |
| 1 | Esquema do banco (enums, tabelas, restrições, índices) e tipos TypeScript | Concluída |
| 2 | Login com Supabase Auth, proxy de sessão e layout logado | Concluída |
| 3 | Perfis de acesso e políticas RLS | Concluída |
| 4 | Produtos e categorias: API, listagem com busca e cadastro | Concluída |
| 5–9 | Estoque, clientes, pedidos, dashboard, usuários | A fazer |
| 10 | Seed de demonstração, CI e deploy | A fazer |

## Requisitos

- Node.js 20.9 ou superior
- Docker, para rodar o Supabase localmente (opcional)

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencha a chave publicável do Supabase
npm run dev                  # http://localhost:3000
```

## Banco de dados

As migrações ficam em `supabase/migrations/`. A Supabase CLI já vem como dependência de desenvolvimento.

**Supabase local (Docker):**

```bash
npm run db:start   # sobe o Supabase local
npm run db:reset   # recria o banco aplicando as migrações
```

**Projeto na nuvem:**

```bash
npx supabase login
npx supabase link --project-ref qhkemlxytksotndoxtak
npx supabase db push
```

`login` e `link` pedem o token de acesso e a senha do banco no seu terminal. Eles não devem ser salvos no repositório.

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
| `POST /api/auth/login` | `{ email, password }` validado com Zod. 401 para credenciais erradas, 403 para usuário desativado |
| `POST /api/auth/logout` | Encerra a sessão |
| `GET /api/me` | Usuário logado e perfil (401 sem sessão) |

## Perfis de acesso

As regras ficam no banco (RLS e privilégios por coluna, em `supabase/migrations/20261029000003_rls_policies.sql`) e são repetidas no app para mostrar só o que cada perfil pode fazer.

| Recurso | Administrador | Operador |
| --- | --- | --- |
| Perfis | Lê todos; altera nome, perfil e status | Lê o próprio |
| Produtos e categorias | Cria, edita e inativa | Consulta |
| Estoque | Entradas, saídas manuais e ajustes | Entradas |
| Clientes | Cria, edita e inativa | Cria e edita |
| Pedidos e itens | Cria e edita enquanto pendente | Cria e edita enquanto pendente |

- Sem login (`anon`) e com perfil inativo, nenhuma tabela é acessível.
- Nada é excluído fisicamente, exceto itens de pedido pendente. Registros são inativados.
- Saldo de estoque, status e total do pedido não podem ser alterados direto pela API. Eles mudam só pelas funções das etapas de estoque e pedidos.

Para conferir as regras no banco, rode `npm run db:test:rls`. O script `supabase/tests/rls_check.sql` cria usuários e dados de teste dentro de uma transação, testa 45 operações por perfil e desfaz tudo no final.

## Produtos

Telas em `/produtos` (lista com busca por nome ou SKU, filtro por categoria e status, paginação de 20 itens), `/produtos/novo`, `/produtos/{id}` e `/produtos/categorias`. O operador só consulta; cadastro, edição, inativação e categorias são do administrador.

| Rota | Uso | Perfil |
| --- | --- | --- |
| `GET /api/products` | Lista. Filtros: `q`, `categoryId`, `status` (`active`, `inactive`, `all`), `page`, `pageSize` (até 100) | Ambos |
| `POST /api/products` | Cadastra. Corpo: `sku`, `name`, `salePrice` e opcionais `description`, `categoryId`, `unit`, `costPrice`, `minStock` | Admin |
| `GET /api/products/{id}` | Detalhe | Ambos |
| `PATCH /api/products/{id}` | Edição parcial. Inativar: `{ "active": false }` | Admin |
| `GET /api/categories` · `POST /api/categories` | Lista e cadastra categorias (`{ "name" }`) | Ambos · Admin |

- Erros seguem `{ error: { code, message, details } }`: 400 com mensagens por campo, 401, 403, 404 e 409 para SKU ou categoria repetidos.
- O saldo (`stockQuantity`) é só leitura: o produto nasce com zero e o saldo muda pelas movimentações de estoque (etapa 5).
- A validação fica em `src/lib/validations/product.ts` e é a mesma no formulário e na API. Os testes estão em `product.test.ts` (`npm test`).

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Gera os tipos de rota do Next.js e roda o TypeScript |
| `npm test` | Testes unitários (Vitest) |
| `npm run db:start` / `db:stop` | Sobe ou para o Supabase local |
| `npm run db:reset` | Recria o banco local com as migrações |
| `npm run db:test:rls` | Verifica as regras de acesso no projeto vinculado (sem gravar nada) |
| `npm run db:types` | Gera os tipos TypeScript a partir do projeto Supabase vinculado |
