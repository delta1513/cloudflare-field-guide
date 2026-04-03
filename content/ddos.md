# DDoS Protection: Defense at Network Scale

A distributed denial-of-service attack is one of the oldest and bluntest instruments on the internet — flood a target with enough junk traffic until it can't serve real users. The countermeasure has always been simple in theory: distinguish real traffic from attack traffic, then drop the attack. The hard part is doing that at speed, at scale, and without disrupting legitimate users in the crossfire. Cloudflare's approach is to make DDoS mitigation a native property of its network, not an appliance bolted on after the fact. Every request, packet, and DNS query passes through the same infrastructure that handles protection — which means mitigation adds no latency and has no capacity ceiling.

---

## How It Works

Cloudflare's DDoS protection operates across multiple layers of the OSI model simultaneously, and the architecture is designed around one key insight: **detection and mitigation must happen at the edge, not at a central scrubbing center**. Traditional DDoS protection services route traffic to a dedicated cleaning facility, inspect it, and forward clean traffic back. That round trip adds latency and creates a bottleneck. Cloudflare's model runs protection inline at every one of its 300+ data centers globally — the same network that handles CDN, DNS, and WAF traffic.

The system exposes its mitigation logic through **managed rulesets**: curated collections of detection rules covering Layer 3/4 network attacks (SYN floods, UDP amplification, ICMP floods) and Layer 7 application-layer attacks (HTTP floods, slowloris, credential stuffing at scale). These rulesets are dynamic — Cloudflare updates the rules as new attack patterns emerge, without requiring customer action. When a rule fires, the response can be to drop, challenge, or rate-limit, depending on the rule's confidence and the customer's configuration.

The more sophisticated layer is **Adaptive DDoS Protection**. Rather than relying purely on static thresholds ("more than X requests per second is an attack"), the adaptive system builds a **traffic profile** specific to each zone — a rolling seven-day picture of what normal looks like. It tracks dimensions including source country, user agent distribution, origin error rates, and IP protocol mix. When incoming traffic deviates meaningfully from that profile, the adaptive rules flag it. Calculations are made at the 95th percentile, discarding the noisiest 5% to avoid outliers skewing the baseline. The system also incorporates Cloudflare's **machine learning bot scores** — signals derived from behavioral analysis across the entire network — so a volumetric flood of plausible-looking requests from residential IPs can still be identified as automated attack traffic.

For network-layer attacks, two specialized systems handle the most technically demanding cases. **Advanced TCP Protection** deals with out-of-state TCP attacks: randomized ACK floods, spoofed SYN floods, and SYN-ACK reflection attacks that defeat stateless packet inspection. **Advanced DNS Protection** targets fully randomized DNS attacks — specifically random prefix attacks that saturate authoritative resolvers by querying for nonsense subdomains at scale. These systems are available to Magic Transit customers, who route their own IP space through Cloudflare's network for infrastructure-level protection.

The newest capability, **Programmable Flow Protection**, lets enterprises deploy custom eBPF packet logic across Cloudflare's network. If you operate a UDP-based protocol — a game server, a custom VPN, a streaming service — and the standard rules don't match your traffic shape, you can write the packet inspection logic yourself and have it execute at line rate across the global network.

**Protection is unmetered.** There is no cap on the volume of attack traffic Cloudflare will absorb. The largest attacks on record — terabit-scale floods — have been handled transparently by customers who never saw a bill for the extra bandwidth. This is structurally possible because Cloudflare's network capacity, spread across hundreds of locations with direct carrier peering, vastly exceeds what any botnet can generate against a single target.

---

## In the Wild

**Online gaming and real-time applications.** Game servers are a favorite DDoS target — competitors, griefers, and extortionists all have motive. A multiplayer game on Cloudflare's network can route player traffic through Magic Transit, which means Advanced TCP Protection sits between the public internet and the game servers. Volumetric UDP floods and TCP state exhaustion attacks are absorbed at Cloudflare's edge; the game servers never see the junk packets. Latency stays low because traffic hits the nearest Cloudflare location rather than detour through a scrubbing facility in a distant city.

