# Folio generate: many designers, one person

Use this when the user wants to *see options* rather than pick a preset: "show me some designs", "make it cool", "surprise me", "I don't like any of the themes", or right after their `folio.json` is filled in. The output is a gallery of N genuinely different sites built from the same content. They pick one and remix it.

## 1. Start the run

```bash
folio generate --count 6          # 4–8 is the sweet spot; --seed N reproduces a run
```

This writes N briefs to `.folio/gen/<run>/brief-<n>.md` and N theme files `themes/g<run>-<n>-<direction>.js`. Each brief combines a design direction, layout, motion level, palette strategy, type pairing and a signature interaction, weighted toward the person but with deliberate wildcards. Every theme file already renders (as the plain starter) and is marked `PENDING` until designed.

Then start Studio in the background and give the user the link right away. Designs appear live as they land:

```bash
folio dev            # → http://localhost:4321/studio
```

Studio keeps every design and version, so don't delete theme files to "clean up": the user can archive in Studio. Edits you make to a theme file are captured as new versions automatically.

## 2. Design every brief

A run is a **job**. Rounds can also be started by the user from Studio ("New round of designs", "More like this"); then they'll ask you to "work on my folio jobs". Either way you pick up work the same way:

```bash
folio jobs next          # claims one waiting design, prints its brief and which file to edit
folio jobs next --json   # same, machine-readable: {job, theme, themePath, briefPath, brief}
folio jobs               # progress of every job
```

Each claim is yours for 20 minutes and no other worker gets it, so **parallel subagents are safe**: start one per design, and have each run `folio jobs next` itself, design the theme it got, then claim again until it prints "nothing waiting". Without subagents, loop through them yourself, telling the user progress as you go ("3 of 6 done, Studio updates live").

A design counts as done when its file no longer says `PENDING` and `folio theme check` passes; Studio shows that automatically.

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
- **"More like #4" / "I like this one, show me variations"** → ask *one* question first: what do they like about it: the overall vibe, the colors, the typography, the layout, or the signature moment? Then `folio generate --like g<run>-4-<dir> --keep <vibe|colors|type|layout|signature>` (default 3). Each variation starts as an exact copy, keeps only that, and changes **two** big things, with a color change somewhere in the set unless colors are kept. One-change siblings looked identical at gallery size; don't go back to that. Design them like a normal run (one subagent per brief, in parallel if you can). The gallery shows the original first. Repeat on the winner; each round converges.
- "#2 but with #5's colors / less motion / projects first" → copy the picked theme with `folio theme new <name> --from` (or `folio pick … --as`), then edit following DESIGN.md's check → shot → critique loop. Pull the specific element from the other design's file.
- "None of these" → ask what they liked and disliked in one question, then `folio generate` again with fewer, sharper briefs. Use `--count 3` and edit the briefs to bias toward what they said.
- Unpicked `g<run>-*` theme files can stay (they're local drafts) or be deleted when the user is happy. Ask before deleting.

Generated drafts, briefs and screenshots live in `.folio/`, which ignores itself in git.
