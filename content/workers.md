# Workers: Serverless at the Edge

Cloudflare Workers is a serverless compute platform, but that description undersells what makes it unusual. Most serverless platforms run your code in a data center near one of three or four geographic regions, spin up a container when a request arrives, and tear it down when it's done. Workers runs your code in over 330 cities worldwide, and instead of containers, uses a fundamentally different execution model borrowed from the browser. The result is a platform where deploying new code goes live in seconds globally, and where "serverless cold start" is essentially a solved problem.

The insight that makes Workers distinctive is treating compute the way Cloudflare already treats DNS and CDN: as something that should be distributed to the edge of the network, not pooled in a handful of data centers. When a request hits Workers, it's handled at the nearest Cloudflare location. The code executes close to the user. Not "served from a CDN cache" close — actually *computed* close.

---

## How It Works

The execution environment is built on **V8 isolates** — the same JavaScript engine that powers Chrome and Node.js, but without the full Node runtime. An isolate is a lightweight, sandboxed context for running code. A single runtime process can host hundreds of isolates simultaneously, each completely isolated from the others in memory. When Cloudflare starts a new Worker, it doesn't launch a container or boot a virtual machine. It creates a new isolate inside an already-running process. That startup takes a fraction of a millisecond — about a hundred times faster than a cold Node.js container, with an order of magnitude less memory overhead.

This is the core reason Workers has no meaningful cold start problem. The expensive initialization — loading the V8 runtime, warming up the JIT compiler — happens once per machine. Every new Worker isolate reuses that infrastructure. Your code is ready essentially instantly.

**The execution model is event-driven and single-threaded.** A Worker exposes a `fetch()` handler that receives a `Request` object and returns a `Response`. When async operations happen — outbound HTTP calls, reads from storage — the event loop handles other requests during the wait. `ctx.waitUntil()` extends the isolate's lifetime past response delivery for background work like logging or cache warming, but the CPU budget still applies. Global state is deliberately unreliable: Cloudflare may route two consecutive requests to different isolate instances in different cities, and any isolate can be evicted at any time. If you need state that persists across requests, that's what the storage bindings are for.

Workers runs at Cloudflare's 330+ edge locations by default, with each request handled at the location closest to the user. **Smart Placement** can override this: it analyzes your subrequest patterns and automatically routes execution closer to your databases or APIs when that yields better end-to-end latency than proximity to the user. Workers supports JavaScript, TypeScript, Python, and Rust. Other languages can be compiled to WebAssembly and run inside an isolate.

**Limits and pricing are deliberately simple.** The free tier gives 100,000 requests per day with 10ms of CPU time per invocation. The paid plan ($5/month) includes 10 million requests and 30 million CPU milliseconds monthly; beyond that, additional requests run $0.30 per million and CPU time $0.02 per million milliseconds. Each isolate caps at 128MB of memory. The paid plan raises the CPU limit to 5 minutes per request — enough for heavy computation. There are no egress or bandwidth charges.

**Storage and service bindings** are the real productivity unlock. Workers accesses R2, D1, KV, Durable Objects, Queues, and Workers AI through direct bindings — not HTTP calls, but in-process access with no network hop. A Worker reading from R2 or querying D1 isn't making an authenticated API call; it's calling a method on an object the runtime wires up at boot via a capability-based system. Bindings are declared in `wrangler.toml`, injected into the isolate's global scope, and carry their own access credentials — your Worker code never handles secrets directly.

---

## In the Wild

**API middleware and edge authentication.** A company running microservices can put a Worker in front of their entire API surface. The Worker validates JWTs, rewrites paths, enforces rate limits, and logs structured events — all before a request reaches the origin. Adding a new authentication rule is a Worker deploy, not a backend release. Latency for rejected requests drops from hundreds of milliseconds to single digits.

**Server-side rendering at the edge.** React applications using Next.js or Remix can run their server rendering in a Worker, so HTML is computed at the closest Cloudflare location for every request. For a global user base, this transforms a 200ms time-to-first-byte from a single-region origin into something under 50ms worldwide. Cloudflare Pages runs exactly this pattern under the hood.

**Image and content transformation pipelines.** A media platform stores originals in R2 and uses a Worker to serve transformed versions: resize on demand, convert to WebP, strip EXIF data, add a watermark. The logic lives in the Worker; the storage lives in R2. No image processing server, no separate CDN configuration — the transformation runs at the edge on every cache miss.

**Cron-driven background jobs.** Workers can be triggered on a schedule using standard cron syntax instead of HTTP requests. A fintech company runs reconciliation jobs every hour: read transaction records from D1, aggregate balances, write results back, fire an alert if anything looks wrong. What once required a scheduled Lambda and an SQS queue is now a single Worker file.

**A/B testing without touching the backend.** A growth team wants to route 10% of users to a new checkout flow. A Worker intercepts every request to `/checkout`, reads or sets a cookie, and rewrites the URL accordingly. The experiment is live globally within seconds of deployment — no CDN cache rules, no feature flag service, no backend deploy.

---

## What It Doesn't Do

Workers is not a general-purpose compute environment. The 128MB memory limit rules out large in-memory data processing, and the CPU cap makes long-running batch jobs impractical — though Cloudflare Workflows handles those with durable execution. Workers can't run arbitrary binaries or system calls; the isolate sandbox is stricter than a container.

Global state across requests requires explicit storage. KV handles eventually-consistent reads; Durable Objects handle strongly-consistent coordination. Module-level variables work within a single isolate but don't survive eviction or span multiple instances.

---

## Further Reading

- [How Workers Works](https://developers.cloudflare.com/workers/reference/how-workers-works/) — The official reference covering V8 isolate lifecycle, the fetch event model, and how the runtime manages hundreds of isolates within a single process.

- [Cloud Computing without Containers](https://blog.cloudflare.com/cloud-computing-without-containers/) — The original Cloudflare blog post that laid out the isolate-over-container thesis; essential background on *why* the architecture looks the way it does.

- [Eliminating Cold Starts with Cloudflare Workers](https://blog.cloudflare.com/eliminating-cold-starts-with-cloudflare-workers/) — A technical deep dive into how Cloudflare pre-warms Workers by piggybacking on the TLS handshake, reducing cold-start latency to under 5ms.

- [Mitigating Spectre and Other Security Threats: The Cloudflare Workers Security Model](https://blog.cloudflare.com/mitigating-spectre-and-other-security-threats-the-cloudflare-workers-security-model/) — Detailed write-up of the multi-layer defense strategy: V8 isolate memory protection, timer suppression, and process-level sandboxing used to harden the shared-runtime model.

- [Introducing workerd: the Open Source Workers Runtime](https://blog.cloudflare.com/workerd-open-source-workers-runtime/) — Announcement post for the Apache 2.0 runtime that powers production Workers, with architecture notes on its Cap'n Proto RPC internals and how Miniflare uses it for local development parity.

- [Smart Placement speeds up applications by moving code close to your backend](https://blog.cloudflare.com/announcing-workers-smart-placement/) — Explains how Smart Placement measures real subrequest latency and automatically relocates Worker execution away from the user and toward origin services when that reduces end-to-end response time.

*Next: [D1](#/d1) — Cloudflare's serverless SQL database, built to live alongside Workers at the edge.*
