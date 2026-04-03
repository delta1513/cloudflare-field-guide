# AI Gateway: The Proxy That Knows What Your AI Calls Cost

AI applications have a visibility problem. Your app calls OpenAI, Anthropic, or Workers AI dozens of times a second — but unless you've built custom instrumentation, you're mostly flying blind. How many tokens did that feature consume? Which requests are failing? Is the same prompt being sent a thousand times because a cache would have been obvious? Cloudflare AI Gateway answers all of those questions, and it does it with a one-line change: swap the base URL in your existing AI SDK, and every request now flows through a proxy that can observe, cache, rate-limit, and reroute your AI traffic.

The pitch is almost too simple. It works because AI Gateway is purely a proxy — it doesn't replace your model providers, it sits in front of them.

---

## How It Works

**The integration point is a URL.** Instead of sending requests directly to `api.openai.com` or `api.anthropic.com`, you route them through a gateway endpoint Cloudflare provisions for you:

```
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/{provider}/...
```

Your existing SDK, your existing API keys, your existing request format — all unchanged. The only thing that changes is the host. AI Gateway accepts the request, forwards it to the real provider, and proxies the response back. Everything interesting happens in the middle.

**Observability is the foundation.** Every request flowing through your gateway is logged: the model used, the number of tokens consumed, the latency, the cost estimate, whether it succeeded or failed. Logs are enabled by default and retained up to 10 million entries per gateway. The dashboard surfaces per-model token breakdowns, error rates, cache hit ratios, and cost estimates. For programmatic access, the same data is queryable via Cloudflare's GraphQL Analytics API using your account token — useful for piping AI cost data into existing dashboards or alerting pipelines.

**Caching is where the economics get interesting.** AI Gateway can cache responses for identical requests — same prompt, same model, same parameters — and serve the cached response rather than hitting the provider again. Cache duration is controlled with a `cf-aig-cache-ttl` header (minimum 60 seconds, maximum one month). Responses include a `cf-aig-cache-status` header indicating `HIT` or `MISS`, so you can verify caching is working. The limitation is exactness: it only caches on identical requests. Semantic caching (two prompts that mean the same thing hitting the same cache entry) is on the roadmap but not yet available. Where it works well today is in applications with constrained prompt spaces — chatbots with predefined selections, classification pipelines running the same prompts repeatedly, or FAQ bots whose users cluster around a small set of questions.

**Rate limiting keeps costs predictable.** You can cap a gateway at N requests per window — fixed windows (12:00–12:10, 12:10–12:20) or sliding windows (no more than N in the last T seconds). Requests over the limit get a `429 Too Many Requests` response and never reach the AI provider. For teams building internal tools, this is a practical cost ceiling. For customer-facing products, it's protection against usage spikes that could blow through a monthly budget overnight.

**Fallbacks make multi-provider resilience practical.** Rather than hardcoding a single model provider, you can send AI Gateway an ordered list of providers. When the primary returns an error — or when a timeout you've configured is exceeded — the gateway automatically retries on the next provider in the chain. The response includes a `cf-aig-step` header telling you which provider actually answered: step 0 means the primary succeeded, step 1 means the first fallback fired. You can chain as many providers as you want.

**The unified endpoint smooths over provider differences.** AI Gateway exposes an OpenAI-compatible endpoint at:

```
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/compat/chat/completions
```

This lets you switch between providers by changing only the `model` parameter — OpenAI, Anthropic, Google Gemini, Workers AI, Grok — using the same SDK and code path. Cloudflare handles the translation layer for provider-specific request format differences. Provider-specific endpoints are also available when you need access to features (structured outputs, vision, tool use APIs) that aren't exposed through the shared compatibility layer.

