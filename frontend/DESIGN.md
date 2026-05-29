# Leadminer Design System

> Contact management SaaS: extract, clean, enrich contacts from your mailbox and send email & SMS campaigns.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Nuxt 3 (Vue 3, Composition API, `<script setup>`) |
| UI Library | PrimeVue 4 (Aura preset) |
| CSS | Tailwind CSS v4 + `tailwindcss-primeui` bridge |
| Icons | nuxt-mdi (Material Design Icons) + PrimeIcons |
| State | Pinia stores (auto-imported from `src/stores/`) |
| i18n | `@nuxtjs/i18n` (en/fr, `no_prefix` strategy) |
| Auth | Supabase (PKCE flow) |
| Rich Text | Quill editor (snow theme) |
| Analytics | PostHog |
| PWA | `@vite-pwa/nuxt` |

**Dark mode is disabled** (`darkModeSelector: 'light'`). The application is light-only.

---

## Design Tokens

### Colors

Colors come from the **PrimeVue Aura preset** and are accessed via Tailwind's `tailwindcss-primeui` bridge. Use semantic token names, never hardcode hex values.

#### Primary Palette

| Token | Usage |
|-------|-------|
| `primary-50` – `primary-950` | Brand actions, active nav indicators, primary buttons |

#### Surface Palette (Neutrals)

| Token | Usage |
|-------|-------|
| `surface-0` | Page/app background (white) |
| `surface-50` | Card backgrounds, stat panels, subtle fills |
| `surface-100` | Hover states, alternate row backgrounds |
| `surface-200` | Borders (`border-surface-200`), dividers, skeleton loaders |
| `surface-300` | Disabled borders, stronger dividers |
| `surface-400` | Muted icons |
| `surface-500` | Placeholder text, muted labels |
| `surface-600` – `surface-900` | Body text, headings (darker = higher emphasis) |

#### Semantic / Status Colors

Used via `.state-pill` CSS classes for status badges:

| Class | Text | Background | Usage |
|-------|------|-----------|-------|
| `.state-success` | `#166534` | `#dcfce7` | Completed, verified, valid |
| `.state-warn` | `#92400e` | `#fef3c7` | Pending, needs attention |
| `.state-danger` | `#991b1b` | `#fee2e2` | Errors, invalid, failed |
| `.state-secondary` | `#334155` | `#e2e8f0` | Inactive, neutral status |
| `.state-info` | `#0c4a6e` | `#e0f2fe` | Informational, in-progress |

#### Accent Colors

| Color | Value | Usage |
|-------|-------|-------|
| Indigo | `indigo-500` / `indigo-600` | Links (`.link` class), interactive text |
| Red | `red-400` | Form validation error text |

#### Temperature Scale

Used for contact "temperature" indicators:

```
HSL gradient: hsl(45, 75%, 85%) → hsl(0, 75%, 85%)
              warm yellow            warm red
```

### Typography

No custom font families are defined. The app uses the system font stack via Tailwind defaults.

| Pattern | Classes | Usage |
|---------|---------|-------|
| Auth page headings | `text-4xl font-bold font-serif` | Login, signup, forgot password titles |
| Section headings | `text-xl font-semibold` | Page titles, card headers |
| Body text | `text-sm` / `text-base` | Default content |
| Labels | `text-sm font-medium` | Form field labels |
| Helper/error text | `text-xs` | Validation messages, captions |
| Validation errors | `text-red-400 text-left pl-4` | Below form inputs |

### Spacing

Uses Tailwind default spacing scale (4px base). Common patterns:

| Pattern | Usage |
|---------|-------|
| `p-2` / `p-3` / `p-4` | Card and container padding |
| `gap-1` / `gap-2` | Inline element spacing |
| `gap-3` / `gap-4` | Card grid gaps, section spacing |
| `m-1` / `m-2` / `m-4` | Outer margins |
| `px-4 pb-4` | Layout-level page padding (set on root layout) |

### Breakpoints

| Name | Width | Usage |
|------|-------|-------|
| `sm` | 640px | Small tablets |
| `md` | 768px | Tablets — primary mobile/desktop split |
| `lg` | 1024px | Desktop nav visible, drawer hidden |
| `xl` | 1280px | Wide layouts |
| `2xl` | 1536px | Extra-wide layouts |

Responsive strategy: **mobile-first with `hidden md:block` / `flex md:hidden` toggle patterns**. The `useScreenStore` Pinia store provides reactive `size.sm/md/lg/xl/2xl` booleans for JS-based breakpoint logic.

### Elevation

No custom shadows defined. Use PrimeVue's built-in elevation on Card, Dialog, and Overlay components.

### Border Radius

| Pattern | Usage |
|---------|-------|
| `rounded-md` | Cards, containers, inputs (default) |
| `rounded-lg` | Dialogs, modals |
| `rounded-full` | Avatars, badges, pills |

---

## Layout

### Root Layout

```
┌──────────────────────────────────────────┐
│ AppHeader (fixed top, full width)        │
├──────────────────────────────────────────┤
│                                          │
│  <NuxtPage /> (flex-1, scrollable)      │
│                                          │
└──────────────────────────────────────────┘
```

- Container: `flex flex-col h-[100svh] px-4 pb-4`
- Full viewport height using `100svh` (safe viewport)
- Page content scrolls independently

### Navigation

**Desktop (lg+):** Horizontal nav bar in AppHeader. Active item indicated by bottom border in `primary` color. Buttons use `outlined` variant.

**Mobile (<lg):** Drawer component (slide-in from left). Active item indicated by left border in `primary` color + `bg-primary-50` background.

### Page Patterns

