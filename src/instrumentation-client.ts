import * as Sentry from "@sentry/nextjs";

import { getSentryOptions } from "@/lib/monitoring/options";

// Erros e navegação no navegador.
Sentry.init(getSentryOptions());

// Mede cada navegação do App Router como uma transação de performance.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
