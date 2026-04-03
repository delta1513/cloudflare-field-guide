# Gateway: The Internet Firewall That Travels With Your Users

Corporate network security used to be a perimeter problem. You built a firewall at the edge of your office, routed everything through it, and declared the inside safe. Then laptops left the building. SaaS replaced the data center. VPNs became the hairpin through which all remote traffic was funneled back to headquarters — adding latency, adding cost, adding a single point of failure. Cloudflare Gateway is the answer to that collapse: a security layer that lives in the network itself, filtering and inspecting traffic wherever users happen to be.

Gateway is Cloudflare's Secure Web Gateway, part of the broader Zero Trust platform called Cloudflare One. It sits between your users and the internet, enforcing policies at three distinct levels — DNS, network, and HTTP — without requiring traffic to backhaul through a central location. The filtering follows the user.

---

## How It Works

Gateway operates as a stack of inspection layers, each deeper and more capable than the last, and each independently useful.

The first layer is **DNS filtering**. Every connection to the internet begins with a DNS lookup. Gateway intercepts those queries — before any content is fetched, before a TCP connection opens — and matches them against your policies. A domain categorized as malware, phishing, or adult content can be blocked at this stage by simply refusing to resolve it. The response is a non-answer: `0.0.0.0` for IPv4, `::` for IPv6. This works for every application on the device, not just browsers, because DNS is universal. Gateway's DNS filtering also supports **Safe Search enforcement** across Google, Bing, YouTube, DuckDuckGo, and Yandex, and lets you override DNS answers entirely — pointing a hostname to a different IP — which is useful for split-horizon configurations.

The second layer is **network filtering**, which operates on raw packets. Here, policies match on IP addresses, ports, protocols (TCP, UDP, GRE), and the **Server Name Indication (SNI)** field sent at the start of a TLS handshake. SNI inspection is the trick that makes this layer useful for encrypted traffic without decrypting it: the hostname a client is connecting to is visible in plaintext before the encryption begins. This layer catches what DNS filtering misses — traffic that bypasses DNS, connections to IP addresses directly, or non-web protocols.

