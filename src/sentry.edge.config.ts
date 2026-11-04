import * as Sentry from "@sentry/nextjs";

import { getSentryOptions } from "@/lib/monitoring/options";

Sentry.init(getSentryOptions());