**E-commerce during peak events.** A retailer launching a product drop or running a flash sale is a predictable DDoS target — the attack window is known, the financial impact is clear, and competitors or extortionists have incentive. The adaptive profiling system matters here: the site's traffic will spike dramatically during a legitimate sale, and a naive threshold-based system might treat that spike as an attack. Because the adaptive rules model the zone's own historical pattern — and because anomaly detection distinguishes volumetric flood from organic surge — a real sale doesn't trigger mitigation while an artificial flood still does.

**SaaS platforms with multi-tenant infrastructure.** A platform that hosts thousands of customer sites behind shared infrastructure is an attractive amplification target: take down one endpoint and you affect all the tenants. Cloudflare's HTTP DDoS rulesets fire at the platform level, absorbing attack traffic before it reaches origin infrastructure. Enterprise customers can customize rule sensitivity per hostname and tune override policies to match their traffic mix — important when the platform's user base spans wildly different geographies or device types.

**Financial services and regulated industries.** Uptime requirements for banks and trading platforms are essentially absolute — minutes of downtime have regulatory and reputational consequences. These customers tend to run on Enterprise plans with the Advanced DDoS add-on, which adds proactive false-positive detection before new rules are deployed, enhanced adaptive profiling signals (ML scores, user agent analysis, query string patterns), and advanced alerting with filtering. The protection stack integrates with existing WAF and Bot Management policies, so a single attack that spans application and network layers is handled coherently.

---

## What It Doesn't Do

DDoS protection is distinct from application security more broadly. Cloudflare's DDoS systems detect and absorb volumetric and protocol-level attacks, but they're not a substitute for the WAF (which handles injection attacks, vulnerability exploitation, and content-based threats) or Bot Management (which handles sophisticated low-volume credential stuffing and scraping). The products are complementary and share infrastructure, but they address different threat models.

Adaptive DDoS Protection is less effective for multi-tenant SaaS zones where a single Cloudflare zone proxies many different customers under custom hostnames. The traffic profile is built at the zone level, not per hostname, so the aggregated baseline may be too broad to flag deviations on any individual customer's subdomain.

Advanced TCP and DNS Protection are Magic Transit features. If you're running a website or application behind Cloudflare's standard proxy (CDN/WAF path), those systems aren't part of your stack — though the HTTP and network-layer managed rulesets cover the equivalent threats for that architecture.

---

## Further Reading

- [**Cloudflare DDoS Protection docs**](https://developers.cloudflare.com/ddos-protection/) — The full documentation index covering managed rulesets, adaptive protection, and advanced systems for TCP and DNS.

- [**Cloudflare blocks record-breaking 5.6 Tbps DDoS attack** — blog.cloudflare.com](https://blog.cloudflare.com/cloudflare-mitigates-record-breaking-largest-ddos-attack-ever-reported/) — A post-mortem on the largest volumetric attack on record, with details on how autonomous mitigation handled the event without human intervention.

- [**Adaptive DDoS Protection** — developers.cloudflare.com](https://developers.cloudflare.com/ddos-protection/managed-rulesets/adaptive-protection/) — Technical documentation on how traffic profiles are built, what dimensions are tracked, and how to configure sensitivity and override rules.

- [**Advanced TCP Protection** — developers.cloudflare.com](https://developers.cloudflare.com/ddos-protection/advanced-ddos-systems/overview/advanced-tcp-protection/) — Details on how Cloudflare handles out-of-state TCP attack variants including spoofed SYN floods and randomized ACK floods.

- [**DDoS threat report** — blog.cloudflare.com](https://blog.cloudflare.com/ddos-threat-report-for-2024-q4/) — Cloudflare's quarterly analysis of attack trends, including the shift toward hyper-volumetric attacks, DNS-layer threats, and the most frequently targeted industries.

- [**Magic Transit** — developers.cloudflare.com](https://developers.cloudflare.com/magic-transit/) — The network-layer product that enables Advanced TCP and DNS Protection for infrastructure-level deployments, routing BGP-announced IP space through Cloudflare's network.

---

*Next: [Magic Transit](#/magic-transit) — network-layer DDoS protection and traffic acceleration for your own IP infrastructure.*
