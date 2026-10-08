# Reading the person, and finding their worlds

Every design starts from how folio reads someone. Get this right and six designs feel like six versions of *them*; get it wrong and they're six versions of nobody.

## The persona

Read `folio.json`, their resume and their GitHub READMEs, plus the three taste answers (Studio → Persona, or ask them). Then write:

```json
{
  "headline": "one line, how you read them",
  "lede": "two plain sentences",
  "traits": [{ "key": "mood|voice|signature|taste|edge", "value": "…", "quote": "their own words, verbatim", "source": "resume|github|linkedin|answers|you|site" }],
  "dials": { "energy": 0-10, "warmth": 0-10, "techDepth": 0-10, "playfulness": 0-10, "formality": 0-10 },
  "worlds": ["their fields and interests, as visual cultures"],
  "answers": { "feel": [], "show": [], "taste": [] },
  "implications": ["what this means for the design"],
  "avoid": ["what would feel wrong to them"]
}
```

Save with `folio persona write <file.json>`. Every save is a version, so a bad read is one click to undo in Studio.

Rules:
- **Quotes are their real words.** No trait without a quote or an answer behind it.
- **Their answers outrank the CV's tone.** A CV is written in someone's most formal voice; read only the CV and the persona comes out dark and one-note. If they picked "Light & airy", the persona is light.
- **Show it, then ask.** Point them to Studio → Persona. A one-line correction ("warmer than that") becomes a job: `folio jobs next` hands it to you with the correction and the current persona.

## References: their worlds, not other portfolios

Searching "portfolio for X" returns the average portfolio, the look we're escaping. Search the visual culture of their **worlds** instead: an astronomer gets star atlases and observatory logbooks; a data engineer gets engineering drawings and mission checklists; someone who loves transit gets route maps.

Sources, in order of preference:
1. **Open archives and collections:** Wikimedia Commons, the Met / Smithsonian / Cooper Hewitt open-access collections, Internet Archive, NASA's image library, public-domain standards and specimens.
2. **Designers' public boards** via official APIs (e.g. Are.na).
3. **Normal web search and page reading** within each site's rules: respect robots.txt, terms and rate limits; never log in, never get around bot protection or paywalls. If a site blocks you, it's not a source.

Save each as principles plus a credit link, with `folio refs add <file.json>`:

```json
[{ "title": "Transit maps", "kind": "archive|standard|web|own", "url": "https://…", "credit": "who made it", "license": "public domain | CC BY | article",
   "world": "Toronto transit", "why": "one line: why it fits them",
   "principles": ["thick colored lines as navigation", "round stations"], "moves": ["projects as stations on colored lines"],
   "specimen": { "colors": ["#da251d", "#f6c400"], "font": "optional" } }]
```

Never store images, page text or code: folio refuses them. Principles and a link are all a designer needs, and all that's safe to keep.

## Inventing sketches

`folio sketch auto` samples instant sketches from the persona and what they liked. To add real invention, write your own round (`folio jobs next` may hand you this as a job):

1. List ~20 candidate directions with a rough probability that a generic designer would propose each.
2. Pick 12 that span the space, **including several low-probability ones**. Vary light/dark, quiet/loud, serif/sans/mono/hand, layout and motif; at most two share a layout.
3. Tie each to a reference where you can (`"refs": ["transit-maps"]`).
4. Save with `folio sketch add <file.json>`; the shape is printed by the job brief, and `folio sketch add` validates it.

This is "verbalized sampling": asking for options *with probabilities* measurably widens what language models produce, instead of collapsing to the typical answer.
