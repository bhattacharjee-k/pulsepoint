# PulsePoint — Brand & UI foundation

> **Purpose:** Source of truth for **Claude M6** dashboard UI (colors, typography, motion, copy).  
> **Not implemented yet** — `apps/web` is still the Codex baseline (`main.tsx` monolith).  
> **Stack (required):** shadcn/ui + Tailwind + [Motion](https://motion.dev/docs/react) + Noto Sans.

---

## Voice

**Sleek, professional, and direct** — built for teams who take customer signal seriously. No hype; short sentences; calm confidence.

---

## Theme: dark mode (default)

The dashboard uses **dark mode only** (`color-scheme: dark`, `html` class or `:root` tokens). Implement via Tailwind + shadcn CSS variables.

| Role | Token / value |
|------|----------------|
| App background | `ink-black-950` `#030c20` |
| Elevated / sidebar | `ink-black-900` `#05112e` |
| Cards / surfaces | `ink-black-800` `#0a225c` |
| Borders | `ink-black-700` `#0f348a` |
| Primary text | `ink-black-50` `#e8eefd` |
| Muted text | `ink-black-200` – `300` |
| Primary CTA | `ink-black-400` → hover `500` |
| Focus ring | `ink-black-400` |
| Success | `mint-cream-600` / `400` on muted bg |
| Error / destructive | `cotton-rose-400` – `500` |

**Widget / demo pages:** Still use seed accent colors (`#2563eb` Alpha, `#d97706` Delta) until a separate widget pass.

---

## Color palette (full scales)

### ink-black

| Step | Hex |
|------|-----|
| 50 | `#e8eefd` |
| 100 | `#d1ddfa` |
| 200 | `#a3bbf5` |
| 300 | `#759af0` |
| 400 | `#4678ec` |
| 500 | `#1856e7` |
| 600 | `#1345b9` |
| 700 | `#0f348a` |
| 800 | `#0a225c` |
| 900 | `#05112e` |
| 950 | `#030c20` |

### mint-cream

| Step | Hex |
|------|-----|
| 50 | `#e5ffef` |
| 100 | `#ccffdf` |
| 200 | `#99ffbe` |
| 300 | `#66ff9e` |
| 400 | `#33ff7e` |
| 500 | `#00ff5e` |
| 600 | `#00cc4b` |
| 700 | `#009938` |
| 800 | `#006625` |
| 900 | `#003313` |
| 950 | `#00240d` |

### cotton-rose

| Step | Hex |
|------|-----|
| 50 | `#fde7e9` |
| 100 | `#fccfd3` |
| 200 | `#f8a0a7` |
| 300 | `#f5707b` |
| 400 | `#f2404f` |
| 500 | `#ee1123` |
| 600 | `#bf0d1c` |
| 700 | `#8f0a15` |
| 800 | `#5f070e` |
| 900 | `#300307` |
| 950 | `#210205` |

---

## Typography — Noto Sans

Load via `@fontsource/noto-sans`. Map to Tailwind `fontSize` utilities or component classes per table below.

| Token | Size | Weight | Use |
|-------|------|--------|-----|
| display | 32px | 700 | Brand |
| h1 | 24px | 600 | Page titles |
| h2 | 18px | 600 | Sections |
| h3 | 16px | 600 | Cards |
| body | 14px | 400 | Default |
| body-lg | 16px | 400 | Taglines |
| label | 12px | 500 | Form labels |
| caption | 12px | 400 | Meta |
| code | 13px | 400 | Keys, snippets |

---

## UX copy (implement in `apps/web/src/copy.ts`)

Use these strings verbatim unless a grammar fix is required.

### Login
| Key | Copy |
|-----|------|
| Title | PulsePoint |
| Tagline | Collect feedback from your product. Triage it in one calm workspace. |
| Email label | Work email |
| Password label | Password |
| Submit | Sign in |
| Error | We couldn't sign you in. Check your email and password. |

### Nav
| Key | Copy |
|-----|------|
| Inbox | Inbox |
| Settings | Widget setup |
| Sign out | Sign out |

### Inbox
| Key | Copy |
|-----|------|
| Title | Feedback inbox |
| Loading | Loading feedback… |
| Error | Couldn't load feedback. Refresh the page or try again in a moment. |
| Empty headline | No feedback yet |
| Empty body | Embed the PulsePoint widget on your site. Submissions land here for your team to triage. |
| Empty CTA | Open widget setup |
| Filtered headline | No matches |
| Filtered body | Nothing matches these filters. Clear status, type, or search to see more. |
| Search placeholder | Search message or submitter |
| Keyboard hint | j / k navigate · Esc clear selection |

### Stats
| Key | Copy |
|-----|------|
| Loading | Updating overview… |
| Avg rating | Average rating |
| No rating | No ratings yet |

### Detail
| Key | Copy |
|-----|------|
| Empty | Select an item from the inbox to review details, update status, and add internal notes. |
| Notes title | Internal notes |
| Notes placeholder | Add context for your team… |
| Notes submit | Add note |
| Anonymous | Anonymous visitor |

### Settings (admin)
| Key | Copy |
|-----|------|
| Title | Widget setup |
| Subtitle | Configure how feedback appears on your site and copy the embed snippet. |
| Install title | Install on your site |
| Install body | Place this script before `</body>` on pages where you want the feedback launcher. |
| Public key hint | Used by the widget to submit feedback. Keep it out of general app code except the embed tag. |
| Rotation title | Key rotation |
| Rotation body | Rotating keys invalidates old embeds until you update the snippet. Rate limits and monitoring are the first line of defense — full rotation UI is planned. |
| Demo keys note | Demo keys: pk_alpha_demo (Alpha) · pk_delta_demo (Delta) |

### Member
| Key | Copy |
|-----|------|
| Settings blocked | Widget setup is available to workspace admins only. |

---

## Motion

| Moment | Behavior |
|--------|----------|
| Login card | Fade + slide up |
| Inbox mount | Content fade in |
| List rows | Stagger 50ms |
| Detail panel | Cross-fade + slide on selection change |
| Stats chips | Stagger scale-in |
| Empty state | Soft fade up |

Library: `motion` → `import { motion, AnimatePresence } from 'motion/react'`.

---

## Related docs

- [`workspace_plan.md`](../../workspace_plan.md) — M6 UI pass  
- [`CODEX_HANDOFF.md`](../../CODEX_HANDOFF.md) — API contract  
