# Folio design: a one-off theme for one person

Use this when the user wants their site to look like *theirs*: "make it unique", "I don't like these themes", "make it look like a magazine / a blueprint / my favorite site", or when their `folio.json` is done and they want better than a built-in theme.

The goal is a site nobody would mistake for a template, that still reads in 5 seconds. You work in a loop: **brief → direction → build → check → screenshot → critique → fix**, at most 3 rounds.

## 1. Brief (no more than one question)

Read `folio.json` and answer for yourself:
- **Who's reading?** Recruiters at big tech, startup founders, art directors, academic hiring committees, clients.
- **What's their strongest asset?** Shipped work with visuals, impressive numbers, open-source traction, writing, a long career, research.
- **What shape is the content?** 2 projects or 12? 1 job or 8? Long about text or none? Design for the content they *have*.
- **What's their personality?** Look at the headline, the about text and the kind of projects.

Ask at most one question, and only if it changes the direction: *"Three words for how you want people to feel when they land on your site?"* Skip it if they've already said.

## 2. Pick a direction

Propose **three directions** in one message: a name, one sentence on why it fits them, and the type pairing. Let them pick, or pick yourself if they said "surprise me". Start from this library; mixing two is fine.

| Direction | Fits | Type (Google Fonts) | Palette rule | Layout idea | Signature moment |
|---|---|---|---|---|---|
| **Swiss / International** | engineers, designers, minimalists | **Schibsted Grotesk** or **Familjen Grotesk** | black, white, one loud color (red/orange) | strict 12-col grid, flush-left, big numbers as structure | huge name set tight, section numbers in the accent |
| **Editorial magazine** | writers, PMs, researchers | **Fraunces**/**Newsreader** + **Instrument Sans** | warm paper, ink, one muted accent | asymmetric columns, pull-quote about, drop cap | italic headline, numbered features like a contents page |
| **Technical blueprint** | infra, hardware, data, ML | **IBM Plex Mono** + **IBM Plex Sans** | blueprint blue or graphite, hairline grid | spec-sheet tables, labeled callouts, dimension lines | faint grid background, items labeled like `FIG. 03` |
| **Data-native** | data/ML/analytics | **JetBrains Mono** + **DM Sans** | neutral with chart colors | metrics as the hero (stars, years, users), small multiples | sparkline or bar made from their real numbers (pure CSS/SVG) |
| **Brutalist** | indie hackers, creatives, contrarians | **Archivo Black**/**Space Mono** | raw: white, black, system blue links | visible borders, no rounding, dense blocks | oversized outlined type, hard shadows on hover |
| **Archive / index** | people with many projects | **Instrument Serif** + **Geist Mono** | off-white, gray, tiny accent | everything as a catalog table: № · title · year · type | sortable/filterable index of work (small vanilla JS) |
| **Academic paper** | researchers, PhD students | **Source Serif 4** + **Source Sans 3** | pure paper and ink, link blue | single column like a paper, abstract-style about | publication list with venue/year, LaTeX-like small caps |
| **Soft / organic** | product, UX, education, wellness | **Bricolage Grotesque** + **Figtree** | warm pastels, never neon | rounded shapes, generous whitespace | slow, subtle blob or grain texture behind the hero |
| **Retro computing** | systems, security, retro fans | **VT323**/**IBM Plex Mono** | phosphor on black, or Mac OS 1 gray | windows, title bars, pixel borders | one interactive "window" (like a fake finder of projects) |
| **Zine / collage** | artists, community builders | **Bagel Fat One**/**Rubik Mono One** + a plain serif | 2–3 riso ink colors | overlapping blocks, rotated labels, stickers | tape/sticker labels on project cards |

These are starting points, not templates. If they name a site they love, extract its *principles* (type scale, grid, color logic) and never copy its code or assets.

## 3. Build

1. `folio theme new <name>` creates `themes/<name>.js` from a starter that already renders every section safely. `--from bento|editorial|terminal` starts from a built-in instead.
2. Change in this order: **design tokens** (fonts, colors, spacing scale), then **layout**, then **one signature moment**. One memorable idea beats five effects.
3. Preview live with `folio dev --theme <name>` (it reloads on save).

Hard rules (the checker enforces most):
- Every profile value goes through `h.esc`, `h.inline`, `h.md` or `h.attrUrl`. Never interpolate raw.
- No external `<script src>`. Small inline JS for progressive enhancement only, and the page must work without it.
- At most 2 font families, loaded through `fonts`. No icon fonts; use `h.icon()` or inline SVG.
- Must handle both color schemes, phones (`@media (max-width: …)`), `prefers-reduced-motion`, and `:focus-visible`.
- Handle content extremes: a 40-character name, no avatar, no projects, 10 jobs, an about with 3 paragraphs.
- Fill empty space with *their* facts, never filler: e.g. derived numbers (years since first role, project count, total stars) computed from `p`, not typed in.
- Effects inspired by Magic UI, Aceternity or React Bits are welcome, rebuilt in plain CSS/JS. Never copy their source.

## 4. Check, screenshot, critique (max 3 rounds)

Each round:
1. `folio theme check <name>`. **0 errors is required**; treat warnings as fix-or-justify.
2. `folio shot --theme <name>` writes full pages plus readable `-partN` slices for desktop and phone, light and dark, into `folio-shots/`. **Look at the slices**, not just the full-page thumbnails. No Chrome? Use your own browser or screenshot tool on `folio dev`.
3. Score each line 1–5 and write the scores down:

| Criterion | What a 5 looks like |
|---|---|
| **5-second read** | Name → what they do → best work, in that order, without scrolling on desktop |
| **Typography** | Clear scale (≥ 3 distinct sizes), body 45–75 characters per line, no widows in headings, pairing has contrast |
| **Rhythm** | Consistent spacing scale; related things close, sections clearly separated |
| **Color & contrast** | Body text ≥ 4.5:1, accent used sparingly and consistently, dark mode as considered as light |
| **Phone** | No sideways scroll, readable without zoom, tap targets ≥ 44px, hero fits the first screen |
| **Content fit** | Their real content looks intentional: no orphan cards (an odd last item should span the row), awkward gaps or truncated text |
| **Distinctiveness** | Couldn't be mistaken for a template; the signature moment is visible on the first screen |
| **Polish** | Alignment, consistent radii and borders, hover and focus states, no layout shift |

4. Fix the **lowest scores first**. Stop when everything is ≥ 4, or after round 3; then tell the user honestly what's still weakest.

## Banned (the generic-AI look)

- Purple/blue gradient on white, gradient text on everything, glassmorphism cards everywhere
- Inter, Roboto, Arial, Poppins, Montserrat, Space Grotesk as the main face
- Centered hero with "Hi, I'm X 👋" and a blurry gradient blob
- Emoji as icons; skill bars or percentage meters (they mean nothing)
- Every section in identical rounded cards; drop shadows on everything
- Fake terminals, typing effects or particle backgrounds unless that *is* the chosen direction
- Animations on every element; scroll-jacking
- Inverting, tinting or distorting a person's photo (grayscale is fine; a negative is not), and cropping off the face on phones

## 5. Present

Show the user one desktop slice and one phone slice of the first screen, say in two sentences what the direction is and why it fits them, and offer 1–2 specific tweaks ("warmer accent?", "projects before experience?"). When they approve, set `"theme": "<name>"` in `folio.json`.
