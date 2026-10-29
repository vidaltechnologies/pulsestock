# Pulse Stock

Mini ERP de estoque e pedidos de venda, feito como projeto de portfólio.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase (PostgreSQL + Auth) · Zod · Recharts

## Status

| Etapa | Conteúdo | Situação |
| --- | --- | --- |
| 0 | Base Next.js, Tailwind, shadcn/ui e identidade visual | Concluída |
| 1 | Esquema do banco (enums, tabelas, restrições, índices) e tipos TypeScript | Concluída |
| 2 | Login com Supabase Auth, proxy de sessão e layout logado | Concluída |
| 3 | Perfis de acesso e políticas RLS | A fazer |
| 4–9 | Produtos, estoque, clientes, pedidos, dashboard, usuários | A fazer |
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

O estoque é baixado quando o pedido é confirmado. O RLS está ativado em todas as tabelas; as políticas por perfil entram na etapa 3.

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

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Gera os tipos de rota do Next.js e roda o TypeScript |
| `npm run db:start` / `db:stop` | Sobe ou para o Supabase local |
| `npm run db:reset` | Recria o banco local com as migrações |
| `npm run db:types` | Gera os tipos TypeScript a partir do projeto Supabase vinculado |