| Page Type | Pattern |
|-----------|---------|
| Auth pages | Centered `max-w-lg`, card-based, serif headings |
| Dashboard/list pages | Full-width with DataTable/DataView |
| Settings | Sectioned form within bordered cards |
| Stepper flows | PrimeVue Stepper (3-step mining flow) |

---

## Components

### PrimeVue Components in Use

The app uses PrimeVue 4 components extensively. Key ones:

| Component | Usage |
|-----------|-------|
| `Button` | All interactive actions. Severity: `contrast`, `danger`, `warning`, `success`. Variants: `outlined`, `text`, default (filled) |
| `DataTable` | Contact mining table (20+ columns, filters, selection, export) |
| `DataView` | Campaign list (card-based layout) |
| `Dialog` | Campaign composer, SMS composer, consent sidebars |
| `Stepper` | Mining flow (Source → Mine → Clean) |
| `Drawer` | Mobile navigation, contact info sidebar |
| `Card` | Stat panels, campaign items, auth forms |
| `InputText` / `InputGroup` | Form inputs |
| `Select` / `MultiSelect` | Dropdowns |
| `Toast` | Notifications (responsive width fix applied) |
| `ProgressSpinner` | Loading states |
| `Skeleton` | Placeholder loading (`animate-pulse` + `bg-surface-200`) |
| `Tag` / `Badge` | Status indicators |
| `FileUpload` | CSV import |

### Custom Component Patterns

#### Container Card
```html
<div class="border border-surface-200 rounded-md p-4">
  <!-- content -->
</div>
```

#### Status Badge (state-pill)
```html
<span class="state-pill state-success">Verified</span>
<span class="state-pill state-warn">Pending</span>
<span class="state-pill state-danger">Failed</span>
```

#### Link
```html
<a class="link" href="...">Link text</a>
<!-- Renders: text-indigo-500, hover:text-indigo-600, transition-colors -->
```

#### Loading Skeleton
```html
<div class="animate-pulse bg-surface-200 rounded-md h-4 w-full" />
```

---

## Icons

Two icon systems are used:

| System | Package | Usage |
|--------|---------|-------|
| **nuxt-mdi** | `nuxt-mdi` | Primary icon set. Used via `<MdiIcon name="..." />` |
| **PrimeIcons** | `primeicons` | PrimeVue component icons (built-in). Used via `icon="pi pi-..."` props |

Brand icons (Google, Microsoft) are static PNGs in `public/icons/`.

The app logo is a **pickaxe SVG** (`public/icons/pickaxe.svg`) with an animated rotation effect, paired with a logo PNG (`public/logo/`).

---

## Internationalization

- **Locales**: English (`en`), French (`fr`)
- **Strategy**: `no_prefix` (URL does not change)
- **Detection**: Browser language with cookie persistence (`i18n_redirected`)
- **Translation files**: `src/i18n/messages.json` + `src/i18n/messages_extras.json`
- **Usage**: `$t('key')` in templates, `useI18n()` composable in script

Translation keys follow a nested structure: `common.*`, `auth.*`, `mining.*`, `campaigns.*`, etc.

---

## State Management

Pinia stores (auto-imported, no explicit import needed):

| Store | Purpose |
|-------|---------|
| `leadminer` | Core app state, mining session |
| `contacts` | Contact list and selection |
| `campaigns` | Email/SMS campaign state |
| `stepper` | Mining stepper state |
| `filters` | Table filter state |
| `sidebar` | Sidebar visibility |
| `screen` | Responsive breakpoint state |
| `notifications` | Real-time notifications (Supabase realtime) |
| `sms-fleet` | SMS provider/fleet management |

---

## File Structure

```
frontend/src/
├── assets/css/
│   └── tailwind.css          # Global CSS, .link class, toast fix
├── components/
│   ├── auth/                  # Login, signup, OAuth, legal
│   ├── campaigns/             # Campaign composers
│   ├── icons/                 # Custom icon components
│   ├── mining/                # Mining flow components
│   │   ├── buttons/           # Action buttons
│   │   ├── enrich/            # Enrichment features
│   │   ├── stepper-panels/    # Stepper step content
│   │   │   ├── source/
│   │   │   ├── mine/
│   │   │   └── clean/
│   │   └── table/             # DataTable and skeleton
│   └── sms-fleet/             # SMS provider management
├── composables/               # Reusable composition logic
├── layouts/
│   └── default.vue            # Single layout (header + page)
├── middleware/                 # Route guards
├── pages/                     # File-based routing
│   ├── auth/                  # Authentication pages
│   ├── account/               # User settings
│   ├── c/[token].vue          # Campaign tracking
│   ├── o/[token].vue          # Open tracking
│   └── u/[token].vue          # Unsubscribe
├── plugins/                   # Nuxt plugins (PostHog, etc.)
├── stores/                    # Pinia stores
├── utils/                     # Utility functions
└── i18n/                      # Translation files
```

---

## Conventions

### DO

- Use PrimeVue semantic color tokens (`text-primary`, `bg-surface-50`)
- Use `border border-surface-200 rounded-md` for card/container borders
- Use `.link` class for inline links
- Use `.state-pill` classes for status badges
- Use PrimeVue `Button` with appropriate `severity` prop
- Use `hidden md:block` / `flex md:hidden` for responsive toggling
- Use `useScreenStore()` for JS-based breakpoint checks
- Use `$t()` for all user-facing strings
- Use `useToast()` for notifications
- Use `animate-pulse bg-surface-200` for skeleton loaders

### DON'T

- Don't hardcode hex colors (use Tailwind/PrimeVue tokens)
- Don't add dark mode styles (dark mode is disabled)
- Don't use custom font imports (system fonts only)
- Don't bypass PrimeVue components for standard UI patterns
- Don't use inline styles for spacing (use Tailwind classes)
- Don't add comments to code unless necessary
