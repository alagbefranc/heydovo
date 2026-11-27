import { isUuid, uuidv7 } from "./ids";

export const CORRELATION_HEADER = "x-correlation-id";

/**
 * Every request and event carries a correlationId so one customer action can be traced across
 * services (docs/ARCHITECTURE.md). An incoming id is untrusted input: accept it only when it is a
 * well-formed UUID, otherwise start a new one. This keeps arbitrary text out of logs and headers.
 */
export function correlationIdFrom(request: Request): string {
  const incoming = request.headers.get(CORRELATION_HEADER)?.toLowerCase();
  return incoming !== undefined && isUuid(incoming) ? incoming : uuidv7();
}
