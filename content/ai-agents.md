# AI Agents: Stateful Intelligence at the Edge

Most AI applications are amnesiac by design. A user sends a message, the model responds, and the entire context evaporates. For a chatbot that helps someone debug a config file, that's fine. For anything more ambitious — a research assistant that tracks a project over weeks, a scheduling bot that wakes itself up each morning, an orchestrator that coordinates a fleet of sub-agents — statelessness is a fundamental architectural problem. Cloudflare's **Agents SDK** is the answer: a framework that makes AI agents first-class citizens on the edge, with persistent memory, real-time connections, and autonomous scheduling built in from the start.

---

## How It Works

The foundational insight is that an agent is not a function — it's a server. Cloudflare exposes this directly: every agent you write is a **TypeScript class** that extends `Agent` (or `AIChatAgent` for chat-specific use cases), and each instance of that class runs on a **Durable Object**. That's the key architectural decision. Durable Objects are Cloudflare's stateful compute primitive — micro-servers with globally unique identity, co-located storage, and strong consistency guarantees. A Durable Object can hold WebSocket connections, run scheduled work, and persist data, all without you managing any of the infrastructure around it. The Agents SDK layers an ergonomic API on top of that foundation.

**State management** is built into every agent instance. Each agent has a **SQLite database** embedded directly alongside its compute — not a remote database with a network round trip, but a local, co-located store. The high-level `setState` / `this.state` API handles the common case: structured state that persists across restarts and hibernation, broadcasts changes to every connected WebSocket client in real time, and remains immediately consistent (read-your-own-writes). For more complex queries, you can drop to raw `this.sql` and write SQL directly. State and schema survive deploys and agent hibernation without any external coordination.

**WebSocket connections** are held open on the Durable Object, so agents can push updates to clients the moment something changes. The `@callable()` decorator marks methods as typed RPC — clients connected via WebSocket can invoke them directly, and TypeScript enforces the types on both ends. The companion React hook `useAgent` wires state updates into component renders so the UI stays in sync automatically.

For AI chat specifically, **`AIChatAgent`** handles the full conversation lifecycle: messages are persisted automatically in the embedded SQLite store, streams resume transparently if a connection drops mid-response, and the SDK integrates with the Vercel AI SDK's `streamText` so you can point at any model — Workers AI (Cloudflare's own GPU inference layer), OpenAI, Anthropic, Google Gemini — with a one-line provider swap. Long-running reasoning models that take minutes to respond aren't a special case; they just work, because the connection persists.

**Scheduling** is where agents become genuinely autonomous. An agent can schedule future work in four ways: a delay in seconds (`this.schedule(60, ...)`), a specific timestamp, a cron expression, or a repeating interval. Scheduled tasks survive restarts because they're stored in the same SQLite database backing agent state. Under the hood, the scheduler uses Durable Object alarms — Cloudflare's low-level mechanism for waking a Durable Object at a precise future time. A scheduled task can do anything a live request can: call tools, update state, send emails, trigger other agents.

**Tool use** follows the same class-based model. Define methods on your agent, annotate them, and they become callable from the model as tools. You can expose these tools externally via the **Model Context Protocol (MCP)**, making your agent a tool server that other LLMs and agents can call. Client-side tools — code that runs in the browser rather than on the server — are also supported, as are **human-in-the-loop** approval flows where the agent pauses execution and waits for a user to confirm before proceeding.

Cloudflare scales this to **tens of millions of agent instances** globally. There's no pool to configure, no cold start budget to manage. Each named agent instance is addressable by ID; requesting an agent that doesn't exist yet creates it on the spot.

---

## In the Wild

**Long-running research assistants.** A team building a competitive intelligence tool runs an agent per tracked company. Each agent wakes itself up daily via cron, browses competitor sites using Cloudflare's built-in headless browser integration, summarizes changes using a language model, and appends findings to its persistent state. Users connect over WebSocket to see updates the moment they're written. The agent has been running for months; its SQLite store is the accumulated memory of everything it's observed.

**Multiplayer game state coordinators.** Real-time games need authoritative shared state without a dedicated game server. An agent holds the canonical game state in `this.state`, broadcasts every change to all connected players instantly, and uses the SQLite database to persist match history. The WebSocket RPC model means client code calls `agent.stub.makeMove({ position })` the same way it would call a local function. The agent handles conflict resolution, turn validation, and timeout detection via scheduled tasks.

**Customer support bots with memory.** A per-customer agent maintains the full history of every conversation, ticket, and resolution. When a user opens a new chat, the agent resumes from its persistent state rather than starting from scratch. The `AIChatAgent` base class keeps message history in SQLite automatically, so the model always has full context. Human-in-the-loop approval gates let the agent draft refunds or escalations for a human to confirm before executing.

**Automated report delivery pipelines.** An agent per subscription schedules a recurring cron task to pull data, call an LLM to generate a narrative summary, and push the result to a user via email or webhook. The scheduling persists in SQLite — restart the worker, redeploy, and the scheduled jobs survive unchanged. No external cron service, no job queue infrastructure.

---

## What It Doesn't Do

The Agents SDK is TypeScript-first. There is no official Python SDK; if your AI toolchain is Python-heavy, you're writing glue code or calling agents over HTTP. Each agent instance is single-threaded — the Durable Object model serializes concurrent requests, so compute-heavy work that would benefit from true parallelism needs to be farmed out to Workers or Workflows. And while the embedded SQLite store is immediately consistent within an agent, there's no built-in mechanism for querying across all instances of an agent class — cross-agent aggregation requires you to build that coordination yourself, typically via a separate D1 database or a dedicated aggregator agent.

---

## Further Reading

- [**Agents SDK overview — developers.cloudflare.com**](https://developers.cloudflare.com/agents/) — The official starting point: architecture overview, quick-start template, and links to every API reference page.

- [**Store and sync state — developers.cloudflare.com**](https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/) — Deep dive into the state model: SQLite vs. key-value, the `onStateChanged` lifecycle hook, client sync, and direct SQL access.

- [**Schedule tasks — developers.cloudflare.com**](https://developers.cloudflare.com/agents/api-reference/schedule-tasks/) — Documents all four scheduling modes, how tasks are stored and executed, and how cron expressions map to Durable Object alarms under the hood.

- [**Human-in-the-loop — developers.cloudflare.com**](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) — Explains how to pause agent execution pending human approval, including how the approval state persists across reconnects and timeouts.

- [**Durable Objects — developers.cloudflare.com**](https://developers.cloudflare.com/durable-objects/) — The underlying primitive the Agents SDK is built on; understanding Durable Objects explains the consistency model, hibernation behavior, and global addressing.

- [**Building AI Agents on Cloudflare — blog.cloudflare.com**](https://blog.cloudflare.com/building-ai-agents-on-cloudflare/) — The launch post explaining the design decisions behind the SDK: why Durable Objects, what the SDK abstracts away, and where Cloudflare sees the agent architecture going.

---

*Next: [Workers AI](#/workers-ai) — serverless GPU inference that agents can call without an API key.*
