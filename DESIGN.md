# DESIGN.md — Design System & Visual Language

> The single source of truth for **what this product looks like** and **how it feels to use**.
> Read this before drawing a single screen, picking a color, or writing CSS.
> If a design decision is made in code review or a Figma file and isn't here, it doesn't exist.
>
> **Audience:** designers, frontend engineers, AI coding agents, anyone touching the UI.

---

## 0. North Star

**Confident, calm, fast.** The interface should disappear into the work. Every interaction is intentional; nothing decorates. The product looks like it belongs next to Linear, Things 3, and Notion — modern enterprise software that respects the user's time.

The product is used in Persian-speaking enterprises, so **RTL is the default mental model**. LTR (English) is the equally-supported alternate. Mirroring is not an afterthought — it's a first-class design constraint.

---

## 1. Brand

### 1.1 Name & Identity

- **Working name:** TaskApp — placeholder, flag to the user.
- **Tagline (fa-IR):** «کارهای تیم را ساده کنید.»
- **Tagline (en-US):** "Make team work feel light."
- **Voice:** direct, helpful, never cute. Avoid exclamation marks. Avoid jargon.
- **Tone of UI copy:** explain *what* and *why*, not *what we just did*. E.g., "Saved" not "Your changes have been saved successfully!".

### 1.2 Logo & Mark

- **Wordmark:** clean sans-serif, set in Vazirmatn Bold (fa-IR) / Inter Bold (en-US).
- **Icon mark:** a stylized "T" formed by a horizontal bar over a vertical stem — works in any color, on any background, at any size.
- **Rules:**
  - Minimum clear space around mark = height of the cap of "T".
  - Minimum size: 16 px (favicon), 24 px (in-product), 32 px (marketing).
  - Don't rotate, skew, or change proportions.
  - Color: use `var(--fg)`, `var(--accent)`, or white/black only.

---

## 2. Design Tokens

All visual properties are tokens. **Tokens are defined in CSS variables and consumed via Tailwind utilities.** No hardcoded hex, no hardcoded spacing, no hardcoded font sizes outside `tailwind.config.ts`.

### 2.1 Token file: `src/styles/tokens.css`

