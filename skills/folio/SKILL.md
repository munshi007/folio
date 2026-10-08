---
name: folio
description: Turn a resume (PDF/DOCX/text), GitHub profile and/or LinkedIn export into a personal portfolio site, by generating several genuinely different designs for the user to pick from, then refining and deploying it to GitHub Pages. Use when the user asks to make, update, redesign or publish a portfolio, personal site, developer homepage, or "website from my resume".
---

# Folio — six designers, one person

You turn what the user already has (a resume, a GitHub account, a LinkedIn export, a few sentences) into a portfolio site they're proud to share. The `folio` CLI renders, checks, screenshots and deploys. **Your two jobs:** the content (extracting facts accurately and writing them so a recruiter gets it in 10 seconds) and the designs (several genuinely different ones, built for this person, so they choose rather than settle for a preset).

Run the CLI with `npx -y folio-site@latest <command>` (call it `folio` below).

## Workflow

### 1. Gather inputs (ask once, briefly)
Look for what's already available before asking: a resume file in the working directory (`*.pdf`, `*.docx`, `resume*`, `cv*`), an existing `folio.json`, a git remote pointing at GitHub. Then ask only for what's missing, in a single message:
- Resume file path (or "paste it")
- GitHub username (optional but recommended)
- Anything they want emphasized — target role, what they're proudest of, internship/job status

If they have nothing but a GitHub username, that's enough to start.

### 2. Create `folio.json`
- With GitHub: `folio init --github <user>` (pulls name, avatar, bio, top repos by stars + recency).
- Without: `folio init`.
- Then read the resume yourself and fill `folio.json` following the schema below. Merge, don't overwrite: GitHub-imported projects stay unless they're clearly noise (forks of tutorials, coursework boilerplate, empty repos, dotfiles if they have better work). Ask before deleting more than two.

### 3. Write the content — this is what makes or breaks the site
**Never invent facts.** No made-up metrics, employers, dates, user counts or star counts. If a bullet would be stronger with a number the resume doesn't have, ask the user for it ("Roughly how many people used StudyBuddy?") or leave it out. A fabricated number on a portfolio can cost someone a job offer.

- Copy credentials verbatim: degree names, job titles, company names, dates. Don't "upgrade" `Bachelors` to `BTech` or `Data Engineer` to `Senior Data Engineer`. Leave a date blank if the source doesn't give one.
- Write project descriptions from the repo itself (README, package metadata, homepage), not from the repo name. If a README says the project is unfinished or only planned, leave it out or say so.
- Contact details go on a public page: include email only if it's on the resume or the user gives it, and never add a phone number or street address without asking.
- When sources disagree (resume vs README vs LinkedIn), use the most recent and tell the user what you picked.

- **headline**: what they do + for whom/what, ≤ 10 words. "Backend engineer who makes payments boring" beats "Passionate software engineer". No "passionate", "enthusiast", "aspiring", "ninja", "guru".
- **status** (optional): one short line — "Open to Summer 2027 internships", "Freelancing · booking March". Only if the user confirms it.
- **about**: 2–3 short sentences, first person, concrete. Who they are → what they're into → one proof point. Use `**bold**` for a single key number at most. Separate paragraphs with a blank line.
- **experience highlights**: lead with the outcome, then how. "Cut CI time 38% by parallelizing test shards" not "Responsible for CI improvements". 2–3 per role, ≤ 20 words each.
- **projects**: `description` is one sentence: what it is + why it's interesting. Mark the 2–4 strongest `"featured": true` and order by impressiveness, not date. Put a live demo in `url` and source in `repo`. Add `highlights` only for featured ones.
- **skills**: group as Languages / Frameworks / Tools (or similar). 5–8 items per group, strongest first. Drop filler (MS Office, "Teamwork").
- Students: education goes in, with notable coursework/honours in `details`. Hackathon wins → `awards`.

If the person uploaded a resume in Studio → Content, `folio jobs next` hands you a **content** job naming the file in `.folio/inputs/`; fill folio.json from it with the rules above.

### 4. Read the person (persona), then gather references
Follow [PERSONA.md](PERSONA.md). In short:
1. If they haven't answered the three taste questions, ask them (or point them to Studio → Persona). A CV alone makes every persona too serious.
2. Write the persona (headline, traits **with their own words as quotes**, dials, worlds, implications, avoid) and save it with `folio persona write <file.json>`. Show them Studio → Persona and invite a one-line correction.
3. Gather 6–12 references from **their worlds** (not other portfolios) using open sources and normal web search that respects each site's rules; save principles + credit with `folio refs add <file.json>`. Never store images or copied text.

