# Vectorize: The Memory Layer for AI Applications

The hardest part of building an AI application often isn't the AI itself — it's giving the model relevant context. A language model doesn't remember your previous conversations, doesn't know your product catalog, and can't search a knowledge base unless you hand it the right documents first. Keyword search won't cut it: users ask questions in natural language, not the exact terms your content uses. What you need is a system that understands *meaning*. That's what a vector database is for, and Vectorize is Cloudflare's purpose-built version — sitting inside the same platform as your Workers, your storage, and your AI inference.

---

## How It Works

The foundation is **vector embeddings**. Machine learning models can convert any piece of content — a paragraph of text, a product description, an image, a user's listening history — into a list of floating-point numbers called an embedding. These numbers aren't arbitrary: the model positions similar things close together in that numerical space. Feed two articles about the same topic through an embedding model and their vectors will be close. Feed an article about baseball and one about cooking, and they'll be far apart. Vectorize stores these numbers and finds the nearest neighbors — fast, at scale.

When you create a **Vectorize index**, you lock in two parameters that can never change: the number of **dimensions** (how long each vector is) and the **distance metric** used to measure similarity. Dimensions are determined by the model that generates your embeddings — OpenAI's `text-embedding-3-small` uses 1536 dimensions; Cloudflare's own `@cf/baai/bge-base-en-v1.5` uses 768. The distance metric shapes what "similar" means: **cosine distance** is best for text and documents (it ignores magnitude and focuses on direction), **Euclidean distance** suits image and audio recognition, and **dot product** is a general-purpose alternative. Choose carefully — neither can be changed later.

Vectors are stored with a user-assigned **ID** and optional **metadata**: a JSON object up to 10KiB per vector. The metadata is how you attach meaning back to the vector. Store the product ID, the chunk of document text, the URL, the timestamp — whatever you'll need when Vectorize hands you the top matches. You can also define up to ten **metadata indexes** on specific properties, enabling filtering during queries: "find the 20 most similar vectors, but only among vectors where `category = 'electronics'`."

