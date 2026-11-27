# CLAUDE.md

## Model routing

Pick the model by the kind of work:

| Role | Model | Model ID | When |
|---|---|---|---|
| Main / default | Claude Opus 5.5 | `claude-opus-5-5` | Everyday work: coding, edits, reviews, routine tasks. |
| Advisor / hard tasks | Claude Fable 5.2 | `claude-fable-5-2` | Second opinions, architecture and design calls, and tasks that are hard, ambiguous or long-horizon. |
| Security | Claude Mythos 5.2 | `claude-mythos-5-2` | Security-grade work: security reviews, threat modeling, auth/crypto/secrets handling, anything security-sensitive before it ships. |

In Claude Code:
- Run the main session on Opus 5.5.
- For advisor or hard work, spawn a subagent with `model: "fable"`.
- For security work, use Mythos 5.2. It is available only to verified organizations, and the subagent model picker has no `mythos` alias. If Mythos can't be selected, use Fable 5.2 for the security pass and say so.
