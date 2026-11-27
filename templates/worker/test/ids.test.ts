import { describe, expect, it } from "vitest";

import { isUuid, uuidv7 } from "../src/lib/ids";

describe("uuidv7", () => {
  it("is a well-formed version 7 UUID", () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(isUuid(id)).toBe(true);
  });

  it("starts with the timestamp in milliseconds", () => {
    const now = Date.UTC(2026, 10, 27, 12, 0, 0);
    const id = uuidv7(now);
    const timestampHex = id.replaceAll("-", "").slice(0, 12);
    expect(Number.parseInt(timestampHex, 16)).toBe(now);
  });

  it("sorts by creation time", () => {
    const earlier = uuidv7(1_800_000_000_000);
    const later = uuidv7(1_800_000_000_001);
    expect(earlier < later).toBe(true);
  });

  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => uuidv7()));
    expect(ids.size).toBe(2000);
  });
});

describe("isUuid", () => {
  it.each([
    "",
    "not-a-uuid",
    "0193a1b2c3d47e5f8a6b7c8d9e0f1a2b",
    "0193a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2",
    "0193A1B2-C3D4-7E5F-8A6B-7C8D9E0F1A2B",
    "0193a1b2-c3d4-7e5f-ca6b-7c8d9e0f1a2b",
  ])("rejects %j", (value) => {
    expect(isUuid(value)).toBe(false);
  });
});
