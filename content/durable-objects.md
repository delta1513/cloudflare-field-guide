# Durable Objects: The Coordination Primitive

The hardest problem in distributed systems isn't computing — it's agreeing. When ten users edit the same document simultaneously, or a thousand players fight over the same game state, the challenge isn't the logic itself. It's knowing which update wins, in what order, and making sure every participant sees the same answer. Traditional architectures solve this by routing everyone through a central database, then spending enormous effort managing that bottleneck. Cloudflare Durable Objects take a different approach: instead of separating compute from state, they fuse them together into a single, globally-addressable actor.

Each Durable Object is a tiny, named unit that combines a JavaScript runtime with its own private storage. You don't provision it, you don't deploy it, you just address it by name — and every request that uses that name lands on the same instance, anywhere in the world.

---

## How It Works

The core insight of Durable Objects is **naming**. A regular Cloudflare Worker can run on any of Cloudflare's servers simultaneously — that's how they scale. But this statelessness is a limitation when you need coordination: two Workers don't automatically agree on shared state. Durable Objects solve this by giving each instance a **globally-unique identifier**, either randomly generated or one you choose. Every request addressed to `room-42` goes to *the same* instance of that object, no matter where the request originates. Coordination becomes trivial because there's only one place where the state lives.

That instance runs **single-threaded**. This is deliberate. Unlike a traditional server where you might reach for locks and mutexes to prevent race conditions, a Durable Object processes one request at a time, sequentially. The model is borrowed from browser JavaScript — no shared memory, no data races, correct by construction. The tradeoff is that a single DO instance can't parallelize CPU-bound work, but for the coordination problems they're designed for, that constraint is rarely the bottleneck.

**Storage is colocated with compute.** Each Durable Object has up to 10GB of private storage that lives alongside its runtime. There are two flavors: a **key-value API** for simple operations, and a full **SQLite API** for relational queries. Because the database runs in the same process as the code, reads don't cross a network boundary — they're in-process operations against an embedded SQLite file, not round-trips to a remote store. The SQLite backend continuously streams WAL entries to Cloudflare's object storage (batched every 16 MB or 10 seconds), which enables point-in-time recovery up to 30 days back. Writes are strongly consistent and transactional: once a write returns, it's durable, and the next read sees it immediately. This is a meaningful upgrade from Workers KV, which is eventually consistent and designed for read-heavy global distribution rather than coordination.

The **lifecycle** is automatic. A Durable Object comes into existence the first time something addresses it. It stays alive while it's processing requests. After a few seconds of idle, it hibernates — its in-memory state evaporates, but its durable storage remains intact. The next incoming request wakes it back up. Applications never touch the lifecycle directly.

**WebSocket Hibernation** is one of the more elegant pieces of the design. WebSockets are long-lived connections — a chat user might hold one open for hours. Keeping a DO alive for the duration of every open connection would be expensive. Hibernation solves this: when a WebSocket connection goes quiet, the DO can hibernate while the connection itself stays open at the Cloudflare edge. When the next message arrives, the DO wakes up, processes it, and can hibernate again. You pay only for active compute, not for idle connections.

**Alarms** let a Durable Object schedule its own future execution — down to the millisecond. A DO can write state, set an alarm for thirty seconds from now, and hibernate. When the alarm fires, it wakes back up with its storage intact. This is how you build retry queues, expiring sessions, delayed notifications, and batch aggregation — without a job scheduler or a cron infrastructure.

**RPC** completes the picture. Workers can call methods on Durable Objects directly using JavaScript-native syntax — `await stub.increment(key)` rather than `fetch("…/increment")` — passing real objects via the structured-clone algorithm rather than hand-serialized JSON over HTTP. Under the hood this still traverses the network, but the calling Worker blocks on the response just as it would a local function call, and errors propagate as thrown exceptions rather than HTTP status codes to parse.

---

## In the Wild

