import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { uuidv7 } from "../src/lib/ids";
import type { PingOutput } from "../src/index";

/**
 * An RPC call returns a special thenable. Awaiting it inside an async function turns it into an
 * ordinary promise, so a rejection is handled once and Vitest sees no stray unhandled rejection.
 */
async function ping(input: unknown): Promise<PingOutput> {
  return await exports.InternalApi.ping(input);
}

const invalid = { code: "VALIDATION_FAILED", status: 400, message: "Invalid input" };

describe("InternalApi.ping (RPC over a service binding)", () => {
  it("echoes a valid message", async () => {
    const result = await ping({ correlationId: uuidv7(), message: "hello" });
    expect(result).toEqual({ service: "worker-template", echo: "hello" });
  });

  it("rejects a missing correlation id and keeps the error code across the RPC boundary", async () => {
    await expect(ping({ message: "hello" })).rejects.toMatchObject(invalid);
  });

  it("rejects an empty or oversized message", async () => {
    const correlationId = uuidv7();
    await expect(ping({ correlationId, message: "" })).rejects.toMatchObject(invalid);
    await expect(ping({ correlationId, message: "x".repeat(201) })).rejects.toMatchObject(invalid);
  });

  it("rejects input that is not an object", async () => {
    await expect(ping("hello")).rejects.toMatchObject(invalid);
    await expect(ping(null)).rejects.toMatchObject(invalid);
  });

  it("does not echo rejected values back in the error", async () => {
    const attempt = ping({ correlationId: "4821-my-pin", message: "hello" });
    await expect(attempt).rejects.toMatchObject(invalid);
    await attempt.catch((error: unknown) => {
      expect(JSON.stringify(error)).not.toContain("4821-my-pin");
    });
  });
});
