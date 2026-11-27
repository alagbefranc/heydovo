import { CORRELATION_HEADER } from "./correlation";

/** JSON response that always echoes the correlationId and is never cached. */
export function json(body: unknown, status: number, correlationId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      [CORRELATION_HEADER]: correlationId,
    },
  });
}
