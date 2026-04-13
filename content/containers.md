# Containers: Full Linux on the Edge

Cloudflare Workers changed how people think about serverless — but Workers run V8 isolates, not operating systems. You can't run FFmpeg in an isolate. You can't drop a Python ML pipeline into one. You can't take an existing Docker image and deploy it without rewriting everything in JavaScript. For years, the answer was "use Workers for what fits, and run the rest somewhere else." Cloudflare Containers is the answer to the rest.

Containers lets you deploy any Docker image — any language, any runtime, any Linux binary — directly onto Cloudflare's global network, orchestrated by Workers. Not a separate product bolted on. The container is *part of* the Worker, controlled by your JavaScript, spun up on demand, and billed only while it's awake. It's the escape hatch that doesn't require leaving the platform.

---

## How It Works

**The key insight is that containers are Durable Objects.** Each container instance is paired with a Durable Object that manages its lifecycle — starting it, routing requests to it, sleeping it after inactivity, and waking it back up when traffic returns. Your Worker code calls `getContainer()` with a session ID, gets back a handle, and calls `.fetch()` to send HTTP requests to the container's exposed port. The container is individually addressable, stateful, and isolated. This isn't a container-as-a-service bolted onto the side — it's containers woven into the same programming model that Durable Objects already established.

**Under the hood, the isolation is serious.** Cloudflare runs containers using **gVisor**, an application kernel written in Go that intercepts syscalls in userspace rather than passing them to the host. For workloads that don't need GPU access, **Firecracker microVMs** provide lightweight VM-level isolation. The platform is runtime-agnostic by design — QEMU is available for flexibility, and cloud-hypervisor is under evaluation for GPU passthrough via VFIO. This isn't Docker-on-a-shared-kernel. Each container gets real isolation boundaries.

**Scheduling is two-tiered and globally distributed.** A global scheduler — itself built on Workers, Durable Objects, and KV — decides which Cloudflare location should run your container based on capacity and hardware availability. Location-level schedulers then pick the specific metal within that data center. When a new instance is requested, Cloudflare picks a location where it has pre-provisioned a ready-to-go container, and startup takes just a few seconds. Servers proactively download container images before accepting work, collapsing what would otherwise be a 75-second cold start to under ten seconds.

**Networking uses a custom eBPF-based router.** The **Global State Router** integrates with Unimog, Cloudflare's Layer 4 load balancer. An eBPF program intercepts packets destined for virtual IP addresses and forwards them to the correct container based on health, readiness, distance, and latency. When the packet arrives at the target server, another Global State Router program intercepts it and routes it to the local container. This is L4 forwarding — not proxying — so the overhead is minimal.

**Instance types range from tiny to substantial.** A "lite" instance gives you 1/16 of a vCPU, 256 MiB of memory, and 2 GB of disk — enough for a lightweight sidecar. At the top end, "standard-4" provides 4 vCPUs, 12 GiB of memory, and 20 GB of disk. Custom configurations are allowed within bounds: up to 4 cores, 12 GiB memory, and 20 GB disk, with a minimum ratio of 3 GiB memory per vCPU. Account-level limits are generous — 6 TiB of concurrent memory, 1,500 vCPUs, and 30 TB of disk across all running instances.

**Pricing is granular and sleep-aware.** You're billed per 10ms of active runtime across three dimensions: $0.0000025 per GiB-second of memory, $0.000020 per vCPU-second, and $0.00000007 per GB-second of disk. Charges start when a request hits the container or when it's manually started, and stop when it sleeps. The `sleepAfter` configuration parameter controls how long an idle container stays awake — set it to five minutes and you only pay for five minutes of idle time after the last request. Scale to zero is real.

---

## In the Wild

- **AI code sandboxes.** LLM-powered coding assistants need to execute generated code safely. Each user session gets its own container — isolated, individually addressable, and torn down after inactivity. The Worker handles authentication and prompt routing; the container runs the untrusted code in a full Linux environment with whatever runtimes the user needs. No shared kernel, no breakout risk, no idle cost when the session ends.

- **Media processing pipelines.** A video platform receives user uploads through a Worker, which spins up a container running FFmpeg to transcode the file, generate thumbnails, and extract metadata. The container has enough CPU and disk to handle a real workload — not the 128 MB and 30-second limit of an isolate. Results get written to R2 (mountable as a FUSE filesystem directly inside the container), and the container sleeps until the next upload arrives.

- **Legacy service migration.** Teams running Go, Rust, or Python services on AWS ECS or GCP Cloud Run can bring their existing Dockerfiles to Cloudflare without rewriting anything. The Worker handles routing and access control; the container runs the same image it always ran. Global scheduling means the container starts close to the user, and there's no region to pick — Cloudflare places it automatically.

- **Scheduled batch jobs.** Cron Triggers fire a Worker that starts a container to run a data pipeline, generate reports, or sync databases. The container has a full filesystem and real CPU time — not the constrained execution environment of a Worker. When the job finishes, the container sleeps. You pay for the seconds it ran, not for a VM sitting idle between cron ticks.

- **WebSocket backends.** Real-time applications — collaborative editors, multiplayer game servers, chat — that need persistent connections and stateful processes. The Worker upgrades the connection and forwards it to a container that maintains the session. Each container is addressable by ID, so reconnecting clients route back to the same instance. The Durable Object underneath provides the consistency guarantees.

---

## What It Doesn't Do

Containers are not Workers. Startup is seconds, not milliseconds — you won't use them for latency-sensitive request-response at the edge. They also don't (yet) support persistent volumes across restarts; the disk is ephemeral, so anything that needs to survive a sleep cycle should go to R2 or D1. GPU instances exist on the platform but are currently focused on Cloudflare's own inference workloads. And while the account limits are generous, individual instances cap at 4 vCPUs and 12 GiB — this isn't the place to run a 64-core database server.

---

## Further Reading

- [**Containers documentation** — developers.cloudflare.com](https://developers.cloudflare.com/containers/) — The official docs covering configuration, deployment, instance types, and the full Container class API.

- [**Containers are available in public beta** — blog.cloudflare.com](https://blog.cloudflare.com/containers-are-available-in-public-beta-for-simple-global-and-programmable/) — The launch announcement with pricing details, architecture overview, and the roadmap for what's coming next.

- [**Our container platform is in production. It has GPUs.** — blog.cloudflare.com](https://blog.cloudflare.com/container-platform-preview/) — A deep dive into the internals: gVisor, Firecracker, the two-tier scheduler, the eBPF-based Global State Router, and how Cloudflare optimized image distribution using their own primitives.

- [**Wrangler container commands** — developers.cloudflare.com](https://developers.cloudflare.com/workers/wrangler/commands/containers/) — Reference for deploying, managing, SSHing into, and debugging container instances from the CLI.

- [**Container examples** — developers.cloudflare.com](https://developers.cloudflare.com/containers/examples/) — Practical patterns including R2 FUSE mounts, cron-triggered jobs, WebSocket forwarding, and multi-instance deployments.

---

*Next: [Durable Objects](#/durable-objects) — the stateful coordination layer that containers are built on.*
