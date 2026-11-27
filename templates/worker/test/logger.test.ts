import { describe, expect, it } from "vitest";

import { createLogger } from "../src/lib/logger";

function capture(): { lines: Record<string, unknown>[]; sink: (line: string) => void } {
  const lines: Record<string, unknown>[] = [];
  return {
    lines,
    sink: (line) => {
      lines.push(JSON.parse(line) as Record<string, unknown>);
    },
  };
}

const options = {
  service: "worker-template",
  correlationId: "0193a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b",
};

describe("createLogger", () => {
  it("writes one JSON line with level, message, service, correlationId and time", () => {
    const { lines, sink } = capture();
    createLogger({ ...options, sink }).info("order created", { orderRef: "D4821" });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: "info",
      message: "order created",
      service: "worker-template",
      correlationId: options.correlationId,
      orderRef: "D4821",
    });
    expect(Number.isNaN(Date.parse(String(lines[0]?.["time"])))).toBe(false);
  });

  it.each(["debug", "info", "warn", "error"] as const)("supports the %s level", (level) => {
    const { lines, sink } = capture();
    createLogger({ ...options, sink })[level]("hello");
    expect(lines[0]?.["level"]).toBe(level);
  });

  it("redacts secret-looking fields at any depth", () => {
    const { lines, sink } = capture();
    createLogger({ ...options, sink }).warn("check", {
      pin: "4821",
      userPin: "4821",
      otpCode: "482913",
      linkToken: "abc",
      Authorization: "Bearer abc",
      nested: { cardNumber: "4242424242424242", password: "hunter2", keep: "visible" },
      list: [{ apiKey: "k" }, { name: "ok" }],
    });

    const line = JSON.stringify(lines[0]);
    for (const secret of ["4821", "482913", "abc", "4242424242424242", "hunter2"]) {
      expect(line).not.toContain(secret);
    }
    expect(lines[0]).toMatchObject({
      pin: "[REDACTED]",
      nested: { keep: "visible", password: "[REDACTED]" },
      list: [{ apiKey: "[REDACTED]" }, { name: "ok" }],
    });
  });

  it("logs an Error as its name and message only", () => {
    const { lines, sink } = capture();
    createLogger({ ...options, sink }).error("failed", { error: new TypeError("boom") });
    expect(lines[0]?.["error"]).toEqual({ name: "TypeError", message: "boom" });
  });

  it("never lets fields overwrite service, correlationId, level or message", () => {
    const { lines, sink } = capture();
    createLogger({ ...options, sink }).info("real", {
      service: "spoofed",
      correlationId: "spoofed",
      level: "spoofed",
      message: "spoofed",
    });
    expect(lines[0]).toMatchObject({
      service: "worker-template",
      correlationId: options.correlationId,
      level: "info",
      message: "real",
    });
  });

  it("truncates very deep objects instead of failing", () => {
    const { lines, sink } = capture();
    const deep = { a: { b: { c: { d: { e: { f: { g: { h: "too deep" } } } } } } } };
    createLogger({ ...options, sink }).info("deep", deep);
    expect(JSON.stringify(lines[0])).toContain("[TRUNCATED]");
    expect(JSON.stringify(lines[0])).not.toContain("too deep");
  });
});