The third and deepest layer is **HTTP inspection**. To see inside HTTPS traffic, Gateway performs **TLS interception**: it terminates the encrypted connection from the client, inspects the plaintext HTTP, then re-encrypts and forwards to the destination. The client sees a certificate signed by a Cloudflare root CA (or your organization's own CA), which you install on managed devices. With decryption active, Gateway can inspect full URLs, HTTP headers, request bodies, file types, MIME types, and uploaded or downloaded file content. Actions at this layer include block, allow, **isolate** (sending the session to Cloudflare Browser Isolation, where content renders in a remote browser rather than on the device), redirect, and **Do Not Inspect** (a bypass for applications that pin certificates or are otherwise incompatible with interception). Gateway also integrates **Data Loss Prevention (DLP)** profiles at this layer — scanning outbound content for patterns like credit card numbers, SSNs, or custom regex — and can send suspicious files to a sandbox for behavioral analysis.

**How traffic reaches Gateway** depends on deployment mode. The **WARP client** — Cloudflare's device agent — establishes a WireGuard or MASQUE tunnel from the device to Cloudflare's edge, routing all traffic (or DNS-only, depending on configuration) through Gateway automatically. For networks rather than individual devices, you can configure a location with a dedicated DNS resolver address; queries from that IP range are automatically associated with your account. There's also a browser-based option via Cloudflare's proxy that doesn't require any client at all, useful for unmanaged or BYOD devices.

**Policy evaluation order** follows a defined sequence within each layer: more specific policies take precedence, and within HTTP inspection, Do Not Inspect rules are evaluated first so that bypassed traffic never gets touched. Changes propagate to Cloudflare's global network in up to 60 seconds.

---

## In the Wild

**A distributed company replacing a legacy VPN.** A 500-person software firm with employees in twelve countries was forcing all traffic through a single VPN concentrator in Frankfurt. Latency to SaaS apps was painful for teams in Singapore and São Paulo. They deployed WARP to every laptop and configured Gateway with HTTP inspection and DLP profiles. Traffic now exits to the internet from the nearest Cloudflare location — typically under 10ms away — while policy enforcement stays uniform worldwide. The Frankfurt appliance was decommissioned.

**A school district enforcing content policy across 8,000 Chromebooks.** The district configured Gateway DNS filtering at their network level, associating their public IP ranges as Gateway locations. No agent required. DNS queries from every school-issued device route through Gateway, which blocks adult content, social media during school hours (using time-based policies), and known malware domains. The Safe Search enforcement on YouTube means students hitting `youtube.com` see only filtered results, automatically.

**A financial services team locking down data exfiltration paths.** Compliance required that no customer data leave through personal cloud storage. The team enabled HTTP inspection and built DLP profiles matching their customer identifier formats. Gateway's HTTP policies block uploads to consumer Dropbox, Google Drive personal accounts, and any file transfer service not on an allowlist — while allowing uploads to the company's own Google Workspace tenant. The same policy set catches copy-paste of structured data into AI chat interfaces.

**A managed security provider running Gateway for clients.** An MSSP uses Cloudflare's multi-tenant architecture to manage separate Gateway configurations for 40 client organizations from a single Cloudflare account. Each client gets isolated DNS filtering, its own content policies, and separate logging pipelines to their SIEM. When a threat intelligence feed flags a new malware domain, the MSSP pushes a block policy that propagates to all 40 clients within a minute.

---

## What It Doesn't Do

Gateway does not replace an endpoint detection and response (EDR) tool. It sees network traffic; it doesn't see processes, memory, or file system activity on the device. A compromised machine that reaches out to a command-and-control domain will be blocked, but Gateway won't tell you that `svchost.exe` has been replaced by malware. Pair it with an EDR.

DNS filtering has known bypass vectors. Applications that use hardcoded DNS servers, or operating systems with DoH enabled to a provider outside Gateway, can route around DNS policies. WARP in full-tunnel mode closes this gap by routing all traffic — not just DNS — through the WireGuard tunnel, but DNS-only deployments leave the bypass open. Similarly, iCloud Private Relay and third-party VPNs running alongside WARP can interfere with policy enforcement.

TLS inspection requires certificate trust on every managed device. It doesn't work for devices you don't control, applications that use certificate pinning (common in mobile banking and some enterprise software), or traffic to sites with extended validation certificates that browsers handle specially. The **Do Not Inspect** action exists specifically to carve out these exceptions, but managing the exceptions list takes ongoing attention.

---

## Further Reading

- [**Gateway policies overview** — developers.cloudflare.com](https://developers.cloudflare.com/cloudflare-one/policies/gateway/) — The canonical starting point covering all six policy types (DNS, network, HTTP, egress, resolver, and packet filtering) and how they layer.

- [**Introducing Cloudflare One** — blog.cloudflare.com](https://blog.cloudflare.com/introducing-cloudflare-one/) — The original announcement explaining the architectural philosophy behind Gateway, WARP, Access, and Tunnel as a unified Zero Trust platform.

- [**How Gateway inspection works** — developers.cloudflare.com](https://developers.cloudflare.com/cloudflare-one/policies/gateway/http-policies/tls-decryption/) — Technical detail on TLS decryption: certificate requirements, what categories of traffic are inspected vs. bypassed by default, and the mechanics of the MITM proxy.

- [**Replace your VPN with Cloudflare Zero Trust** — developers.cloudflare.com](https://developers.cloudflare.com/cloudflare-one/replace-vpn/) — Cloudflare's own migration guide, which doubles as a useful architectural comparison between legacy VPN topologies and the WARP + Gateway model.

- [**Data Loss Prevention** — developers.cloudflare.com](https://developers.cloudflare.com/cloudflare-one/policies/data-loss-prevention/) — Documents how DLP profiles integrate with Gateway HTTP policies, including pre-built detection patterns and how to build custom ones.

- [**Cloudflare One: One Year In** — blog.cloudflare.com](https://blog.cloudflare.com/cloudflare-one-one-year-in/) — Real-world deployment data and lessons from the first year of the platform, including how companies used Gateway to replace legacy SWGs.

---

*Next: [Access](#/access) — Zero Trust application authentication that works alongside Gateway to control who reaches what.*
