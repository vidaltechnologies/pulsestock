# Pulse Stock

Mini ERP de estoque e pedidos de venda, feito como projeto de portfólio.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase (PostgreSQL + Auth) · Zod · Recharts

## Status

| Etapa | Conteúdo | Situação |
| --- | --- | --- |
| 0 | Base Next.js, Tailwind, shadcn/ui e identidade visual | Concluída |
| 1 | Esquema do banco (enums, tabelas, restrições, índices) e tipos TypeScript | Concluída |
| 2 | Autenticação com Supabase Auth | A fazer |
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
npm run db:types   # gera src/types/database.ts
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

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Gera os tipos de rota do Next.js e roda o TypeScript |
| `npm run db:start` / `db:stop` | Sobe ou para o Supabase local |
| `npm run db:reset` | Recria o banco local com as migrações |
| `npm run db:types` | Gera os tipos TypeScript a partir do banco local |
