import type { z } from "zod";

import { AppError } from "./errors";

export interface ValidationIssue {
  path: string;
  message: string;
}

/**
 * Validates untrusted input at a boundary with a zod schema (docs/SECURITY.md: zod at every
 * boundary). On failure throws a 400 AppError that lists where the input was wrong, never the
 * rejected values themselves, so secrets in a bad request cannot echo back or reach the logs.
 */
export function parseInput<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.output<Schema> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
  throw new AppError("VALIDATION_FAILED", 400, "Invalid input", { issues });
}
