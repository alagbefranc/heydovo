import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AppError, toErrorBody } from "../src/lib/errors";
import { parseInput } from "../src/lib/validate";

const requestId = "0193a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b";

describe("toErrorBody", () => {
  it("keeps an AppError's code, status, message and details", () => {
    const error = new AppError("INSUFFICIENT_FUNDS", 402, "Not enough funds", { shortCents: 250 });
    expect(toErrorBody(error, requestId)).toEqual({
      status: 402,
      body: {
        error: {
          code: "INSUFFICIENT_FUNDS",
          message: "Not enough funds",
          requestId,
          details: { shortCents: 250 },
        },
      },
    });
  });

  it("leaves out details when there are none", () => {
    const { body } = toErrorBody(new AppError("NOT_FOUND", 404, "Not found"), requestId);
    expect("details" in body.error).toBe(false);
  });

  it.each([new Error("db password is hunter2"), "a string", null, undefined, { any: "thing" }])(
    "turns an unexpected error (%j) into a generic 500 without leaking it",
    (thrown) => {
      const { status, body } = toErrorBody(thrown, requestId);
      expect(status).toBe(500);
      expect(body).toEqual({
        error: { code: "INTERNAL_ERROR", message: "Something went wrong", requestId },
      });
    },
  );
});

describe("parseInput", () => {
  const Schema = z.object({ amountCents: z.int().positive(), note: z.string().optional() });

  it("returns the parsed value when the input is valid", () => {
    expect(parseInput(Schema, { amountCents: 250 })).toEqual({ amountCents: 250 });
  });

  it("throws a 400 VALIDATION_FAILED that says where, not what", () => {
    let thrown: unknown;
    try {
      parseInput(Schema, { amountCents: "4821-secret", note: 7 });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AppError);
    const error = thrown as AppError;
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.status).toBe(400);
    const paths = (error.details as { issues: { path: string }[] }).issues.map((i) => i.path);
    expect(paths).toEqual(["amountCents", "note"]);
    expect(JSON.stringify(error.details)).not.toContain("4821-secret");
  });
});
