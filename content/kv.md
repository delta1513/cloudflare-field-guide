# KV: The Global Edge Cache You Program Like a Database

There's a particular class of data that shows up in almost every production application: configuration values, feature flags, user preferences, routing rules, auth tokens. Data that changes infrequently but gets read constantly — potentially from every corner of the planet. Stuffing it in a relational database works until your app scales globally, at which point every edge request is suddenly making a round-trip to a single regional database. Workers KV was built for exactly this problem.

KV is a globally distributed key-value store that lives inside Cloudflare's network. It's not a general-purpose database. It's something more specific: a store optimized for the case where reads outnumber writes by an enormous margin, where you need those reads to be fast anywhere in the world, and where eventual consistency is acceptable.

---

## How It Works

The mental model that trips people up is the word "distributed." KV isn't distributed in the way that implies multiple synchronized nodes with consensus — it's better described as **centralized storage with distributed caching**. Your data lives in a small number of central Cloudflare data centers, backed by a sharded database with three-way replication per shard. When a Worker at an edge location reads a key, the value gets cached locally at two tiers: a regional cache close to the PoP, and a per-datacenter edge cache. Future reads from that same location are served from the nearest hot tier. The data travels outward on demand rather than being replicated everywhere up front.

This architecture has a sharp consequence: **eventual consistency**. Write a key, and it becomes visible immediately at the location where you wrote it. Everywhere else, it may take up to 60 seconds for the cache to expire and the new value to propagate. Cloudflare is transparent about this — the documentation says "up to 60 seconds or more." For feature flags or configuration values this is usually fine. For anything resembling a bank balance or a counter, it's a serious problem.

**Writes bypass the cache entirely.** When a Worker calls `put()`, the value goes directly to the central store. The edge cache doesn't get updated; it gets invalidated on next read. This means that write speed is bottlenecked by the distance to the central store, not the local edge. It also enforces a hard limit: **one write per second per key** — not per namespace, per individual key. (Namespace-level write throughput is also bounded; KV is explicitly not designed for high-frequency mutations or fan-out write patterns.)

**Reads, on the other hand, can be extremely fast.** A key that's been accessed recently from a given data center is served locally — no cross-network hop, no central-store lookup. The multi-tier structure means even cold reads step through a regional cache tier before reaching central storage, so the worst case is still better than going across the world.

The **API surface is minimal by design**: `put()`, `get()`, `list()`, and `delete()`. Values can be strings, ArrayBuffers, or streams. Keys max out at 512 bytes; values can be up to 25 MiB, large enough for a rendered HTML page or a substantial JSON blob. A metadata field attached to each key holds up to 1,024 bytes — useful for storing content type, timestamps, or cache control data alongside the value without having to decode the value itself.

Workers access KV through **bindings**: a zero-overhead, in-process connection declared in the Worker config. No HTTP call, no auth tokens to manage — the runtime injects the namespace directly. From outside Workers, there's also a REST API, which is handy for administrative operations or writing keys from CI/CD pipelines.

---

## In the Wild

**Feature flag delivery.** An e-commerce platform wants to roll out a new checkout flow to 10% of users without a deployment. They store a JSON blob in KV — `{"checkout_v2_rollout": 0.10}` — and every Worker read routes traffic accordingly. The flag changes once, reads happen millions of times. KV is a natural fit: updates propagate in under a minute, and there's no database to query on every request.

**Geolocation-based content rules.** A media company serves different video catalogs in different countries due to licensing agreements. Rather than querying a database for the country's content allowlist on every video request, they precompute the rules and store them in KV, keyed by country code. The Worker gets the user's country from the request headers (which Cloudflare adds automatically), reads the rule from KV, and filters the catalog — all before the response leaves the edge.

**Short-lived auth token validation.** A mobile app issues session tokens that need to be validated on every API call. The auth service writes each valid token to KV with a TTL matching the session expiry. Workers at the edge check the token against KV on every request. There's no session database to query, and Cloudflare's built-in TTL handling expires the key automatically when the session ends. The 60-second eventual consistency window matters here — a revoked token might remain valid at some edge locations for up to a minute — but for many threat models, that's an acceptable tradeoff.

**Prerendered page caching.** A Next.js site generates static pages for every blog post at build time. Rather than serving from R2 on every request, the build pipeline writes the rendered HTML directly into KV. Workers read it on each request. This keeps the render hot at the edge without configuring a CDN — the KV cache *is* the CDN layer.

---

## What It Doesn't Do

KV isn't built for data that changes fast. Update the same key more than once per second and you'll hit the write limit. If you need atomic increments, transactional reads, or any kind of coordination between concurrent Workers — a user claiming a limited inventory item, for example — KV will let you down. That's what Durable Objects are for.

The eventual consistency model also makes KV a poor choice for anything that requires read-after-write guarantees. If a user updates their profile and the page immediately re-reads it from KV, they might see the old version for up to a minute. For user-facing data with strict consistency requirements, [D1](#/d1) is a better fit.

---

## Further Reading

- [**How KV works** — Cloudflare Developers](https://developers.cloudflare.com/kv/concepts/how-kv-works/) — The canonical reference on KV's multi-tier caching model, cold vs. hot read paths, and the exact consistency guarantees (and gaps) you're agreeing to.

- [**Redesigning Workers KV for increased availability and faster performance** — Cloudflare Blog](https://blog.cloudflare.com/rearchitecting-workers-kv-for-redundancy/) — A 2025 post-mortem-turned-architecture-brief: after a third-party cloud provider outage took KV down for two hours, Cloudflare moved all KV storage onto their own sharded database backed by R2, dropping p99 read latency from ~200 ms to under 5 ms in the process.

- [**Hardening Workers KV** — Cloudflare Blog](https://blog.cloudflare.com/workers-kv-restoring-reliability/) — Companion piece covering the operational work done to enforce the 60-second eventual-consistency upper bound as a hard guarantee rather than a best-effort target.

- [**Choosing a data or storage product** — Cloudflare Developers](https://developers.cloudflare.com/workers/platform/storage-options/) — Cloudflare's own decision matrix comparing KV, D1, Durable Objects, R2, and Queues — useful for quickly articulating to teammates why you reached for KV (or why you shouldn't have).

- [**KV Limits** — Cloudflare Developers](https://developers.cloudflare.com/kv/platform/limits/) — Exact numbers for key/value size caps, per-key write rate, list operation limits, and bulk read pricing — the page to check before committing KV to a hot path.

- [**Workers KV — Cloudflare's distributed database** — Cloudflare Blog](https://blog.cloudflare.com/workers-kv-is-ga/) — The original GA announcement explaining why Cloudflare chose AP (availability + partition tolerance) over CP in the CAP theorem for KV, and what that means in practice for application design.

---

*Next: [Durable Objects](#/durable-objects) — stateful coordination at the edge, for when eventual consistency isn't enough.*
