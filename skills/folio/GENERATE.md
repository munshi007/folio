# Folio generate: many designers, one person

Use this when the user wants to *see options* rather than pick a preset: "show me some designs", "make it cool", "surprise me", "I don't like any of the themes", or right after their `folio.json` is filled in. The output is a gallery of N genuinely different sites built from the same content. They pick one and remix it.

## 1. Start the run

```bash
folio generate --count 6          # 4–8 is the sweet spot; --seed N reproduces a run
```

This writes N briefs to `.folio/gen/<run>/brief-<n>.md` and N theme files `themes/g<run>-<n>-<direction>.js`. Each brief combines a design direction, layout, motion level, palette strategy, type pairing and a signature interaction, weighted toward the person but with deliberate wildcards. Every theme file already renders (as the plain starter) and is marked `PENDING` until designed.

Then start the preview in the background and give the user the gallery link right away. Designs appear live as they land:

```bash
folio dev            # → http://localhost:4321/__folio/gallery
```

## 2. Design every brief

**If you can run subagents in parallel, do.** Give each subagent the full contents of its `brief-<n>.md` as its task; the brief is self-contained (what to build, the rules, the commands, when to stop). Tell each one it may only edit its own `themes/g<run>-<n>-*.js` file.

If you can't run subagents, work through the briefs yourself one at a time, each to its stop condition. Mention progress to the user between briefs ("3 of 6 done, gallery updates live").

What makes a run good:
- **Range over safety.** If two results look like siblings, the run failed. Each designer commits fully to its brief.
- **Their real content.** Designs are judged on this person's actual data, not lorem ipsum.
- **Every result passes `folio theme check` with 0 errors.** The gallery won't let the user pick one that fails.

## 3. Present

When all briefs are done (or after ~10 minutes, whichever comes first), tell the user:
- the gallery URL,
- one line per design: its idea in plain words,
- which one *you* think fits them best and why (one sentence; it's their call).

## 4. Pick and remix

- "I like #3" → `folio pick g<run>-3-<dir> --as <their-name-or-a-nice-name>`. It renames the file and sets it in `folio.json`.
- "#2 but with #5's colors / less motion / projects first" → copy the picked theme with `folio theme new <name> --from` (or `folio pick … --as`), then edit following DESIGN.md's check → shot → critique loop. Pull the specific element from the other design's file.
- "None of these" → ask what they liked and disliked in one question, then `folio generate` again with fewer, sharper briefs. Use `--count 3` and edit the briefs to bias toward what they said.
- Unpicked `g<run>-*` theme files can stay (they're local drafts) or be deleted when the user is happy. Ask before deleting.

Generated drafts, briefs and screenshots live in `.folio/`, which ignores itself in git.
