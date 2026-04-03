# CDN: A Cache That Lives Inside the Internet

The idea behind a CDN is simple enough: put copies of your content closer to the people requesting it. Stop making someone in São Paulo wait for bytes to travel from a data center in Virginia. But Cloudflare's CDN is not really a content delivery network in the traditional sense — it's a consequence of everything else Cloudflare built. The 300+ data center network existed first, to handle DDoS, to terminate TLS, to run a DNS resolver. Caching arrived as a natural extension of the fact that Cloudflare was already sitting in the middle of every request. That structural difference matters more than it sounds.

---

## How It Works

Every domain proxied through Cloudflare routes HTTP traffic to the nearest **point of presence (PoP)**. There are more than 330 of them worldwide, in cities where Cloudflare has struck peering agreements with local ISPs. Before a request ever reaches your origin, it lands at one of these locations — and if the response is cached there, your origin never sees the request at all.

**Cache hit logic follows a clear hierarchy.** Cloudflare respects standard `Cache-Control` headers by default: if the origin sends `Cache-Control: public, max-age=3600`, Cloudflare stores the response for an hour. If there's no directive, Cloudflare applies its own defaults — 200 OK responses get a 120-minute edge TTL, 302 redirects get 20 minutes, 404s get 3 minutes. HTML and JSON are not cached by default, only specific file extensions: JS, CSS, images, fonts, videos, compressed archives, and similar static asset types. Everything else passes through to origin unless you explicitly configure otherwise.

**Cache Rules** are the primary lever for customization. You write match conditions (path patterns, hostnames, request headers) and then configure behavior: override the TTL, bypass the cache entirely, mark something as cacheable that wouldn't be by default. A rule that says "cache everything under `/api/public/` for 5 minutes" takes about thirty seconds to set up. For finer control, **Workers** can intercept requests and call the `caches.default` API directly — storing and retrieving responses with arbitrary cache keys, independent of URL structure.

