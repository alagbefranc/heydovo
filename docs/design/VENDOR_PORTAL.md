# Vendor dashboard — design (ahead of Step 18)

Design canvas: https://claude.ai/artifact/Jkym5jTFYVxSGZMFRczMZR (private to its owner until shared).
Status: a design to review, not built. Redrawn on 2026-11-28 in the Hey Dovo brand as published on heydovo.com (the first version used a look that was not the brand's). Nothing here is code for the product. Rules it follows: docs/ALGORITHMS.md §14, §17, §18, §19 and docs/CONVERSATION.md ("Guiding principle").

## Screens on the canvas
| # | Screen | What it settles |
|---|--------|-----------------|
| 1 | Orders inbox (phone) | Live inbox: store status and Pause in the header, four status tabs, a new-order card with a countdown and Accept / Decline, and "Just handled" rows that say who acted and by which channel |
| 2 | Order detail (phone) | Uber Direct card (status sentence + four steps), items, and a timeline where every step shows who and how: By text, WhatsApp, Dashboard, Automatic |
| 3 | First action wins (phone) | A calm notice when someone else got there first ("Kwame already accepted this order … on WhatsApp at 3:42 pm"), then the next action (Mark ready) |
| 4 | Decline with a reason (phone) | Bottom sheet, four reasons, what happens to the customer, and a way out to a substitute |
| 5 | Substitution (phone) | Out-of-stock sheet: swap options with prices, "No substitute", and what the customer is asked |
| 6 | Pickup code (phone) | One large code field, forgiving input, the text alternative, "Customer has no code" |
| 7 | Orders by text (phone) | The verified phone, the "codes needed until" state with "This wasn't me", and which commands need a code |
| 8 | French, store paused (phone) | French copy and number formats; a paused store with who paused it and how, Resume, orders in progress still actionable |
| 9 | Inbox and order (desktop) | Sidebar, live notice when an order was handled by text, list + detail, Mark ready, courier card before booking, timeline |
| 10 | Team and alerts (desktop) | Roles, phone verification status per person, who gets new-order alerts per channel, what each role can do |
| 11 | Payouts and statements (desktop) | Next payout, 7-day hold, disputes, payouts table, statement download (owner only) |

Not drawn yet, same components: the Pause confirmation, entering a phone number and its OTP, the "text commands paused until …" variant of the screen 7 card, trade bookings, catalogue, hours, reviews, disputes.

## Every text command has a dashboard action
| By text | In the dashboard | Screen |
|---------|------------------|--------|
| YES | Accept | 1 |
| NO + reason | Decline, then pick a reason | 4 |
| READY | Mark ready | 3, 8, 9 |
| PICKED + code | Confirm pickup with the code | 6 |
| PAUSE / RESUME | Pause store / Resume (header) | 1, 8, 9 |
| (dashboard only at launch) | Offer a substitute | 5 |

No dashboard action ever asks for a reply code: the signed-in session with 2FA is the proof. Codes exist only for SMS.

## Behaviour the build must keep
- **Live.** The inbox updates without a reload. An action taken by text appears at once, with a short notice (screen 9) and a "Just handled" row (screen 1).
- **Who and how.** Every activity entry and every "Just handled" row names the person and the channel in words. The activity list reads as a conversation: an action taken by message (text or WhatsApp) is a periwinkle bubble on the right, an action taken in the dashboard is a grey bubble on the left, and automatic events are a centred line. Position and colour repeat what the words say; they never carry it alone.
- **First action wins.** A late tap gets the notice on screen 3: neutral colour, who, channel, time, "nothing was lost", one OK button, then the next useful action. It is not an error.
- **Countdown.** New orders show time left to accept; the card moves to the top as it runs low. No sound or flashing beyond the push alert.
- **Text command state** (screen 7): three states of one card. Normal: no card. "Codes needed until 4:15 pm": a dark card in the page header, with the reason and "This wasn't me". "Text commands paused until 4:15 pm": same card, same button, text says the dashboard and WhatsApp still work.
- **Store paused** (screen 8): the header says "Store paused" on every page, a periwinkle notice says who paused and how, and Resume sits in the header as a light pill. Orders in progress stay fully actionable, and "Mark ready" stays the blue button.
- **Phone verification.** Each person verifies their own number after signing in (number, then a 6-digit code). The team table only shows the status; an owner cannot verify for someone else.
- **Roles.** Hide what a role cannot do; the API still enforces it. Staff: accept, decline, substitute, ready, pickup codes. Manager: plus pause, resume, catalogue, hours, alert recipients. Owner: plus team, payouts, statements, bank account.
- **Uber Direct.** One card, a plain sentence first ("Kofi is on the way to you. Arrives about 4:05 pm."), then four steps: Requested, Assigned, Picked up, Delivered. Before booking it says a courier is requested when the order is marked ready.

## Tokens (read from heydovo.com on 2026-11-28)
The source is the live landing page: its colours, fonts, radii, buttons and logo files. Nothing here was invented, apart from the three values marked "derived". If the Figma file says otherwise, the Figma file wins.

| Token | Value | Use |
|-------|-------|-----|
| `color.ink` | `#111B28` | text; the dark header (phone) and sidebar (desktop); dark cards; the "Decline order" button |
| `color.inkRaised` | `#1B222B` | the active item in the dark sidebar; a card inside the dark header |
| `color.canvas` | `#EDF0F4` | page background; chips and selected rows on white |
| `color.surface` | `#FFFFFF` | cards, sheets, the selected tab |
| `color.textMuted` | `#616A75` | secondary text on white or on the canvas (5.5:1 and 4.8:1) |
| `color.onDark` / `onDarkMuted` | `#F4F6F9` / `#979FAA` | text on ink (`#B4BBC5` for longer muted text, derived) |
| `color.primary` | `#3A68E0` | the next step on an order, or the one main action of a screen. Never a background, a link or a status. White text on it is 4.96:1 |
| `color.primaryDeep` | `#2955D3` | link hover |
| `color.message` | `#9FB2F0` | anything that happened by message: "By text" chips, message bubbles, notices about an action someone took, the current courier step |
| `color.hairline` | `#DDE2E8` (derived) | dividers, the tab track, steps not reached yet |
| `color.controlBorder` | `#7A838F` (derived) | borders of inputs, selects and switches that are off (3.9:1) |
| `font.display` | Funnel Display, weight 400, tracking -0.02em | one headline per screen: the page title, an order number, the payout amount |
| `font.body` | Funnel Sans, 400; 500 for labels; 600 for order codes and totals | everything else; numbers use tabular figures |
| `radius` | 9999 buttons; 20 cards (24 on desktop); 28 sheets; 12 option rows; 6 inputs and tags | |
| `size.touch` | 44 minimum, 48 for main actions | |

There is no red, green or amber. Accept and Decline differ by fill, not by hue. Caution is the dark card; "someone did this by message" is periwinkle. If a real warning colour is wanted, it must come from the brand.

Logo: `heydovo-logo-dark-tight.svg` (light wordmark, used on ink) and the three-bar symbol, taken from the site as they are. The site has no wordmark for light backgrounds, which is one reason the header and sidebar are ink.

## Components for `packages/ui`
AppShell (phone: bottom nav; desktop: sidebar), StoreStatusBar (open / paused, location switch, Pause or Resume), StatusTabs, OrderCard (countdown variant), OrderRow, ChannelChip (text, WhatsApp, dashboard, automatic), StatusBadge, ActivityThread + ActivityBubble (message, dashboard, automatic), CourierCard (four-step progress), NoticeCard (message, caution), BottomSheet, ReasonList (radio rows), SubstituteList, CodeInput, VerifiedBadge, RoleSelect, AlertMatrix, StatCard, DataTable (scrolls in its box on a phone), SegmentedChoice, DateRange, PrimaryButton / SecondaryButton.

## Patterns borrowed (Refero research, 2026-11-27)
From Refero's descriptions of these screens; none of their branding, layouts or copy is reproduced. Refero had no food-delivery merchant apps in the searches run, so the accept / decline card with a countdown comes from this product's own rules.

| Pattern | Source | Used for |
|---------|--------|----------|
| Status tabs + search + location filter over a compact, dated order list | Shopify iOS, Orders (https://refero.design/screens/d5f70f1a-4ba3-40b2-90bf-839623ae2ade) | Inbox tabs and location switch |
| Status badges at the top of an order, full-width primary actions | Shopify iOS, order detail (https://refero.design/screens/889f1fa4-131f-4e63-b3db-0b7194374019) | Order header and the action bar |
| A staff-only timeline of order events, one row per event | Shopify iOS, order timeline (https://refero.design/screens/5f07a006-2558-42a1-b6ae-232beab5b004) | Timeline with who and channel |
| A short status-step list with one main button | Instagram, order details (https://refero.design/screens/b361d740-51da-4fba-ae0c-a0e8afce0b41) | One next action per order state |
| Carrier name, a status sentence, then a four-step progress card | PayPal iOS, package tracking (https://refero.design/screens/9d0b1317-b6b1-4974-ac99-d8650daa790e) | Uber Direct card |
| Roles explained beside the role choice | Stripe, invite team members (https://refero.design/pages/e3445d52-75b1-4803-8cac-bac55c648660) | "What each role can do" |
| Team table with a role dropdown, Confirmed / Pending badges, and a reason when a change is blocked | Reown, team (https://refero.design/pages/ec469e8f-29cf-4a46-a7c4-b3f70c2a5589) | Team table, Verified / Not verified |
| Rows of events against columns of channels, with toggles | Loom and Fibery, notification settings (https://refero.design/pages/b65573a4-2f19-4b47-a1d2-004b5ecfc812, https://refero.design/pages/2a0855d1-333d-4cd0-84be-1e4b671e715d) | Who gets new-order alerts |
| Format choice, a date range, one Generate button | Revolut, statement export (https://refero.design/pages/b754ac62-03de-47a0-832b-64bc44c2ffd2) | Statement download |
| Balance first, then payouts in a table | Fourthwall, billing and payouts (https://refero.design/pages/e7630f15-a55f-40c8-9872-bcc23dd4fbbf) | Earnings page |
| A full-width warning banner about a setup problem | Intercom, channels (https://refero.design/pages/bc81d4eb-aa73-422b-a664-fda8045d0e1c) | Codes-needed and paused banners |
| A calm "paused" status with one action | Wise iOS, paused payment (https://refero.design/screens/303644bd-0d85-4e66-9143-0d96a4a0d42a) | Store paused state |

## Open questions for you
- The Figma link, to check these tokens against it (they were read from the live site).
- Whether you want a warning colour. The brand has none, so the design uses the dark card instead.
- Whether the activity list as a conversation (message right, dashboard left) reads clearly to vendors; the fallback is a plain list with the same words.
- heydovo.com says "Delivered by DoorDash Drive or Uber Direct couriers". The plan is Uber Direct only, so that line on the site needs changing (the site is not in this repo).
- French vendor wording, to be checked by a native speaker ("En cours", "Prêtes", "Marquer comme prête", "Reprendre", "Ce n'était pas moi").
- Whether managers may see earnings (the design says owner only).
- Whether staff may offer substitutes (the design says yes).
- The payout day shown on the Earnings page.
