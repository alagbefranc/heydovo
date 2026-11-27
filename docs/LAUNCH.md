# Hey Dovo — Launch track (the work that is not code)

These run alongside docs/BUILD_PLAN.md. Each has an owner, a point in the build where it must start, and a clear "done". Step 23 checks every line.

## Before step 4 (the website)
| Item | Owner | Done when |
|------|-------|-----------|
| Legal drafts updated with the decisions of 2026-11-27 | You + lawyer | Terms, Privacy, Refunds and Vendor Terms (EN/FR) approved, each with a version and effective date, and handed over for `apps/website` |

Wording the drafts must now cover:
- Delivery fee: the customer pays the fee quoted; the platform absorbs increases and keeps decreases. Remove "at cost".
- Wallet: the $50, 24-hour limit after a PIN change; the block after a SIM change; freezing an account ("this wasn't me") and how it is lifted; what happens on a chargeback.
- Tracking links show status only. Pickup codes are sent only in the chat.
- Text commands for vendors: which need a code, and that actions by text and in the dashboard are the same.
- Privacy: conversations kept 12 months; what is erased and what is kept on closing an account, and why; data in backups; processors and countries (OpenAI, Telnyx, Stripe, Uber, Cloudflare); the AI disclosure; website analytics.
- Meta Muse: how linking works, that links are texted to the phone, how to unlink.
- Couriers: Uber Direct only, and what is shared with it.

## Right after step 4 (the website is live)
Provider approvals take weeks and most ask for a live website with privacy and terms pages. Start them all the day the site is up.

| Approval | Owner | Needed before |
|----------|-------|---------------|
| Telnyx RCS agent: Google brand verification and Canadian carrier launch | You | step 8 testing on real phones |
| Telnyx SMS sender registration for the Canadian number | You | step 8 |
| WhatsApp: Meta business verification, display name, the customer templates and the vendor templates (services/messaging-gateway/CLAUDE.md) | You | step 8 for customers, step 17 for vendors |
| Telnyx Voice AI and Number Lookup access in Canada | You | step 6 (lookup), step 21 (voice) |
| Stripe: account activation, Connect account type, live mode | You | step 12 |
| Uber Direct: production access, webhook signing, billing terms | You | step 10 |
| Supabase: production project in a Canadian region, plan with point-in-time recovery | You | step 3 for staging, step 23 for production |
| Meta Muse connector submission | You + Claude | after step 22 |

Done when: every application is submitted, with its date and status kept in this table.

## Money and reporting
| Item | Owner | Start | Done when |
|------|-------|-------|-----------|
| Tax on items and on the two fees; who remits; tax on commission | Accountant | now | written answer, values in config |
| Wallet: FINTRAC and provincial prepaid rules; segregated account | Lawyer | now | written advice; limits in config |
| CRA reporting for digital platform operators (yearly report on sellers) [CONFIRM that Hey Dovo is a reporting platform operator, the thresholds and the format] | Accountant | before step 9 | written answer on what to collect from vendors and when to file |
| Refund threshold for two approvals; chargeback account policy | You | before step 12 | values in config |

If the reporting rules apply: vendor-service collects each seller's legal name, address, tax number (business number, or SIN for an individual) and date of birth for individuals at onboarding (step 9), stores the tax number encrypted and visible to the finance role only; the wallet supplies amounts paid and fees per quarter; admin-service produces the yearly file and a copy for each vendor (step 19).

## Privacy and security (checked in step 23)
| Item | Owner | Done when |
|------|-------|-----------|
| Privacy officer named; contact published | You | name on the Privacy page |
| Privacy impact assessment, including transfers outside Canada and Quebec | You + lawyer | signed |
| Data processing terms with OpenAI, Telnyx, Stripe, Uber, Cloudflare, Supabase, Sentry | You | signed or accepted, listed here |
| Breach response runbook and incident register | You + Claude | written in `docs/runbooks/`, rehearsed once |
| Penetration test | You | booked before step 23, passed with no Critical or High open |
| Identity check script for support (docs/ALGORITHMS.md §18) | You + lawyer | approved |

## Operations (built in step 3, proven in step 23)
| Item | Owner | Done when |
|------|-------|-----------|
| Production accounts: Cloudflare, Supabase, Stripe live, Telnyx, Uber Direct, OpenAI, Sentry; 2FA and named owners on each; one break-glass login | You | accounts exist; access list kept here |
| GitHub: `main` branch with protection, environments dev / staging / prod with required reviewers, deploy secrets per environment | You + Claude | protections on; no shared secrets between environments |
| Monitoring and on-call: tool, who is on call, alert routes | You | a test alert reaches the on-call person |
| Backups and restore: recovery targets agreed, restore rehearsed in staging, timed drill before launch | Claude + You | drill meets the targets |
| Secret rotation: runbook per secret, one full rotation rehearsed | Claude + You | rehearsal done in staging |
| Production Terraform: applied through CI with manual approval, no secrets in state | Claude + You | plan reviewed and applied |
