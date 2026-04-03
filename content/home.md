# Cloudflare Field Guide

Cloudflare started as a CDN — a way to make websites faster and protect them from attacks. Fifteen years later it's something harder to categorize: a global network that's also a developer platform, a security company, an AI infrastructure provider, and an ISP-without-being-an-ISP.

The unifying thread is the network itself. Cloudflare operates in over 300 cities worldwide, with direct connections to most of the internet's major carriers. They've turned that physical infrastructure into a platform for running code, storing data, enforcing security policy, and routing traffic — all as close to the end user as possible.

This guide is a plain-language tour. Not how to configure anything, but what each product actually *is*, how it works under the hood, and what people build with it.

---

## Developer Platform

The building blocks for applications that run at the edge — globally distributed, no servers to manage.

- [**R2**](#/r2) — Object storage with no egress fees. S3-compatible. The financially motivated answer to an AWS bill.
- **Workers** — JavaScript or WebAssembly functions deployed to 300+ cities in seconds. The execution layer everything else is built on. *(coming soon)*
- **Pages** — Static site and JAMstack hosting with built-in CI/CD, preview deployments, and Workers integration. *(coming soon)*
- **D1** — SQLite databases that live at the edge. Query from a Worker with zero latency. *(coming soon)*
- **KV** — A globally replicated key-value store. Eventually consistent, extremely fast reads. Good for config, sessions, feature flags. *(coming soon)*
- **Durable Objects** — Stateful singletons that coordinate across Workers. Harder to explain, central to everything interesting. *(coming soon)*
- **Queues** — Message queues for decoupling Workers and handling background jobs. *(coming soon)*

## AI Platform

Cloudflare has moved aggressively into AI infrastructure — running inference at the edge, proxying AI providers, and providing the primitives for agentic applications.

- **Workers AI** — Run inference on Cloudflare's GPU clusters, distributed globally. Call a model from a Worker and get a result back in milliseconds. *(coming soon)*
- **AI Gateway** — A proxy that sits in front of OpenAI, Anthropic, or any AI provider. Logs requests, caches responses, enforces rate limits, tracks costs. *(coming soon)*
- **Vectorize** — A vector database for semantic search and retrieval-augmented generation. Lives next to your Workers. *(coming soon)*
- **AI Agents** — An SDK for building long-running agents that use Workers, Durable Objects, and browser automation. *(coming soon)*

## Security & Network

The original business. Cloudflare sits between the internet and your servers, absorbing attacks and accelerating traffic. These products are mature, battle-tested at enormous scale.

- **WAF** — Web Application Firewall. Rules for OWASP top 10, rate limiting, bot management, custom logic. *(coming soon)*
- **DDoS Protection** — Automatic, always-on. Cloudflare has absorbed some of the largest attacks ever recorded — including a 5 Tbps attack in 2021. The protection comes standard with all plans. *(coming soon)*
- **CDN** — Cache static assets at 300+ edge locations. Serve from the city closest to each user. *(coming soon)*
- **DNS** — Authoritative DNS with 1.1.1.1 as the public resolver. Anycast routing, fast propagation, detailed analytics. *(coming soon)*
- **Load Balancing** — Distribute traffic across origins with health checks, geographic steering, and failover. *(coming soon)*

## Zero Trust

Replace the corporate VPN with a modern security model: verify every request, trust no network by default.

- **Access** — Put any internal app behind SSO without a VPN. Works with any identity provider. Users authenticate in the browser; Cloudflare enforces policy at the edge. *(coming soon)*
- **Tunnel** — Connect your servers to Cloudflare's network without opening firewall ports or exposing a public IP. A daemon runs on your server and establishes outbound connections only. *(coming soon)*
- **Gateway** — DNS and HTTP filtering for your team's outbound traffic. Block malware, enforce acceptable use policy, log everything. *(coming soon)*
- **Browser Isolation** — Run the browser itself on Cloudflare's network. Users interact with a pixel stream; no code from untrusted sites reaches their device. *(coming soon)*

---

Start with [R2](#/r2) — it's the simplest product with one of the most interesting origin stories.