```css
@layer base {
  :root {
    /* === Color: surface === */
    --bg-app:        #fafafa;   /* page background */
    --bg-surface:    #ffffff;   /* cards, panels */
    --bg-surface-2:  #f4f4f5;   /* nested surfaces, table headers */
    --bg-surface-3:  #e4e4e7;   /* hover on surface-2 */
    --bg-overlay:    rgb(0 0 0 / 0.4);

    /* === Color: foreground === */
    --fg:            #18181b;   /* primary text */
    --fg-muted:      #52525b;   /* secondary text */
    --fg-subtle:     #a1a1aa;   /* tertiary, placeholders */
    --fg-inverse:    #fafafa;   /* on accent */

    /* === Color: borders === */
    --border:        #e4e4e7;
    --border-strong: #d4d4d8;
    --border-focus:  var(--accent);

    /* === Color: status === */
    --success:       #16a34a;
    --success-bg:    #dcfce7;
    --warning:       #d97706;
    --warning-bg:    #fef3c7;
    --danger:        #dc2626;
    --danger-bg:     #fee2e2;
    --info:          #0284c7;
    --info-bg:       #e0f2fe;

    /* === Color: priority === */
    --priority-low:      #94a3b8;
    --priority-med:      #0284c7;
    --priority-high:     #ea580c;
    --priority-urgent:   #dc2626;

    /* === Color: task status === */
    --status-open:        #0284c7;
    --status-in_progress: #d97706;
    --status-done:        #16a34a;
    --status-cancelled:   #94a3b8;

    /* === Color: accent (per-user override) === */
    --accent:       #2563eb;   /* default blue */
    --accent-fg:    #ffffff;
    --accent-hover: #1d4ed8;
    --accent-bg:    #dbeafe;
    --accent-ring:  #93c5fd;

    /* === Typography === */
    --font-sans: var(--font-vazirmatn), var(--font-inter), system-ui, sans-serif;
    --font-mono: ui-monospace, "JetBrains Mono", monospace;

    /* === Radii === */
    --radius-sm: 4px;
    --radius:    8px;
    --radius-md: 10px;
    --radius-lg: 14px;
    --radius-xl: 20px;
    --radius-full: 9999px;

    /* === Shadows === */
    --shadow-xs: 0 1px 2px rgb(0 0 0 / 0.04);
    --shadow-sm: 0 1px 3px rgb(0 0 0 / 0.06), 0 1px 2px rgb(0 0 0 / 0.04);
    --shadow:    0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.04);
    --shadow-md: 0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05);
    --shadow-lg: 0 20px 25px -5px rgb(0 0 0 / 0.10), 0 8px 10px -6px rgb(0 0 0 / 0.05);

    /* === Spacing scale (rem) === */
    --space-0: 0;
    --space-1: 0.25rem;
    --space-2: 0.5rem;
    --space-3: 0.75rem;
    --space-4: 1rem;
    --space-5: 1.25rem;
    --space-6: 1.5rem;
    --space-8: 2rem;
    --space-10: 2.5rem;
    --space-12: 3rem;
    --space-16: 4rem;

    /* === Motion === */
    --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
    --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
    --duration-fast: 120ms;
    --duration: 180ms;
    --duration-slow: 280ms;
  }

  /* === Dark mode (soft elevated gray) === */
  .dark {
    --bg-app:        #1f1f23;
    --bg-surface:    #27272c;
    --bg-surface-2:  #303036;
    --bg-surface-3:  #3b3b42;
    --bg-overlay:    rgb(0 0 0 / 0.55);

    --fg:            #f4f4f5;
    --fg-muted:      #a8a8b0;
    --fg-subtle:     #7e7e88;
    --fg-inverse:    #18181b;

    --border:        #35353b;
    --border-strong: #44444c;

    --success-bg:    #16321f;
    --warning-bg:    #3f2a0c;
    --danger-bg:     #3f1717;
    --info-bg:       #0c2f44;

    --accent-bg:     #1e3a8a;
    --accent-ring:   #1e40af;
  }
}
```

### 2.2 Accent color override

Per-user accent is applied as an inline `<style>` on `<html>` *before* paint to avoid FOUC:

```html
<html style="--accent: #16a34a; --accent-fg: #ffffff; --accent-hover: #15803d; --accent-bg: #dcfce7; --accent-ring: #86efac;">
```

The accent picker provides 8 presets + custom hex. All presets must pass WCAG AA (4.5:1 contrast) on both light and dark backgrounds — verify in `lib/theme/contrast.ts` before adding.

### 2.3 Tailwind config

`tailwind.config.ts` reads from tokens via `theme.extend.colors`:

```ts
export default {
  theme: {
    extend: {
      colors: {
        bg: { app: 'var(--bg-app)', surface: 'var(--bg-surface)', 'surface-2': 'var(--bg-surface-2)', 'surface-3': 'var(--bg-surface-3)' },
        fg: { DEFAULT: 'var(--fg)', muted: 'var(--fg-muted)', subtle: 'var(--fg-subtle)', inverse: 'var(--fg-inverse)' },
        border: { DEFAULT: 'var(--border)', strong: 'var(--border-strong)' },
        accent: { DEFAULT: 'var(--accent)', fg: 'var(--accent-fg)', hover: 'var(--accent-hover)', bg: 'var(--accent-bg)', ring: 'var(--accent-ring)' },
        success: { DEFAULT: 'var(--success)', bg: 'var(--success-bg)' },
        warning: { DEFAULT: 'var(--warning)', bg: 'var(--warning-bg)' },
        danger:  { DEFAULT: 'var(--danger)',  bg: 'var(--danger-bg)' },
        info:    { DEFAULT: 'var(--info)',    bg: 'var(--info-bg)' },
        priority: { low: 'var(--priority-low)', med: 'var(--priority-med)', high: 'var(--priority-high)', urgent: 'var(--priority-urgent)' },
        status: { open: 'var(--status-open)', 'in-progress': 'var(--status-in_progress)', done: 'var(--status-done)', cancelled: 'var(--status-cancelled)' },
      },
      borderRadius: { sm: 'var(--radius-sm)', DEFAULT: 'var(--radius)', md: 'var(--radius-md)', lg: 'var(--radius-lg)', xl: 'var(--radius-xl)' },
      boxShadow: { xs: 'var(--shadow-xs)', sm: 'var(--shadow-sm)', DEFAULT: 'var(--shadow)', md: 'var(--shadow-md)', lg: 'var(--shadow-lg)' },
      fontFamily: { sans: 'var(--font-sans)', mono: 'var(--font-mono)' },
      transitionDuration: { fast: '120ms', DEFAULT: '180ms', slow: '280ms' },
      transitionTimingFunction: { out: 'var(--ease-out)', 'in-out': 'var(--ease-in-out)' },
    },
  },
} satisfies Config;
```