### 5. Sketch, then build what they like
1. `folio sketch auto` gives 12 instant first-screen sketches from the persona (no agent work). If you have time, also invent 12 with real range (PERSONA.md, "Inventing sketches") and add them with `folio sketch add <file.json>`.
2. Send them to **Studio → Explore** (`folio studio`): they like or skip; folio learns their taste and the next instant round leans toward it.
3. When they hit "Build full sites", it becomes a job: claim designs with `folio jobs next` and build each one in the language of the sketch they liked ([GENERATE.md](GENERATE.md) covers jobs and parallel subagents).

For a specific change to one design ("smaller name, louder projects"), edit that design file directly following [DESIGN.md](DESIGN.md)'s check → `folio shot` → critique loop. "More like this" (keep what they like, change two big things) is in GENERATE.md.

**Fallback (no time or no agent capacity):** the built-ins. `folio themes` lists them. `bento` suits students, full-stack and product folks; `editorial` writers, researchers and PMs; `terminal` systems and infra; `blueprint` data and ML. Set `"accent": "#hex"` for a brand color.

### 6. Preview and iterate
- Run `folio dev` in the background and give the user the URL (`http://localhost:4321`; the gallery is at `/__folio/gallery`). The control bar at the bottom switches designs, light/dark, font and section order, and saves to `folio.json`.
- Look at the page yourself before showing it: `folio shot --theme <name>` writes desktop and phone screenshots (one image per real screen) and reports page script errors. Fix anything awkward: overly long descriptions, a project with no description, an orphaned card.
- Run `folio validate` and address warnings.
- Iterate on their feedback by editing `folio.json`; the preview reloads automatically.

### 7. Deploy (only when the user says so)
`folio deploy` builds and force-pushes the site to the `gh-pages` branch of the repo's `origin` and tries to enable GitHub Pages. Before running it:
- Confirm the user wants it public, and which repo. For a root URL (`https://<user>.github.io/`) the repo must be named `<user>.github.io`.
- If there's no git repo/remote: `git init && gh repo create <name> --public --source=. --push` (ask first — this creates a public repo).
- Run `folio deploy --yes` only after they've confirmed. Then share the URL; Pages takes ~1 minute.
- Other hosts: `folio build` produces a static `dist/` that works on Vercel, Netlify, Cloudflare Pages.

Keep `"badge": true` (the small "built with folio" link) unless the user asks to remove it — then set `"badge": false` without fuss.

## Updating later
When the user says "I shipped X", "add my new job", "I won Y": edit the matching section, keep the writing rules, re-run `folio deploy` if they want it live.

## folio.json schema

```json
{
  "theme": "bento | editorial | terminal",
  "accent": "#4f46e5",
  "name": "required",
  "headline": "one line",
  "location": "City, Country",
  "status": "optional availability line",
  "avatar": "URL or relative path like img/me.jpg",
  "email": "adds a mailto link automatically",
  "url": "https://final-site-url (for canonical + social previews)",
  "about": "2–3 sentences. **bold**, *italic*, [links](https://...) supported. Blank line = new paragraph.",
  "links": [{ "label": "GitHub", "url": "https://github.com/..." }],
  "projects": [{
    "name": "required", "description": "one sentence",
    "url": "live demo", "repo": "source", "image": "screenshot URL or path (16:9 looks best)",
    "tags": ["Rust", "CLI"], "stars": 120, "year": "2025",
    "featured": true, "highlights": ["optional, featured only"]
  }],
  "experience": [{
    "role": "", "org": "", "url": "", "location": "",
    "start": "2024-06", "end": "present",
    "summary": "optional one-liner", "highlights": ["outcome-first bullets"]
  }],
  "education": [{ "school": "required", "degree": "", "start": "2022", "end": "2026", "details": "" }],
  "skills": [{ "group": "Languages", "items": ["TypeScript", "Go"] }],
  "awards": [{ "title": "", "org": "", "date": "2025-09", "url": "" }],
  "writing": [{ "title": "", "url": "", "date": "2025-03", "venue": "" }],
  "badge": true,
  "style": {
    "mode": "auto | light | dark",
    "font": "theme | serif | sans | mono",
    "sections": ["projects", "experience", "about", "skills", "education", "awards", "writing"],
    "hide": ["awards"]
  }
}
```

`style` works on every theme: `mode` forces light or dark, `font` swaps in a vetted pairing, `hide` removes sections, `sections` reorders them. Use it for quick requests ("make it dark", "projects first", "hide education") before reaching for a custom theme. The user can also click these in the `folio dev` control bar, which saves to `folio.json`.

Dates: `YYYY`, `YYYY-MM`, or `present`. Every section is optional except `name`; empty sections are hidden.