**Collaborative document editing.** A DO named after the document ID receives all edits from all active users. Because it's single-threaded, operations arrive in a defined order and the DO applies them sequentially, resolving conflicts and broadcasting the canonical state back to all connected clients via WebSocket. There's no coordination layer to build — the single-instance model *is* the coordination layer.

**Multiplayer game rooms.** Each game session maps to one DO instance. All players in the room send moves to the same instance, which validates game state, enforces rules, and pushes updates to all clients. Game sessions in Cloudflare's network spawn near the first player who joins, then accept connections from anywhere else in the world. The state stays consistent without any distributed transaction logic.

**Rate limiting that actually works.** Global rate limiters are notoriously hard to implement correctly — a naive approach using KV or an external cache will allow bursts during propagation delay. A Durable Object named after a user or API key maintains the exact count in its single-threaded, strongly-consistent storage. Every request hits the same instance, and the count is always accurate. There's no race condition to guard against.

**Cloudflare's own infrastructure.** Cloudflare uses Durable Objects internally to build Queues (where a DO manages batch accumulation and delivery), Workers Builds (CI/CD coordination), and AI Gateway (WebSocket connections and authentication state). D1, Cloudflare's SQL database, uses Durable Objects as the underlying coordination primitive for write serialization.

**Long-running workflows.** A workflow engine can use one DO per job, storing the current step and any intermediate state. If the workflow pauses waiting for a human approval or an external API, the DO hibernates. An alarm can enforce timeouts. If the worker that kicks off the next step crashes, the DO's durable storage means nothing is lost — the next attempt picks up exactly where the last one left off.

---

## What It Doesn't Do

A Durable Object is a point of coordination, not a database. Its 10GB storage cap means it's designed for per-entity state — one document, one game session, one user's rate limit — not for global datasets queried by millions of records. For that, use D1 or R2.

Because each instance is single-threaded, you shouldn't route all your traffic to one DO and expect it to scale horizontally. The pattern is to shard: millions of small DOs, each responsible for a narrow slice of state, rather than one giant DO handling everything. Thinking in actors takes some getting used to if you're accustomed to shared databases.

---

## Further Reading

- [**What are Durable Objects?** — Cloudflare Docs](https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/) — The official conceptual overview covering the actor model, global uniqueness, and how naming maps to instance routing; a good reference for internalizing the mental model before building.

- [**Zero-latency SQLite storage in every Durable Object** — Cloudflare Blog](https://blog.cloudflare.com/sqlite-in-durable-objects/) — The engineering announcement for the SQLite backend, including the WAL-streaming durability architecture, point-in-time recovery design, and why co-locating a relational database with compute eliminates a whole class of consistency problems.

- [**Rules of Durable Objects** — Cloudflare Docs](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/) — A concise list of constraints and failure modes that trip up engineers new to the model: what happens to in-memory state on eviction, why you can't rely on a DO staying alive between requests, and how to design around the single-instance limit.

- [**Durable Objects Alarms — a wake-up call for your applications** — Cloudflare Blog](https://blog.cloudflare.com/durable-objects-alarms/) — The original alarms launch post, which walks through using alarms to build queues, batch processors, and retry loops — primitives that would otherwise require an external job scheduler.

- [**Use WebSockets with Hibernation** — Cloudflare Docs](https://developers.cloudflare.com/durable-objects/best-practices/websockets/) — Technical guide to the WebSocket Hibernation API (`ctx.acceptWebSocket`), including how per-connection state survives hibernation via `serializeAttachment`, and why this matters for billing on long-lived connections.

- [**Durable Objects — Unlimited single-threaded servers spread across the world** — Lambros Petrou](https://www.lambrospetrou.com/articles/durable-objects-cloudflare/) — A thorough third-party walkthrough from an engineer who has shipped production systems on DOs; covers sharding patterns, the control/data plane architecture, and tradeoffs you won't find spelled out in the official docs.

---

*Next: [Workers AI](#/workers-ai) — run inference at the edge, with models hosted and scaled by Cloudflare.*
