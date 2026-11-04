import type { ErrorEvent } from "@sentry/nextjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getSentryOptions, scrubEvent } from "./options";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSentryOptions", () => {
  it("fica desligado sem DSN", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    expect(getSentryOptions()).toMatchObject({ enabled: false, dsn: undefined, sendDefaultPii: false });
  });

  it("liga com DSN e amostra 10% em produção", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://abc@o1.ingest.sentry.io/1");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE", "");
    expect(getSentryOptions()).toMatchObject({
      enabled: true,
      environment: "production",
      tracesSampleRate: 0.1,
    });
  });

  it("aceita a amostragem configurada e ignora valores inválidos", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE", "0.5");
    expect(getSentryOptions().tracesSampleRate).toBe(0.5);
    vi.stubEnv("NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE", "2");
    expect(getSentryOptions().tracesSampleRate).toBe(0.1);
  });
});

describe("scrubEvent", () => {
  it("tira credenciais e dados pessoais do evento", () => {
    const event = scrubEvent({
      type: undefined,
      request: {
        url: "https://app.test/auth/confirm?token_hash=x&code=segredo&next=/",
        query_string: "code=segredo&page=2",
        headers: { Authorization: "Bearer abc", Cookie: "sb=1", "user-agent": "vitest" },
        cookies: { sb: "1" },
        data: { password: "123" },
      },
      user: { id: "u1", email: "a@b.com", ip_address: "1.2.3.4", role: "admin" },
    } as ErrorEvent);

    expect(event.request?.headers).toEqual({
      Authorization: "[Filtered]",
      Cookie: "[Filtered]",
      "user-agent": "vitest",
    });
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.data).toBeUndefined();
    expect(event.request?.url).toBe("https://app.test/auth/confirm?token_hash=[Filtered]&code=[Filtered]&next=/");
    expect(event.request?.query_string).toBe("code=[Filtered]&page=2");
    expect(event.user).toEqual({ id: "u1", role: "admin" });
  });
});
