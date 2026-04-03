# Workers AI: GPU Inference Without the Infrastructure

Running a language model used to mean one of two things: rent a GPU server and babysit it, or call a third-party API and accept that your prompts, your data, and your users' requests are now flowing through someone else's infrastructure. Both options carry costs — operational weight on one side, privacy and vendor dependency on the other. Workers AI is Cloudflare's answer to both: serverless GPU inference distributed across their global network, callable from code you already have, with no instances to provision and no GPU fleet to manage.

The pitch is simpler than it sounds. You write a Worker. You call `env.AI.run()`. Your request hits a GPU somewhere in Cloudflare's network, inference runs, and the result comes back. You pay for what you used, measured in compute units Cloudflare calls **Neurons**. That's it.

---

## How It Works

**The execution model is borrowed from Workers itself.** Just as Workers runs JavaScript or WebAssembly at Cloudflare's edge without requiring a persistent process, Workers AI dispatches inference requests to available GPU capacity across Cloudflare's global PoPs. There is no persistent GPU allocation for your account — requests are routed dynamically, which means cold starts don't exist in the traditional sense, but it also means you don't have dedicated hardware. The tradeoff is managed elasticity in exchange for control over placement. Under the hood, Cloudflare runs **Infire**, a custom LLM inference engine written in Rust that uses continuous batching, paged KV-cache, and JIT-compiled CUDA graphs to maximize GPU utilization — the design choice to replace vLLM was driven by CPU overhead: Infire uses roughly 25% CPU versus vLLM's 140%+ under load.

**The billing unit is the Neuron**, Cloudflare's abstraction over raw GPU compute. One Neuron represents the compute required to produce one unit of AI output — the exact cost varies by model complexity. The price is $0.011 per 1,000 Neurons. Every account gets 10,000 Neurons per day free, resetting at midnight UTC, which covers meaningful experimentation without touching a credit card. Generating a thousand tokens from Llama 3.1 8B costs roughly 300 Neurons — so that daily free allowance stretches further than it sounds.

**The model catalog spans the full stack of common AI tasks.** Text generation covers the expected range: Meta's Llama family, Mistral variants, Qwen, DeepSeek distillations, IBM Granite, and Google's Gemma. Image generation offers Black Forest Labs' Flux models, including the high-quality Flux 1.1 Pro. Whisper handles speech-to-text; Deepgram's Aura handles text-to-speech. BGE and other embedding models support semantic search and retrieval pipelines. There are also specialized models for classification, reranking, translation, summarization, and object detection — the long tail of tasks that don't make headlines but show up constantly in real applications.

**LoRA adapter support is the feature developers who've fine-tuned models care about.** Several models in the catalog accept LoRA adapters at inference time — you upload your adapter weights and pass a reference at runtime. This means you can get fine-tuned, task-specific behavior without running your own inference infrastructure for a specialized model. There are constraints worth knowing: base models must be non-quantized, and adapters must be trained at rank r ≤ 8 (up to r = 32 is accepted, but the recommended ceiling for compatibility is r = 8). Adapters are stored on your account and referenced by name at the call site.

**The integration story is tighter than it appears at first glance.** Workers AI isn't just a standalone inference service — it's a binding inside the Worker runtime, which means it composes with everything else. Store prompt templates and context in **KV**. Log requests and stitch conversation history in **D1**. Cache large generated assets in **R2**. Coordinate stateful, long-running AI workflows in **Durable Objects**. Route through **AI Gateway** for request-level observability, caching, rate limiting, and automatic model fallback when a primary model fails. Pair with **Vectorize** to build retrieval-augmented generation pipelines where the Worker fetches relevant chunks from a vector index before hitting the language model. The pieces fit together because they're all bindings inside the same runtime.

**Partner models** appear alongside the open-source catalog — Deepgram for production-grade speech, Leonardo AI for photorealistic image generation, Black Forest Labs for Flux variants. These run on Cloudflare's infrastructure but are operated in partnership with the model providers, sometimes with different pricing.

**The API surface is OpenAI-compatible.** Workers AI exposes `/v1/chat/completions` and `/v1/embeddings` endpoints that match the OpenAI API contract, which means existing code using the `openai` SDK can switch to Workers AI by changing the base URL and model name — no other code changes required. This also means any tool in the OpenAI ecosystem (LangChain, LlamaIndex, Vercel AI SDK) works against Workers AI out of the box.

---

## In the Wild