**Cache keys** determine what counts as a "same" request. By default, the cache key is the full URL. But if you serve different content based on a cookie, a query parameter, or a header (say, a `Accept-Language` header that changes the language of the page), you need the cache key to include those variables — otherwise Cloudflare might serve the French version of a page to a German speaker. Cache Rules let you add headers or query parameters to the key, or strip parameters you want to ignore (like UTM tracking strings that shouldn't fragment your cache).

**Tiered Cache** is where the architecture gets interesting. By default, each PoP is independent: a cache miss in Frankfurt goes directly to your origin. With Tiered Cache enabled, Cloudflare organizes its data centers into a two-level hierarchy. **Lower tiers** (the 300+ edge locations closest to users) check **upper tiers** (a smaller set of regional hubs) before contacting your origin. If a file is popular in multiple European cities, the upper tier in Frankfurt might already have it — only one request propagates to the origin instead of a dozen. **Smart Tiered Cache**, available even on free plans, uses Cloudflare's internal latency telemetry to automatically select the single upper-tier data center with the best connectivity to your origin, with no manual configuration required.

**Cache Reserve** extends this model with persistent storage. Standard edge caches are ephemeral — content gets evicted when the PoP is under memory pressure or the TTL expires. Cache Reserve backs the CDN with R2 object storage, so a cache miss at the edge checks durable storage before hitting your origin. This is especially valuable for long-tail content: pages or assets that get one request a day are usually gone from edge cache before the second request arrives. With Cache Reserve, they're stored indefinitely in R2.

**Purging** works instantly and globally. You can purge a single URL, a list of URLs, or everything at once. Purge by **Cache Tag** — a custom header (`Cache-Tag: product-42`) that you attach to responses — and invalidate all cached variants of a resource with one API call, regardless of how many URL permutations exist. For real-time invalidation flows (e.g., a product price changes and you need the CDN to stop serving the stale price immediately), cache tags are the only practical mechanism at scale.

**Request collapsing** handles thundering herd scenarios automatically. When a popular asset expires and thousands of requests hit the same PoP simultaneously, Cloudflare sends exactly one request upstream and streams the response to all waiting clients. This isn't a configuration option — it's baked into how the cache layer works.

---

## In the Wild

**News sites during breaking events.** Traffic spikes for news publishers are brutal: zero to a million requests per minute in the time it takes a story to go viral. An origin that handles normal load fine simply cannot absorb that spike. With Cloudflare's CDN in front, article pages that are even slightly stale in cache absorb the spike almost entirely at the edge. A major news organization might see origin traffic stay flat while CDN traffic spikes tenfold — because the cache hit ratio for a popular story climbs above 99%.

**Software download distribution.** An open-source project ships a new release and 50,000 developers hit the download page simultaneously. The release artifacts — tarballs, installers, checksums — don't change after publication. Cached at every Cloudflare PoP, downloads resolve in milliseconds from the nearest location and the project's origin server barely registers the event. Cache TTLs can be set to years for immutable versioned assets.

**E-commerce product catalog pages.** Product pages are dynamic — inventory, pricing, and availability change — but most of the page is stable. A caching strategy that serves the static shell of the page from CDN while fetching the dynamic price fragment separately can cut time-to-first-byte dramatically. Teams use Workers to assemble these hybrid pages: stream the cached HTML shell, stitch in the live fragment, deliver a complete page faster than a full dynamic render would allow.

**API response caching for read-heavy endpoints.** Public API endpoints that serve weather data, sports scores, or exchange rates often have thousands of consumers all asking for the same payload. With Cache Rules configured to cache GET responses at the edge for 60 seconds, a backend that previously handled 50,000 requests per minute might see fewer than 600 — one per PoP per minute. The cache TTL becomes the freshness contract your API implicitly publishes.

---

## What It Doesn't Do

Cloudflare's CDN handles HTTP responses. It does not cache WebSocket connections, video streams mid-flight, or non-GET requests. It is not a video delivery network with adaptive bitrate transcoding — for that, look at [Stream](#/stream). It is not object storage — the cache is a performance layer on top of your origin, not a replacement for it.

The free and paid plans impose a cacheable file size limit of 512 MB per object. Enterprise raises this to 5 GB. Anything larger must be delivered through other mechanisms.

HTML is not cached by default, which surprises people. The assumption is that HTML contains dynamic, user-specific content. You can override this with Cache Rules, but you need to be deliberate: caching a logged-in user's dashboard page for five minutes and serving it to every visitor is a bad day.

---

## Further Reading

- [**Cloudflare Cache documentation**](https://developers.cloudflare.com/cache/) — The full reference for cache rules, TTL settings, purge mechanics, and Cache Reserve; the authoritative source for current behavior and limits.

- [**How Tiered Cache works**](https://developers.cloudflare.com/cache/how-to/tiered-cache/) — Detailed explanation of the lower/upper tier hierarchy, Smart Tiered Cache topology selection, and Regional Tiered Cache for global deployments.

- [**Cache Reserve: persistence for the long tail**](https://developers.cloudflare.com/cache/advanced-configuration/cache-reserve/) — Explains how Cache Reserve uses R2 to back the edge cache with durable storage, eliminating origin fetches for infrequently accessed assets.

- [**How the cache works with Workers**](https://developers.cloudflare.com/workers/reference/how-the-cache-works/) — Documents the `caches.default` and `caches.open()` APIs that let Workers participate directly in cache storage and retrieval, with custom keys.

- [**Introducing concurrent streaming acceleration**](https://blog.cloudflare.com/introducing-concurrent-streaming-acceleration/) — Engineering post on the request collapsing and streaming mechanism that handles simultaneous cache misses without hammering origin servers.

- [**Cache Tag purging**](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-tags/) — Reference for the Cache-Tag header workflow, covering how to instrument responses for surgical, scalable cache invalidation.

---

*Next: [Workers](#/workers) — the serverless runtime that runs at every CDN edge location.*
