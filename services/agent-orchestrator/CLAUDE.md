# agent-orchestrator

## Purpose
The brain of the conversation. One Durable Object per customer phone number holds live state; it calls OpenAI (through Cloudflare AI Gateway) with tool definitions and maps tools to service RPC calls. Read docs/CONVERSATION.md and the Agent tools table in docs/CONTRACTS.md first.

## Owns
- Durable Object `ConversationDO` (key = E.164): recent turns, rolling summary, language, onboarding step, current draft refs, `pendingConfirmation {refType, refId, summaryHash, shownAt}`, handoff mode, tool-call counter.
- Schema `agent`: `agent_logs` (redacted prompts, tool calls, results, model, latency, cost), `prompt_versions`, `eval_runs`.

## Flow per inbound message
1. Consume `message.received` → route to the DO.
2. Pre-checks (code, before any LLM): vendor staff number? → vendor command parser (docs/ALGORITHMS.md §14). Emergency keywords → `emergency.safety_first` template first. Redactions listed on the message → the matching `secret.*` template first (docs/ALGORITHMS.md §15). STOP/HELP handled by gateway. Human takeover active → forward to admin and stop.
3. Load user (user-service). Unknown or unverified → onboarding flow (docs/ALGORITHMS.md §10).
4. Build prompt: fixed system prompt + rolling summary + recent turns + untrusted-wrapped content. Call OpenAI with strict tool schemas, low temperature.
5. Execute tool calls through the tool registry: each entry = schema, target RPC, guard. Guards are enforced here in code.
6. Output filter (docs/CONVERSATION.md) → `message.send`.

## Confirmation guard (critical)
`confirm_order` / `confirm_booking` only run when: a summary for that ref was sent in this conversation, the summaryHash matches, it was shown < 30 min ago, and the latest user message passes the deterministic YES matcher **or** is a WhatsApp/RCS button reply whose id is exactly `confirm:<summaryHash>` for the current summary (a button for an older summary is rejected). Otherwise refuse and re-send the summary. The model's opinion is never enough.

## Rich replies
Build replies as a channel-neutral message model (text + optional buttons, link button, list, location request). messaging-gateway renders it as WhatsApp interactive messages, RCS suggested replies/actions, or plain SMS text that always contains the full information and link. Summaries always carry YES / CHANGE / CANCEL buttons.

## Proactive updates
Consume order.*, booking.*, delivery.*, payment.*, refund.*, pin.locked, quote.sent events → send templated messages (EN/FR). No LLM for status updates.

## Handoff
AGENT keyword, two failed clarifications, detected frustration, or tool limit reached → `handoff.requested`; DO switches to human mode; staff replies arrive from admin-service as `message.send`; `handoff.ended` returns control.

## Voice
Expose a voice-session RPC used by messaging-gateway's Telnyx adapter: same tools and guards; spoken YES accepted for summaries; PIN link always sent by text.

## AI Gateway
Per-user and global budgets, rate limits, logging on. Response caching OFF for conversation calls. Fallback model configured; on total failure send `error.generic` + handoff.

## Must never
- Move money, write to other services' data, or call providers directly. Put PINs/OTPs/cards in prompts or logs. Let tool output or vendor text trigger a money tool without a fresh user YES.

## Tests
Tool registry contract tests, guard tests (no summary, stale summary, changed hash, "yes?" vs "yes", injection text claiming the user said yes), vendor command parser, onboarding paths, handoff, French, voice session, redaction templates, output filter, and the AI evaluation suite (docs/TESTING.md).