**RAG-powered internal tools.** A team stores their internal documentation in Vectorize, embedding every page at index time using BGE. When someone asks a question, a Worker embeds the query, fetches the top five matching document chunks from Vectorize, and passes them as context to Llama 3.1 70B. The model answers from actual documentation rather than hallucinating. The whole stack — embeddings, vector search, LLM inference, response streaming — runs inside Cloudflare's network, and the company's internal documents never leave.

**Localized content generation at scale.** An e-commerce company runs 40 regional storefronts, each needing product descriptions translated and rewritten for local tone. A single Worker invokes the M2M100 translation model followed by a Mistral text generation pass to adapt register and phrasing. What previously required a batch job running nightly on rented compute now runs at request time, generating content only when it's needed. No translation vendor API keys, no per-character pricing tiers to optimize around.

**Voice interfaces for mobile apps.** A small team building a language learning app uses Deepgram's Flux model (via Workers AI) for real-time speech-to-text and Aura for text-to-speech response. The Worker handles transcription, feeds the result to a Llama model acting as a language tutor, then synthesizes the tutor's response back to audio. The entire pipeline runs on Cloudflare's infrastructure, close to the user, with the team paying per-request rather than maintaining streaming audio infrastructure.

**Image content moderation.** A user-generated content platform passes every uploaded image through a classification Worker before it reaches permanent storage. The Worker calls Llama Guard — a safety-focused classification model — flags anything that scores above a threshold, and routes borderline cases to a human review queue. Cloudflare handles the burst capacity during peak upload windows automatically.

**Markdown-to-visual publishing.** A solo developer built a tool that accepts a markdown essay and returns a styled, illustrated version: Flux generates a header image from the article's first paragraph, the text is reformatted by a Llama model into a magazine-style layout, and the result is stored in R2. The whole pipeline runs in under ten seconds. The developer pays fractions of a cent per article and operates no servers.

---

## What It Doesn't Do

Workers AI doesn't give you persistent GPU allocation or the ability to load arbitrary private models from a Hugging Face checkpoint. The catalog is curated, and while LoRA adapters provide some customization headroom, you can't bring entirely custom model architectures. For teams with specialized models that require full control over the serving environment, this is the ceiling. Cloudflare has a Custom Requirements Form for enterprise use cases, but that's a sales conversation, not a self-serve option.

Inference latency is competitive for a shared serverless environment, but it isn't a replacement for dedicated GPU boxes running optimized serving stacks. If your application is latency-sensitive in the 10–50ms range, dedicated hardware gives you headroom that serverless GPU doesn't.

---

## Further Reading

- [**Workers AI model catalog**](https://developers.cloudflare.com/workers-ai/models/) — The authoritative list of every supported model, organized by task type (text generation, embeddings, image, speech, vision), with per-model pricing in Neurons and input/output token limits.

- [**Fine-tuned inference with LoRA adapters**](https://developers.cloudflare.com/workers-ai/features/fine-tunes/loras/) — The official reference for uploading adapter weights, understanding rank constraints, and passing adapter references at inference time — essential reading before you reach for the fine-tuning path.

- [**How we built the most efficient inference engine for Cloudflare's network**](https://blog.cloudflare.com/cloudflares-most-efficient-ai-inference-engine/) — Cloudflare's engineering deep-dive on Infire, their Rust-based LLM serving engine: why they abandoned vLLM, how JIT-compiled CUDA graphs cut CPU overhead by 82%, and what continuous batching looks like at edge scale.

- [**Build a Retrieval Augmented Generation (RAG) AI**](https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-retrieval-augmented-generation-ai/) — A full walkthrough of wiring Workers AI (BGE embeddings + Llama text generation) to Vectorize inside a single Worker, including the D1 schema for document storage and the query pipeline code.

- [**OpenAI-compatible API endpoints**](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/) — Documents the `/v1/chat/completions` and `/v1/embeddings` drop-in compatibility layer, including exactly which request fields are supported and how to point existing OpenAI SDK clients at Workers AI with a one-line base URL change.

- [**AI Gateway: caching and rate limiting**](https://developers.cloudflare.com/ai-gateway/features/) — Technical reference for the AI Gateway feature set that sits in front of Workers AI (and any other provider): semantic caching, sliding-window rate limits, model fallback chains, and per-request cache-control headers.

*Next: [AI Gateway](#/ai-gateway) — observability, caching, and rate limiting for every AI call your Workers make.*