**Authentication is flexible.** You can pass provider API keys directly in request headers (they're forwarded to the provider), or store them with Cloudflare as named secrets that get injected at runtime. The latter keeps keys out of your application code and allows key rotation without redeploys.

---

## In the Wild

**Cost attribution for AI-heavy products.** A startup shipping an AI writing assistant has Workers calling Claude for drafts, GPT-4 for editing suggestions, and Gemini for summarization — three providers, three billing dashboards, zero consolidated view of what each feature actually costs. Routing everything through a single AI Gateway gives the team one analytics screen showing per-gateway token consumption and cost estimates. They can see that the summarization feature costs ten times what they expected and make a product decision before the bill arrives.

**Rate-protecting internal AI tools.** An engineering team builds an AI code review bot that runs on every pull request. Without limits, a developer who opens twenty PRs simultaneously could kick off twenty concurrent model calls, each consuming thousands of tokens. A sliding-window rate limit on the gateway — say, 10 requests per minute per gateway — turns this from a runaway cost event into a queue. Requests that exceed the limit return a 429, the tooling backs off and retries, and the bill stays bounded.

**Multi-provider failover for reliability.** A company building a customer support product can't afford the LLM being unavailable when their provider has an outage. They configure AI Gateway with OpenAI as primary and Anthropic as fallback. When OpenAI returns a 503, the gateway tries Anthropic automatically, within the same request lifecycle, without the client ever knowing a retry happened. The `cf-aig-step` header in the response lets their logging system track which provider is being used over time, so they can notice if they're living on the fallback more than expected.

**Prompt caching for document Q&A.** A legal tech application lets users ask questions about uploaded contracts. The same contract gets queried dozens of times during a review session, often with near-identical prompts. With AI Gateway caching enabled and a long TTL, repeated questions about the same document hit the cache rather than the model. The per-question cost drops to near zero for common lookups; the model only gets called for genuinely novel queries.

---

## What It Doesn't Do

AI Gateway doesn't host models or run inference. It's entirely a control plane — observability, routing, and policy — layered over providers you're already using. If you need to run models without sending data to third-party APIs, that's [Workers AI](#/workers-ai).

The caching is also limited today. Semantic caching — where two differently-worded but functionally identical prompts share a cache entry — doesn't exist yet. For workloads with high prompt variability, cache hit rates will be low, and the economics of caching won't apply. For workloads with constrained prompt spaces, it can be significant.

---

## Further Reading

- [**Caching · Cloudflare AI Gateway docs**](https://developers.cloudflare.com/ai-gateway/features/caching/) — Reference for all caching configuration options: `cf-aig-cache-ttl`, `cf-aig-cache-status`, per-request overrides, and the minimum/maximum TTL bounds.

- [**Analytics · Cloudflare AI Gateway docs**](https://developers.cloudflare.com/ai-gateway/observability/analytics/) — Covers the metrics schema and, crucially, how to query log data via the Cloudflare GraphQL Analytics API — the path to integrating AI cost data into existing monitoring infrastructure.

- [**Multi-vendor AI observability and control · Cloudflare Reference Architecture**](https://developers.cloudflare.com/reference-architecture/diagrams/ai/ai-multivendor-observability-control/) — Architecture diagram showing how AI Gateway sits as a forward proxy across multiple inference providers, with annotations on where caching, rate limiting, and logging intercept the request lifecycle.

- [**Billions and billions (of logs): scaling AI Gateway with the Cloudflare Developer Platform**](https://blog.cloudflare.com/billions-and-billions-of-logs-scaling-ai-gateway-with-the-cloudflare/) — Engineering post from the AI Gateway team on how they evolved from 30-minute log retention to storing billions of logs indefinitely; good reading for understanding the storage and write-throughput tradeoffs behind the observability layer.

- [**Keep AI interactions secure and risk-free with Guardrails in AI Gateway**](https://blog.cloudflare.com/guardrails-in-ai-gateway/) — Announces content moderation guardrails that can be applied at the gateway layer regardless of which model or provider is behind it — relevant if you're thinking about where in your stack to enforce safety policies.

- [**Best LLM gateways for observability: tracing, cost attribution, and debuggability**](https://www.braintrust.dev/articles/best-llm-gateways-observability-2026) — Third-party comparison of AI Gateway against Portkey, LiteLLM, and Helicone across dimensions like TTFT tracking, per-tenant cost attribution, and trace depth; useful for calibrating where Cloudflare's proxy fits relative to more observability-focused alternatives.

---

*Next: [Vectorize](#/vectorize) — Cloudflare's vector database for building semantic search and AI memory.*
