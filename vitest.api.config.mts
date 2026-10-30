import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Testes de integração da API (npm run test:api): chamam o app de verdade,
// rodando com um Supabase local. Veja scripts/api-test-setup.sh, que grava
// os usuários de teste em .env.test.local.
try {
  process.loadEnvFile(".env.test.local");
} catch {
  // Sem o arquivo (no CI as variáveis vêm do ambiente).
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/api/**/*.test.ts"],
    // Os cenários dependem uns dos outros (pedido → estoque), então em ordem.
    sequence: { concurrent: false },
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
