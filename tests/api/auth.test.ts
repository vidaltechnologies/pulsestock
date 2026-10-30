import { beforeAll, describe, expect, it } from "vitest";

import { ADMIN, api, login, OPERATOR } from "./client";

describe("autenticação", () => {
  let admin: { accessToken: string; refreshToken: string };

  beforeAll(async () => {
    admin = await login(ADMIN);
  });

  it("gera token com e-mail e senha e devolve o perfil", async () => {
    const { status, headers, body } = await api("/auth/token", { method: "POST", body: OPERATOR });
    expect(status).toBe(200);
    expect(headers.get("cache-control")).toContain("no-store");
    expect(body.data).toMatchObject({ tokenType: "Bearer", user: { email: OPERATOR.email, role: "operator" } });
    expect(body.data.accessToken).toEqual(expect.any(String));
    expect(body.data.refreshToken).toEqual(expect.any(String));
  });

  it("recusa senha errada com 401 invalid_credentials", async () => {
    const { status, body } = await api("/auth/token", {
      method: "POST",
      body: { email: ADMIN.email, password: "senha-errada" },
    });
    expect(status).toBe(401);
    expect(body.error.code).toBe("invalid_credentials");
  });

  it("valida o corpo e traduz os erros pelo Accept-Language", async () => {
    const { status, body } = await api("/auth/token", {
      method: "POST",
      body: {},
      headers: { "Accept-Language": "en" },
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe("validation_error");
    expect(body.error.details.email).toEqual(["Enter your email."]);
  });

  it("aceita o token no cabeçalho Authorization", async () => {
    const { status, body } = await api("/me", { token: admin.accessToken });
    expect(status).toBe(200);
    expect(body.data).toMatchObject({ email: ADMIN.email, role: "admin" });
  });

  it("responde 401 sem token e com token inválido", async () => {
    const none = await api("/me");
    expect(none.status).toBe(401);
    expect(none.body.error.code).toBe("unauthorized");

    const invalid = await api("/me", { token: "token inválido" });
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.code).toBe("invalid_token");
  });

  it("renova o token com o refreshToken", async () => {
    const session = await login(OPERATOR);
    const { status, body } = await api("/auth/refresh", {
      method: "POST",
      body: { refreshToken: session.refreshToken },
    });
    expect(status).toBe(200);
    expect(body.data.refreshToken).not.toBe(session.refreshToken);

    const me = await api("/me", { token: body.data.accessToken });
    expect(me.body.data.email).toBe(OPERATOR.email);
  });

  it("recusa refreshToken desconhecido", async () => {
    const { status, body } = await api("/auth/refresh", { method: "POST", body: { refreshToken: "nao-existe" } });
    expect(status).toBe(401);
    expect(body.error.code).toBe("invalid_refresh_token");
  });

  it("devolve X-Request-Id e respeita o id enviado", async () => {
    const generated = await api("/me", { token: admin.accessToken });
    expect(generated.headers.get("x-request-id")).toMatch(/^[\w.-]+$/);

    const sent = await api("/me", { token: admin.accessToken, headers: { "X-Request-Id": "teste-123" } });
    expect(sent.headers.get("x-request-id")).toBe("teste-123");
  });
});
