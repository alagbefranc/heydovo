import { WorkerEntrypoint } from "cloudflare:workers";
import { z } from "zod";

import { correlationIdFrom } from "./lib/correlation";
import { methodNotAllowed, notFound, toErrorBody } from "./lib/errors";
import { json } from "./lib/http";
import { createLogger } from "./lib/logger";
import { parseInput } from "./lib/validate";

/**
 * Worker template. Copy this folder to start a service (docs/BUILD_PLAN.md).
 *
 * Shape every service follows:
 * - The default export handles HTTP only (`fetch`) and has no RPC methods.
 * - Other Workers call a named `WorkerEntrypoint` over a service binding. Give each calling
 *   Worker its own entrypoint class that exposes only the methods that caller may use, and build
 *   them by composition: RPC exposes inherited methods, so never extend another caller's class.
 * - Validate every input with zod, log through the structured logger, carry the correlationId.
 */

const PingInput = z.object({
  correlationId: z.uuid(),
  message: z.string().min(1).max(200),
});

export interface PingOutput {
  service: string;
  echo: string;
}

/** Example internal API. Replace `ping` with the service's real RPC methods. */
export class InternalApi extends WorkerEntrypoint<Env> {
  ping(input: unknown): PingOutput {
    const { correlationId, message } = parseInput(PingInput, input);
    const log = createLogger({ service: this.env.SERVICE_NAME, correlationId });
    log.info("ping received");
    return { service: this.env.SERVICE_NAME, echo: message };
  }
}

interface RouteResult {
  status: number;
  body: unknown;
}

function route(request: Request, env: Env): RouteResult {
  const { pathname } = new URL(request.url);
  if (pathname === "/health") {
    if (request.method !== "GET") throw methodNotAllowed();
    return {
      status: 200,
      body: { status: "ok", service: env.SERVICE_NAME, environment: env.ENVIRONMENT },
    };
  }
  throw notFound();
}

export default {
  fetch(request, env): Response {
    const correlationId = correlationIdFrom(request);
    const log = createLogger({ service: env.SERVICE_NAME, correlationId });
    try {
      const { status, body } = route(request, env);
      return json(body, status, correlationId);
    } catch (error) {
      const { status, body } = toErrorBody(error, correlationId);
      if (status >= 500) log.error("request failed", { error });
      return json(body, status, correlationId);
    }
  },
} satisfies ExportedHandler<Env>;