**Queries are similarity lookups**, not exact searches. You pass a query vector (typically the embedding of the user's input), set `topK` for how many results you want (up to 100), and optionally supply a metadata filter. Vectorize returns ranked matches with their similarity scores. You then look up the actual content for those IDs from wherever you stored it — D1, KV, R2, or any other backing store. The pattern is always the same: Vectorize answers "what is most similar?" while your other storage answers "what does that thing contain?"

**Insertions are asynchronous.** When you call `insert()` or `upsert()`, you receive a mutation ID back, but the vectors don't become queryable immediately. Under the hood, Vectorize routes writes through a write-ahead log (WAL) backed by a Durable Object, then asynchronously compacts and writes new index files to R2 before atomically swapping the root manifest — which is why queries always see a consistent snapshot even during concurrent writes, but also why there's a propagation window. For most applications this is fine; for strict real-time indexing, you'll need to account for the delay. You can check processing status through the Wrangler CLI.

Internally, Vectorize builds a **HNSW (Hierarchical Navigable Small World)** graph index over your vectors. HNSW is a layered proximity graph — queries traverse from coarse upper layers down to a fine-grained neighborhood, achieving sub-linear search time at the cost of higher memory use versus flat indexes like IVF. The tradeoff Cloudflare made: HNSW delivers strong recall and fast latency without requiring a training step, making it practical for indexes that grow incrementally.

**Workers bindings** connect the whole stack without any HTTP overhead. Declare a binding in your Worker config, and `env.VECTORIZE` becomes a direct handle to the index. No separate service, no credentials to manage, no additional latency from crossing a network boundary — the same zero-friction model that makes Workers + D1 and Workers + R2 feel like a single system rather than a collection of APIs stitched together.

An account on the paid Workers plan can hold up to 50,000 indexes, each storing up to 10 million vectors at up to 1,536 dimensions, with a cap of 5 million total dimensions per index. That covers a large corpus: 10 million 768-dimension vectors is roughly the embedding space for a substantial knowledge base, a full product catalog, or millions of user profiles. Metadata storage is 10 KiB per vector, and metadata filter expressions must fit in under 2 KB of compact JSON — worth knowing when designing multi-field filter schemas.

---

## In the Wild

**Retrieval-Augmented Generation (RAG) for company knowledge bases.** The most common AI pattern right now: instead of fine-tuning a model on proprietary data, you embed your documentation, split it into chunks, store those chunks in Vectorize, and retrieve the most relevant ones at query time before sending them to the language model. A company with years of internal wikis, support tickets, and runbooks can make all of it searchable by a natural-language chatbot without shipping a single document to a third-party training pipeline. Workers AI handles the embedding generation; Vectorize handles the similarity lookup; KV holds the raw text chunks; the final LLM inference stays on Cloudflare's infrastructure end to end.

**Semantic product search.** Traditional e-commerce search breaks on natural language queries. "Something cozy for a rainy Sunday" returns nothing from a keyword index. Embed every product description once, embed the user's query at search time, and Vectorize surfaces the flannel shirts, the hot cocoa sets, and the weighted blankets — ranked by how closely their embeddings match the query's embedding. Combine with a metadata filter on `in_stock = true` and you've built a search experience that behaves like a helpful sales associate rather than a SQL `LIKE` clause.

**Personalized recommendations.** Embed user behavior — items viewed, ratings given, articles read — into a profile vector that drifts over time as the user interacts. At recommendation time, query Vectorize for the items closest to that profile. This is how collaborative filtering worked before transformers: the geometry of the embedding space does the work that explicit rule-writing used to require. The upsert operation is key here: as a user's behavior changes, you update their profile vector in place rather than inserting a new one.

**Duplicate and near-duplicate detection.** A media company ingesting thousands of articles per day needs to know when an incoming story is too similar to one already published — same event, different wire service, slightly reworded. Embed each article on ingestion, query Vectorize for the top three matches, and flag any with similarity scores above a threshold for editorial review. What used to require fuzzy string matching or manual curation becomes a probabilistic filter that operates at ingest speed.

---

## What It Doesn't Do

Vectorize is for similarity search, not structured queries. It can't answer "find all products with price < 50 and category = shoes" — that's [D1](#/d1). It can filter on metadata, but only on pre-indexed fields, and only up to 10 per index. Combine Vectorize with D1 or KV if you need both kinds of lookup.

Insertions aren't immediately consistent. If you need to query vectors you just inserted within milliseconds, you'll hit the async window. For most interactive applications this doesn't matter, but for pipelines that insert-then-immediately-query, design around it.

Finally, Vectorize doesn't generate embeddings itself. You need a model — Workers AI's embedding models, OpenAI, or anything else — to produce the vectors you store. The database is just the index; the semantic understanding lives in the model.

---

## Further Reading

- [**Building Vectorize, a distributed vector database, on Cloudflare's Developer Platform**](https://blog.cloudflare.com/building-vectorize-a-distributed-vector-database-on-cloudflare-developer-platform/) — The engineering deep-dive behind Vectorize's internals: how the WAL Durable Object, R2-backed index files, and atomic manifest swaps combine to give you consistent reads during concurrent writes.

- [**Metadata filtering · Cloudflare Vectorize docs**](https://developers.cloudflare.com/vectorize/reference/metadata-filtering/) — The exact filter expression syntax, supported operators, and the constraints (key character rules, 2 KB JSON limit, 64-byte string truncation) that matter when you're designing a multi-tenant or heavily filtered index.

- [**Limits · Cloudflare Vectorize docs**](https://developers.cloudflare.com/vectorize/platform/limits/) — Hard numbers on vectors per index, dimensions, metadata size, and query throughput — the page to bookmark before you size an index for production.

- [**Build a Retrieval Augmented Generation (RAG) AI · Cloudflare Workers AI docs**](https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-retrieval-augmented-generation-ai/) — Official end-to-end tutorial wiring Workers AI embeddings, Vectorize similarity search, and an LLM completion call into a single Worker — the fastest path from zero to a working RAG prototype.

- [**Hierarchical Navigable Small Worlds (HNSW) · Pinecone Learn**](https://www.pinecone.io/learn/series/faiss/hnsw/) — The clearest technical explanation of how HNSW's layered graph structure achieves sub-linear ANN search, including the memory/recall tradeoffs that influence how Vectorize (and every other modern vector DB) indexes at scale.

- [**Introducing AutoRAG: fully managed Retrieval-Augmented Generation on Cloudflare**](https://blog.cloudflare.com/introducing-autorag-on-cloudflare/) — Cloudflare's managed layer on top of Vectorize: automatic chunking, embedding, and re-indexing from R2 or web sources — useful context for understanding where the Vectorize primitive fits in the broader platform stack.

---

*Next: [AI Agents](#/ai-agents) — how Cloudflare's agent platform orchestrates multi-step AI workflows.*