---

## 3. Typography

### 3.1 Fonts

- **Persian (`fa-IR`):** **Vazirmatn** — open-source (SIL OFL), designed for Persian, supports Latin fallback. Weights: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold).
- **English (`en-US`):** **Inter** — open-source (SIL OFL). Weights: 400, 500, 600, 700.
- **Self-hosted via `next/font`** — no Google Fonts CDN (we don't make outbound calls).

### 3.2 Type scale

| Token | Size | Line-height | Use |
|-------|------|-------------|-----|
| `text-xs`   | 12 px / 0.75 rem | 16 px / 1 rem | helper text, badges |
| `text-sm`   | 14 px / 0.875 rem | 20 px / 1.25 rem | UI default (inputs, buttons, list items) |
| `text-base` | 16 px / 1 rem | 24 px / 1.5 rem | body text |
| `text-lg`   | 18 px / 1.125 rem | 28 px / 1.75 rem | section headings |
| `text-xl`   | 20 px / 1.25 rem | 28 px / 1.4 rem | card titles |
| `text-2xl`  | 24 px / 1.5 rem | 32 px / 1.33 rem | page titles |
| `text-3xl`  | 30 px / 1.875 rem | 36 px / 1.2 rem | dashboard KPIs |
| `text-4xl`  | 36 px / 2.25 rem | 40 px / 1.11 rem | hero |

### 3.3 Weights

- Regular (400) — body.
- Medium (500) — UI labels, table headers.
- SemiBold (600) — headings, button labels.
- Bold (700) — reserved for the wordmark and major headings only.

### 3.4 Rules

- Body text max width 65ch on long-form screens (markdown descriptions, comments).
- Line-height 1.5 for body, 1.2 for headings.
- Persian numerals toggled per user (see `i18n.md`).
- **Never mix Persian and English in a single line** without explicit `<span dir="ltr">` for the LTR portion (emails, URLs, IDs).

---

## 4. Iconography

### 4.1 Library

**Lucide Icons** (already bundled with shadcn/ui). Stroke-based, 24×24 viewBox, 1.75 stroke width.

### 4.2 Size scale

| Name | Size | Use |
|------|------|-----|
| `xs` | 12 px | inline with `text-xs` |
| `sm` | 16 px | inline with `text-sm`, table actions |
| `md` | 20 px | default UI buttons, list item icons |
| `lg` | 24 px | page headers, feature icons |
| `xl` | 32 px | empty states, large feature areas |

### 4.3 Icon mirroring in RTL

Some icons imply direction and must mirror in RTL. Maintain the allowlist in `src/components/icons/mirror.ts`:

```ts
export const MIRRORED_ICONS = new Set([
  'ChevronLeft', 'ChevronRight', 'ArrowLeft', 'ArrowRight',
  'PanelLeft', 'PanelRight', 'PanelLeftClose', 'PanelRightClose',
  'Send', 'Reply', 'Forward', 'Undo2', 'Redo2', 'CornerDownLeft',
  'AlignLeft', 'AlignRight', 'IndentIncrease', 'IndentDecrease',
]);
```

The `<Icon>` wrapper component handles mirroring automatically via CSS `transform: scaleX(-1)` triggered by `[dir='rtl']`.

### 4.4 Custom icons

If a needed icon doesn't exist in Lucide, **create a 24×24 SVG** in `src/components/icons/custom/` with the same stroke conventions. Don't import random icon libraries.

---

## 5. Spacing & Layout

### 5.1 Spacing base

4 px base unit. All spacing via Tailwind utilities (`p-2`, `gap-4`, etc.) which map to 4 px multiples. **No arbitrary values** (`p-[13px]`) — extend the scale if needed.

### 5.2 App shell layout

```
┌─────────────────────────────────────────────────┐
│ Header (56 px)                                  │
├──────────┬──────────────────────────────────────┤
│ Sidebar  │ Content                              │
│ (240 px) │ (max-width: 1280 px, centered)       │
│          │                                      │
│          │                                      │
└──────────┴──────────────────────────────────────┘
```

- **Sidebar:** 240 px expanded, 64 px collapsed. Persisted per user.
- **Header:** 56 px tall. Logo · global search · quick add · notifications · user menu.
- **Content:** centered, max 1280 px, padding `px-6 py-8` (desktop), `px-4 py-6` (mobile).

### 5.3 Grid

12-column grid with 24 px gutter on desktop, 16 px on mobile. Use CSS Grid for page-level layouts; Flexbox for component-level.

### 5.4 Z-index scale

| Layer | z | Use |
|-------|---|-----|
| Base | 0 | content |
| Sticky | 10 | header, sticky table headers |
| Dropdown | 20 | dropdowns, popovers |
| Modal backdrop | 30 | modal backdrops |
| Modal | 40 | modal content |
| Toast | 50 | toasts |
| Tooltip | 60 | tooltips |

**Never** use z-index outside this scale without a documented exception.

---

## 6. Component Library

Built on **shadcn/ui** (Radix primitives + Tailwind). Located in `src/components/ui/`. Extended with our own enterprise components in `src/components/<feature>/`.

### 6.1 Primitives (shadcn, customized)

- Button (variants: primary, secondary, ghost, outline, danger; sizes: sm, md, lg, icon)
- Input, Textarea, Select, Combobox, DatePicker (Jalali-aware), TimePicker
- Checkbox, RadioGroup, Switch, Slider
- Dialog, Sheet (side panel), Popover, Tooltip, HoverCard, DropdownMenu
- Tabs, Accordion, Collapsible
- Toast (Sonner)
- Alert, Badge, Card, Separator, Skeleton
- Table (with sticky header, sort, row selection)
- Avatar, AvatarGroup
- Breadcrumb, Pagination
- Command (Cmd+K palette)

### 6.2 Enterprise components

| Component | Use |
|-----------|-----|
| `<TaskRow>` | Single task in a list |
| `<TaskDetail>` | Full task detail page |
| `<TaskQuickAdd>` | Cmd+K quick add |
| `<ProjectCard>` | Project tile in grid |
| `<MemberAvatar>` | User avatar with role badge |
| `<PriorityBadge>` | Colored priority pill |
| `<StatusBadge>` | Colored status pill |
| `<DueDateChip>` | Date with overdue/upcoming color |
| `<TagChip>` | Colored tag |
| `<MentionInput>` | Markdown input with @mentions |
| `<CommentThread>` | Threaded comments |
| `<NotificationBell>` | Notification dropdown |
| `<AuditTimeline>` | Vertical event timeline |
| `<DashboardCard>` | KPI card with sparkline |
| `<KanbanLite>` | Optional drag-to-status columns |
| `<CustomFieldInput>` | Per-type custom field renderer |
| `<ApiTokenCreateDialog>` | Token creation with copy-once |
| `<WebhookForm>` | Webhook URL + events + secret display |

### 6.3 Component anatomy

Every component file follows:

```tsx
// ComponentName.tsx
import { cn } from '@/lib/cn';

type ComponentNameProps = {
  /** Prop description (JSDoc — visible in IDE) */
  propName: PropType;
  /** Visual variant */
  variant?: 'primary' | 'secondary';
  /** Optional className override */
  className?: string;
  /** Children */
  children?: React.ReactNode;
};

export function ComponentName({ propName, variant = 'primary', className, children }: ComponentNameProps) {
  return (
    <div className={cn(
      // base styles
      '...',
      // variant styles
      variant === 'primary' && '...',
      // override
      className,
    )}>
      {children}
    </div>
  );
}
```

### 6.4 Component rules

- Props as named types, never `React.FC`.
- Forward refs on interactive primitives.
- All interactive components keyboard-accessible (Tab, Enter, Space, Esc).
- No `useEffect` for derived state — compute on render.
- All strings via `useTranslations()`.
- All dates via `useFormattedDate()`.
- All icons via `<Icon name="..." />` wrapper (handles mirroring).
- Class merging via `cn()` helper (clsx + tailwind-merge).
- Tests: every primitive has a Vitest test (renders, variants, keyboard nav). Enterprise components get Playwright coverage.

---

## 7. Layouts

### 7.1 App shell

Three regions: sidebar (left in LTR, right in RTL), header, content. Sidebar collapsible. On mobile (< 768 px), sidebar becomes a bottom drawer.

```
┌─────────────────────────────────────┐
│ Header                              │
├──────────┬──────────────────────────┤
│ Sidebar  │ Content                  │
│          │                          │
│ Inbox    │  [page content]          │
│ Today    │                          │
│ Upcoming │                          │
│ ───────  │                          │
│ Projects │                          │
│  • Work  │                          │
│  • Per…  │                          │
│ ───────  │                          │
│ Admin ⚙  │                          │
└──────────┴──────────────────────────┘
```

### 7.2 Auth shell

Centered card on a soft background. No sidebar. Logo top-left. Locale switcher top-right.

### 7.3 Admin shell

Same as app shell but with a secondary sidebar listing admin sections (Users, Departments, LDAP, SAML, SMTP, Storage, Tokens, Webhooks, Audit, Backups).

---

## 8. States

Every interactive element and every data view needs **explicit, designed states**. Use this matrix:

| State | Visual | Behavior |
|-------|--------|----------|
| **Default** | base styling | interactive |
| **Hover** | bg-surface-3 on surface; bg-accent-hover on accent | cursor pointer |
| **Focus** | ring-2 ring-accent-ring outline-none | keyboard indicator |
| **Active / Pressed** | slight inset shadow or bg-surface-3 | feels physical |
| **Disabled** | opacity-50, cursor-not-allowed | non-interactive |
| **Loading** | spinner or skeleton | non-interactive, announces "Loading" to SR |
| **Error** | border-danger + danger helper text below | focus the input |
| **Success** | success color check, auto-dismiss in 3 s | confirms |
| **Empty** | illustration + headline + 1-line description + primary CTA | guides action |
| **Skeleton** | bg-surface-2 + subtle shimmer | matches final layout |

### 8.1 Empty state anatomy

```
        [Illustration — single color, line style, 120×120]

            No tasks here yet

   Tasks you create will show up in this view.

            [ + New task ]
```

### 8.2 Error state

Inline for forms, full-page for route-level errors. All errors have:
- A short, plain-language headline ("Couldn't load tasks").
- A one-line explanation ("Check your connection and try again.").
- A retry CTA.
- A "Copy error details" button that puts `requestId` on the clipboard.

---

## 9. Forms

### 9.1 Layout

- Labels **above** inputs (never to the left — wastes horizontal space, breaks RTL).
- Helper text below the input in `text-xs fg-muted`.
- Required indicator: red asterisk after label.
- Validation: shown on blur, re-shown on submit, cleared on edit.
- Errors shown below the input in `text-sm danger`.

### 9.2 Required vs optional

**Default to required.** Mark optional with explicit " (optional)" suffix in `fg-muted`. Don't mark required — make optional the exception.

### 9.3 Submission

- Submit button is sticky at the bottom of the form on long forms.
- While submitting: button shows spinner, label changes to "Saving...", all inputs disabled.
- On success: toast + redirect (or stay with "Saved" indicator).
- On error: focus first invalid input, show inline error, button re-enabled.

### 9.4 Markdown inputs

- Tabbed: "Write" / "Preview".
- Toolbar: bold, italic, code, link, list, mention.
- Auto-grow textarea up to 12 rows, then scroll.

---

## 10. Modals, Drawers, Toasts

### 10.1 When to use which

| Pattern | Use for |
|---------|---------|
| **Inline edit** | quick changes (title, status) |
| **Side panel (Sheet)** | task details, settings forms |
| **Dialog (modal)** | destructive confirmations, blocking choices |
| **Toast** | non-blocking feedback |
| **Banner** | persistent info (maintenance window) |

**Never nest modals. Never open a modal from a modal.** If you need to confirm something inside a modal, use a destructive inline pattern.

### 10.2 Side panel (Sheet)

Right side in LTR, left side in RTL. 480 px wide on desktop, full width on mobile. Slides in over 280 ms with `ease-out`.

### 10.3 Toast

Top-right in LTR, top-left in RTL. Stack vertically, max 3 visible, older ones collapse. Default duration 4 s. Destructive toasts require manual dismiss.

---

## 11. Data Display

### 11.1 Tables

- Sticky header with subtle bottom border.
- Row hover: `bg-surface-2`.
- Selected row: `bg-accent-bg` + left border `border-s-2 border-accent`.
- Empty rows: empty state row spanning all columns.
- Loading: skeleton rows matching real row height.
- Pagination: cursor-based, "Load more" button at bottom (no page numbers).
- Column resize: drag handle on right (LTR) / left (RTL) edge of header.
- Sort: click header to toggle asc/desc/none. Visual indicator.

### 11.2 Lists (tasks)

- Compact mode: single row, 40 px tall. Title · status · assignee · due date.
- Comfortable mode (default): two-line row, 56 px tall. Title · meta line.
- Spacious mode: card-like, 88 px tall. Title · description preview · meta.
- Density persisted per user.

### 11.3 Cards

- White surface in light mode, `bg-surface` in dark.
- Subtle border, no heavy shadow.
- Internal padding `p-4`.
- Header (title + actions), body, optional footer.
- Hover: `bg-surface-2` (no shadow change — shadow changes feel jumpy in lists).

### 11.4 Charts

- Use **Recharts** (RTL-friendly with `dir` config) or **Tremor**.
- Colors: status colors first, then priority colors, then `accent`. Avoid raw hues.
- Tooltips on hover, not on touch (use tap-to-toggle).
- Y-axis labels in user's locale. Numbers formatted with `Intl.NumberFormat`.
- Always include a "Show as table" fallback for accessibility.

---

## 12. RTL Design

**RTL is not "LTR with text aligned right."** It changes layout, interaction, and iconography.

### 12.1 Layout

- Sidebar moves to the right edge.
- Text alignment starts on the right.
- Form labels remain above inputs (symmetric).
- Padding/margin swap sides (`ms-2` instead of `ml-2`).

### 12.2 Iconography

- Mirror arrows, chevrons, panel toggles, send/reply/forward (see §4.3).
- **Do not mirror**: logos, checkmarks, magnifier, filter, settings gear, user/avatar icons, file icons, calendar, clock.

### 12.3 Interaction

- "Next" button is on the left in RTL (visually leads forward into the content direction).
- Carousel/swiper direction reverses.
- Drag handles swap sides.
- Range sliders: track fills from the right.

### 12.4 Mixed-direction content

When a UI string contains an LTR substring (email, URL, ID, code):

```tsx
<p className="text-base">
  ایمیل خود را تأیید کنید: <span dir="ltr" className="font-mono">{email}</span>
</p>
```

Build a `<LtrSpan>` component to make this idiomatic.

### 12.5 Numbers in mixed contexts

- Digits inside an RTL sentence: per-user preference (Persian or Latin).
- Digits inside code/IDs/emails: **always Latin**, in `font-mono`.

---

## 13. Responsive Design

### 13.1 Breakpoints

| Name | Min-width | Target |
|------|-----------|--------|
| `sm` | 640 px | large phones landscape, small tablets |
| `md` | 768 px | tablets |
| `lg` | 1024 px | laptops |
| `xl` | 1280 px | desktops |
| `2xl` | 1536 px | wide screens |

### 13.2 Behavior

- **< 768 px (mobile):**
  - Sidebar collapses to a bottom sheet (hamburger in header).
  - Side panel becomes full-screen modal.
  - Tables become cards.
  - Multi-column forms become single column.
- **≥ 768 px:** full sidebar + panels.
- **≥ 1280 px:** content max-width applies.

### 13.3 Touch targets

- Minimum 44 × 44 px on mobile (Apple HIG).
- On desktop, 32 × 32 px is acceptable for dense UI; but primary actions always ≥ 40 px.

---

## 14. Motion

### 14.1 Principles

- Animation serves comprehension, not delight.
- Default duration: 180 ms. Fast (120 ms) for micro-interactions. Slow (280 ms) for layout shifts.
- Default easing: `cubic-bezier(0.16, 1, 0.3, 1)` ("ease-out") — feels natural.
- All animations respect `prefers-reduced-motion: reduce` — disable non-essential animation, keep functional ones at near-zero duration.

### 14.2 What animates

- Modal/drawer open/close (slide + fade).
- Toast appearance (slide + fade).
- Dropdown/popover open (fade + scale 0.95 → 1).
- Skeleton shimmer (loading only).
- Drag-reorder (transform only).
- Tab switching (instant unless content shifts substantially — then crossfade).
- Sidebar collapse (width transition).

### 14.3 What does NOT animate

- Hover color changes (instant or 120 ms).
- Page transitions (instant).
- Form validation errors (instant).
- Anything on a 60 fps path that isn't critical to convey change.

---

## 15. Accessibility

Accessibility is design-driven, not retrofitted.

### 15.1 Standards

- **WCAG 2.1 AA** is the floor.
- All interactive elements keyboard-reachable in DOM order.
- All interactive elements have an accessible name (`aria-label` or visible label).
- Focus ring always visible: `ring-2 ring-accent-ring ring-offset-2 ring-offset-bg-app`.
- Color contrast:
  - Body text on bg-surface ≥ 4.5:1.
  - Large text ≥ 3:1.
  - Non-text UI components (icons, borders) ≥ 3:1.
- All accent color presets verified for contrast in `lib/theme/contrast.ts`.

### 15.2 Forms

- Every input has a `<label>`.
- Error messages linked via `aria-describedby`.
- Required state via `aria-required`, not color alone.

### 15.3 Dynamic content

- `aria-live="polite"` for toasts and inline confirmations.
- `aria-live="assertive"` for blocking errors.
- Loading states announced: `<span className="sr-only">Loading tasks</span>` next to spinner.

### 15.4 Tables

- `<th scope="col">` for column headers.
- `<th scope="row">` where appropriate.
- Sort state announced via `aria-sort`.

### 15.5 Modals

- Focus trapped inside.
- Focus restored to trigger on close.
- `Esc` closes.
- Background scroll locked.

---

## 16. Asset Guidelines

### 16.1 Logos

- Wordmark + icon mark variants for: light background, dark background, monochrome.
- Provided as SVG, never PNG.
- Application icon: 512×512, 192×192, 180×180 (Apple touch), 32×32 (favicon), 16×16 (favicon).

### 16.2 Illustrations

- Empty state illustrations: line style, single weight (1.75 px stroke to match icons), single color (`fg-muted`), on transparent background.
- 120×120 default size.
- No third-party illustration libraries — keep the style consistent.
- Source SVGs in `src/assets/illustrations/`, exported as React components.

### 16.3 Avatars

- User avatars: 32 px (list), 40 px (header), 96 px (profile page).
- Generated from initials with a deterministic color palette (8 options, hashed from user id).
- Image upload allowed; fallback to initials.

---

## 17. Do's and Don'ts

### ✅ Do

- Use semantic HTML (`<button>`, `<nav>`, `<main>`, `<article>`).
- Use the design tokens — never hardcode colors, spacing, or fonts.
- Use logical CSS properties (`ms-*`, `me-*`, `ps-*`, `pe-*`).
- Test every new view in both `fa-IR` (RTL) and `en-US` (LTR).
- Test with `prefers-reduced-motion: reduce` and `prefers-color-scheme: dark`.
- Run `axe-core` on every major route before merging.

### ❌ Don't

- Hardcode hex values outside `tokens.css`.
- Use physical CSS properties (`ml-*`, `mr-*`, `pl-*`, `pr-*`).
- Use `text-white` / `text-black` — use `text-fg` / `text-fg-inverse`.
- Use `bg-gray-*` — use `bg-bg-surface-*` or `bg-fg-muted` semantic colors.
- Mix more than two typefaces on one screen.
- Use shadows for hover states.
- Use emoji in UI copy (use icon component instead).
- Use exclamation marks in microcopy.
- Use animation to draw attention to a CTA — use color and weight.
- Make clickable elements that aren't buttons or links.

---

## 18. Implementation

### 18.1 File layout

```
src/
  styles/
    globals.css         # tailwind directives, base reset
    tokens.css          # CSS variables (light + dark)
  components/
    ui/                 # shadcn primitives, customized
    icons/              # Icon wrapper + Lucide exports + mirror allowlist
    <feature>/          # feature-specific components
  lib/
    cn.ts               # class merging helper
    theme/
      contrast.ts       # WCAG contrast checker for accent picker
      apply.ts          # inline <style> for user accent
```

### 18.2 Icon component

```tsx
// src/components/icons/Icon.tsx
'use client';
import { icons, type LucideName } from './registry';
import { MIRRORED_ICONS } from './mirror';
import { useLocale } from 'next-intl';

export function Icon({ name, size = 20, className }: { name: LucideName; size?: number; className?: string }) {
  const locale = useLocale();
  const Comp = icons[name];
  const mirror = MIRRORED_ICONS.has(name) && locale === 'fa-IR';
  return <Comp size={size} className={cn(mirror && 'scale-x-[-1]', className)} />;
}
```

### 18.3 Theme application

Server-side render the user's accent as inline `<style>` on `<html>` to avoid FOUC:

```tsx
// src/app/[locale]/layout.tsx (sketch)
export default async function LocaleLayout({ children, params: { locale } }) {
  const user = await getCurrentUser();
  return (
    <html
      lang={locale}
      dir={locale === 'fa-IR' ? 'rtl' : 'ltr'}
      style={user ? userAccentStyle(user.accentColor, user.theme) : undefined}
    >
      <body>{children}</body>
    </html>
  );
}
```

### 18.4 Density toggle

Persisted per user. Stored as `User.density` (`compact | comfortable | spacious`).

---

## 19. Figma / Design Source

For the human designers in the team (if any):

- **Figma library:** single file with all components, linked to the GitHub repo via Tokens Studio.
- **Naming:** matches the code (`TaskRow`, `PriorityBadge`, etc.) so engineers can find the spec by component name.
- **Versions:** every PR that touches design tokens updates the Figma library within 24 h.

---

## 20. Reviewing Design Changes

Before merging any PR that affects the UI:

- [ ] Design tokens unchanged, or updated in this file + `tokens.css` + `tailwind.config.ts` atomically.
- [ ] Tested in `fa-IR` (RTL) and `en-US` (LTR).
- [ ] Tested in light + dark mode.
- [ ] `prefers-reduced-motion` honored.
- [ ] `@axe-core/playwright` clean on affected routes.
- [ ] Keyboard reachable; visible focus ring.
- [ ] Color contrast verified (especially for any new accent option).
- [ ] No hardcoded strings (all via `useTranslations()`).
- [ ] No hardcoded dates (all via `useFormattedDate()`).
- [ ] Logical CSS properties only.

---

**Last updated:** kickoff
**Next review:** end of Phase 6 (i18n / theming pass)