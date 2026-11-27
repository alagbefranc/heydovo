import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { CORRELATION_HEADER } from "../src/lib/correlation";
import type { ErrorBody } from "../src/lib/errors";
import { isUuid } from "../src/lib/ids";

const call = (path: string, init?: RequestInit): Promise<Response> =>
  exports.default.fetch(new Request(`https://worker.test${path}`, init));

describe("GET /health", () => {
  it("reports ok with the service name and environment", async () => {
    const response = await call("/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      service: "worker-template",
      environment: "local",
    });
  });

  it("is JSON, is never cached and carries a correlation id", async () => {
    const response = await call("/health");
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(isUuid(response.headers.get(CORRELATION_HEADER) ?? "")).toBe(true);
  });
});

describe("correlation id", () => {
  it("keeps a well-formed incoming id", async () => {
    const id = "0193a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b";
    const response = await call("/health", { headers: { [CORRELATION_HEADER]: id } });
    expect(response.headers.get(CORRELATION_HEADER)).toBe(id);
  });

  it("lower-cases an incoming id", async () => {
    const id = "0193A1B2-C3D4-7E5F-8A6B-7C8D9E0F1A2B";
    const response = await call("/health", { headers: { [CORRELATION_HEADER]: id } });
    expect(response.headers.get(CORRELATION_HEADER)).toBe(id.toLowerCase());
  });

  it("replaces an incoming id that is not a UUID", async () => {
    const response = await call("/health", {
      headers: { [CORRELATION_HEADER]: 'x"}; DROP TABLE logs; --' },
    });
    const returned = response.headers.get(CORRELATION_HEADER) ?? "";
    expect(isUuid(returned)).toBe(true);
    expect(returned).not.toContain("DROP");
  });
});

describe("errors", () => {
  it("answers an unknown path with the standard 404 shape", async () => {
    const response = await call("/nope");
    const body = await response.json<ErrorBody>();
    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Not found");
    expect(body.error.requestId).toBe(response.headers.get(CORRELATION_HEADER));
  });

  it("answers the wrong method on /health with 405", async () => {
    const response = await call("/health", { method: "POST" });
    const body = await response.json<ErrorBody>();
    expect(response.status).toBe(405);
    expect(body.error.code).toBe("METHOD_NOT_ALLOWED");
  });
});
