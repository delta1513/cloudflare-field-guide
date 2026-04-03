# Pages: Deploy to the Edge, Not to a Server

There's a moment familiar to every web developer: you've built something that works locally, and now you have to figure out where it lives. For static sites — portfolios, documentation, marketing pages, pre-rendered apps — the answer used to involve S3 and CloudFront, or a VPS running nginx, or a platform like Netlify or Vercel. Each option added operational surface area that had nothing to do with building the actual product.

Cloudflare Pages compresses that overhead toward zero. Connect a Git repository, tell Pages your build command, and your site is live on Cloudflare's global network within minutes. But Pages has grown past static hosting. With **Pages Functions**, every deployment can include server-side logic that runs on the same Workers runtime used by Cloudflare's own products.

---

## How It Works

**Deployment is git-native by design.** Connect Pages to a GitHub or GitLab repository and it watches for pushes. Every push to your production branch triggers a build: Pages pulls the code, runs your build command in a Linux container with Node.js pre-installed, and distributes the output. Build timeouts are set at 20 minutes; most builds finish in under two. Free accounts get 500 builds per month.

**Static assets live at the edge, not at an origin.** When Pages deploys your files, they don't go to a data center in Virginia. They're distributed across Cloudflare's network — 300+ cities — so a user in Tokyo requesting your site gets a response from a location nearby, not from across an ocean. This isn't a CDN caching in front of an origin server. There is no origin. Your HTML and JavaScript exist at the edge natively.

**Every deployment is a permanent URL.** Not just production — every push, every branch, every pull request. Push a feature branch called `feat-dark-mode` and Pages creates a unique preview URL, something like `feat-dark-mode.my-project.pages.dev`. Share it in a PR for design review, give it to QA, let a stakeholder approve it before it ships. When the PR merges, that URL keeps working as a historical record. Production is stable; everything else gets its own permalink.

**Pages Functions are Workers running inside your deployment.** Add a `functions/` directory to your project and you're writing server-side code that runs in V8 isolates — the same runtime, the same cold-start characteristics, the same performance profile as standalone Workers. The file system maps to URL routing: `functions/api/user.js` handles requests to `/api/user`, and `functions/api/orders/[id].js` handles requests like `/api/orders/abc123` with the ID extracted automatically. Middleware can wrap entire subtrees of routes.

**Bindings wire your functions to Cloudflare's data platform without credentials or network hops.** Declare a binding in your Pages configuration and the runtime injects it directly into your function's environment. Your function can read from an R2 bucket, query a D1 database, or write to a KV namespace using the same APIs available to any Worker — no HTTP calls, no environment variables holding API keys, no authentication roundtrips between components. The function and the data run in the same environment.

**Rollbacks are immediate.** Every successful build persists. Revert to any previous deployment via dashboard or API and the change propagates globally within seconds. There's no cache to invalidate, no origin to drain — the previous deployment is already distributed everywhere, waiting to become current again.

Individual files have a 25 MiB size limit. Free accounts can deploy up to 20,000 files per site; paid accounts raise that to 100,000. Custom domains are supported up to 100 per project on free plans.

---

## In the Wild

**Documentation sites that serve developers globally.** A developer tools company maintains hundreds of API reference pages, framework guides, and changelog entries. Engineers preview new docs against their feature branch before the feature ships; technical writers commit markdown and get a preview URL without touching a staging server; the translated Japanese version builds in parallel on its own branch. Pages handles all of it, and the global distribution means developers in Singapore read the docs with the same latency as developers in New York.

**E-commerce storefronts with dynamic checkout.** The product catalog — thousands of category pages, product detail pages, search result templates — renders statically at build time and serves from the edge with no server involved. Checkout is different: cart state, inventory availability, and payment processing need to be live. Pages Functions handle those endpoints, talking to a D1 database for inventory and a payment processor for transactions. Because the D1 binding is injected directly into the function environment, there's no connection string, no connection pool to manage, and no cold-start overhead opening a new database connection. One project, one deployment, no separate API server to provision or scale.

**SaaS apps where the marketing site and the product are the same domain.** The homepage and pricing pages are static, instant, SEO-friendly. Behind the login, Pages Functions validate session tokens against KV, fetch user-specific data, and serve personalized API responses. The `/functions/api/` directory mirrors the API surface: one route per resource, structured like a small application. A `_middleware.js` at the root of `functions/` can enforce authentication across every route in that subtree — one place for the auth check, zero repetition across handlers. Cloudflare Access can sit in front of the entire deployment for organizations that want corporate SSO without building an auth layer.

**Internal tools that non-engineers need to approve.** A data team ships a Svelte-based reporting dashboard to Pages, shares the preview URL with the product director who requested it, and waits for a thumbs-up before pushing to production. No staging server to maintain, no VPN to connect, no credentials to distribute. The preview URL works in a browser, period.

---

## What It Doesn't Do

Pages Functions share quota with your Workers plan. Heavy function traffic on Pages counts against the same bucket as standalone Workers — teams that treat them as separate products sometimes discover this the hard way when usage spikes on both sides simultaneously.

The file-count limits (20,000 on free, 100,000 on paid) constrain large sites with granular asset trees. A documentation site with thousands of individual markdown-to-HTML files, images, and code samples can hit the ceiling. The workaround is to consolidate assets through bundling or move large binary assets to R2.

Pages also isn't the right tool for long-running background work, stateful real-time connections, or coordinating requests across multiple users. For that, the right answer is [Durable Objects](#/durable-objects), which offer persistent, addressable compute that lives alongside your Pages deployment.

---

## Further Reading

- [**Pages Functions routing and middleware**](https://developers.cloudflare.com/pages/functions/routing/) — The canonical reference for file-system-based routing in Pages Functions: dynamic segments, catch-all routes, and how `_middleware.js` files scope middleware to subtrees. Essential reading before you build anything beyond a simple API handler.

- [**Bindings reference for Pages Functions**](https://developers.cloudflare.com/pages/functions/bindings/) — Covers how to wire KV namespaces, D1 databases, R2 buckets, Durable Objects, and other Cloudflare primitives into your functions via `wrangler.toml` or the dashboard, including the difference between production and preview environment bindings.

- [**Cloudflare Pages goes full-stack**](https://blog.cloudflare.com/cloudflare-pages-goes-full-stack/) — The original blog post announcing Pages Functions, written by Cloudflare engineers. Goes into the design decisions behind co-locating server-side logic with static assets and how the V8 isolate model applies to Pages.

- [**Bringing a unified developer experience to Cloudflare Workers and Pages**](https://blog.cloudflare.com/pages-and-workers-are-converging-into-one-experience/) — Explains the ongoing architectural convergence between Pages and Workers: what changes, what stays the same, and what it means for teams that have deployed both products separately.

- [**Smart Placement for Pages Functions**](https://developers.cloudflare.com/pages/functions/smart-placement/) — Documents the opt-in feature that moves your function's execution point closer to its back-end dependencies rather than the end user — a meaningful architectural shift when your function makes multiple subrequests to a centralized database or API.

- [**Preview deployments configuration**](https://developers.cloudflare.com/pages/configuration/preview-deployments/) — Details the alias scheme (`<branch>.<project>.pages.dev`), access controls for preview URLs, branch deployment controls, and how to restrict or customize which branches trigger builds — useful once the default behavior isn't enough.

*Next: [AI Agents](#/ai-agents) — Cloudflare's platform for building autonomous agents that run on the same global network.*
