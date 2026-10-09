# Contributing to folio

Thanks for helping. folio is plain Node (22.4+) with **zero runtime dependencies**; please keep it that way.

## Setup

```bash
git clone https://github.com/munshi007/folio && cd folio
npm test                     # the whole suite, ~2 minutes; uses Chrome if installed
node bin/folio.js studio     # try your changes (in any folder with a folio.json)
```

Use the fictional demo profile in `examples/folio.example.json` for screenshots and tests. Never commit real personal data (yours or anyone's).

## Good first contributions

- **A new design direction** in `src/generate.js` (`DIRECTIONS`): a name, a Google Fonts pairing, one-line note, job tags and mood tags. Mood tags (`light`, `dark`, `colorful`, `crafted`, `sleek`, `calm`, `bold`, `playful`, `serif`, `mono`, `hand`, `warm`, `tech`) are how personas pick it.
- **A built-in theme** in `themes/`: it must pass `folio theme check <name>` with 0 errors (the test suite checks every built-in).
- **Sketch layouts and motifs** in `src/sketch.js`.

## Rules for designs and themes

Every profile value goes through the helpers (`h.esc`, `h.inline`, `h.md`, `h.attrUrl`); nothing about a person is hardcoded; no external scripts; light and dark, phones, focus styles and reduced motion all work. `skills/folio/DESIGN.md` has the full rubric.

## Pull requests

- One change per PR, with a test when behaviour changes (`test/folio.test.js`).
- `npm test` passes locally.
- For anything visual, add a before/after screenshot (`folio shot`).
