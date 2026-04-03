---
name: cloudflare-add-page
description: Add one new article to the Cloudflare Field Guide at /Users/mark/otherprog/cloudflare-book. Fetches real Cloudflare docs, writes a magazine-style article, and wires it into the site. Writes exactly one article per invocation.
---

## Purpose

Add exactly one new article to the Cloudflare Field Guide. This is a personal study site at `/Users/mark/otherprog/cloudflare-book` that explains Cloudflare products in plain language — what they are, how they work, and what people build with them. It is not a configuration guide. The target audience is **engineers**, so lean into technical depth: implementation details, tradeoffs, data models, and architectural decisions are welcome.

**If there are no more articles to write, do nothing and say so.**

---

## Step 1 — Find what needs writing

Read `index.html` to see which nav links are marked `coming-soon` — those are the articles that don't exist yet. Also check `content/` to confirm which `.md` files already exist.

Pick **one** product from the coming-soon list. Prefer products that are central to the developer platform (Workers, D1, KV, Durable Objects) over niche ones, but use your judgement. If the user has specified a product in their message, use that one.

If every nav link already has a corresponding file in `content/`, stop here and tell the user there's nothing left to write.

---

## Step 2 — Fetch the documentation

Cloudflare's developer docs expose a markdown version of every page. Append `index.md` to the URL to get it. For example:

- `https://developers.cloudflare.com/workers/index.md`
- `https://developers.cloudflare.com/d1/index.md`
- `https://developers.cloudflare.com/kv/index.md`
- `https://developers.cloudflare.com/durable-objects/index.md`
- `https://developers.cloudflare.com/pages/index.md`
- `https://developers.cloudflare.com/workers-ai/index.md`
- `https://developers.cloudflare.com/ai-gateway/index.md`
- `https://developers.cloudflare.com/vectorize/index.md`
- `https://developers.cloudflare.com/agents/index.md`

Fetch the index page for the product you chose. If that page links to sub-pages that seem relevant (architecture, how it works, limits, pricing), fetch one or two of those as well. You're looking for:
- What the product actually does
- How it works technically (storage model, execution model, consistency guarantees, pricing model, limits)
- What it integrates with
- Any distinctive design decisions or tradeoffs

You do not need to read every sub-page — just enough to understand the product well enough to explain it accurately.

---

## Step 3 — Write the article

Write the article to `content/{slug}.md` where the slug matches the nav href (e.g. `workers` for `#/workers`).

### Structure

Each article has three sections, always in this order:

1. **Opening (no heading)** — A lede paragraph and short punchy intro. What is this product, and why does it exist? What problem does it solve, and what's distinctive about Cloudflare's approach? This is the "magazine cover story" paragraph — it should make someone want to keep reading.

2. **`## How It Works`** — The technical interior. Explain the actual model: how data flows, what the execution environment looks like, what the consistency guarantees are, what the API surface is, how it integrates with the rest of the Cloudflare platform. Go one level deeper than the marketing page. Use bold text to call out the key concepts as you introduce them.

3. **`## In the Wild`** — Three to five concrete use cases. Each one should read like a short story: who uses this, what they're doing with it, why this product specifically fits that job. Avoid generic "you could use this for X" statements — make it specific and vivid.

Optionally add a `## What It Doesn't Do` section at the end if there are meaningful limitations or misconceptions worth correcting. Keep it short.

4. **`## Further Reading`** — Four to six links to relevant external resources. Include a mix of: official Cloudflare docs, blog posts (Cloudflare blog or third-party), any interesting technical deep-dives, or related tools. Format each as a markdown link followed by a one-sentence description of what makes it worth reading. This section should feel like a "if you want to go deeper" curated list, not a list of homepage links.

### Style rules

- Write like a magazine, not a manual. Vary sentence length. Use occasional short sentences for emphasis.
- No bullet lists in the opening or How It Works sections. Use prose. Bold key terms the first time you introduce them.
- Bullet lists are acceptable in "In the Wild" only if each bullet is a self-contained story with enough detail to be interesting.
- No setup instructions, no CLI commands, no "step 1 / step 2" sequences. That's what the real docs are for.
- Concrete over abstract. "A 5TB checkpoint file" is better than "large files". "$90 per terabyte" is better than "significant egress costs".
- End with a brief italic line linking to the next logical article: `*Next: [Product Name](#/slug) — one-line description.*`
- Aim for 600–900 words. Long enough to be genuinely informative, short enough to read in five minutes.

### Reference the existing R2 article for tone

`content/r2.md` is the canonical example of what these articles should feel like. Read it before writing if you're unsure about tone.

---

## Step 4 — Wire it into the site

After writing the content file, make two small code changes:

**In `app.js`** — add the route to the `routes` object:
```js
'/workers': 'content/workers.md',
```

**In `index.html`** — find the nav link for this product and remove the `coming-soon` class:
```html
<!-- before -->
<a href="#/workers" class="coming-soon">Workers</a>

<!-- after -->
<a href="#/workers">Workers</a>
```

---

## Deliverable

Report:
- Which product you wrote about
- The file path created
- One sentence on what makes this product interesting
