# Tunnel: The Firewall Hole You Never Have to Open

Every sysadmin knows the drill: expose a service to the internet, and you need a public IP, an open port, and something standing in front of it before the scans start. It's a model that hasn't changed much in thirty years. Cloudflare Tunnel throws it out entirely.

Tunnel lets you connect any server, web application, SSH host, or internal network to Cloudflare — and through Cloudflare to the world — without ever opening an inbound firewall rule. No public IP. No port forwarding. No "please whitelist this CIDR block" conversation with your network team. The connection flows outward from your infrastructure, and Cloudflare handles everything else.

---

## How It Works

The heart of the system is **cloudflared**, a small daemon you run on any host inside your network. When it starts, cloudflared dials outbound to Cloudflare's network and establishes **four long-lived connections to at least two distinct Cloudflare data centers**. Not one connection — four, spread across multiple points of presence. This isn't just for performance. It means if a Cloudflare data center has a bad day, or a single connection drops, traffic reroutes automatically. The tunnel stays up.

From that point on, traffic flows both ways through those connections. Users or systems on the internet connect to a Cloudflare hostname — `app.example.com` — Cloudflare's edge receives the request, and it's proxied back through the tunnel to your origin. Your server never sees a connection that didn't pass through Cloudflare first. **Origin IP exposure is eliminated by design.** Attackers can't bypass your WAF rules by hitting the origin directly, because the origin has no open port to target.

DNS routing works through a **tunnel UUID** — a stable identifier like `6ff42ae2-765d-4adf-8112-31c55c1551ef.cfargotunnel.com` — which Cloudflare assigns to each tunnel. A CNAME record points your public hostname at this UUID. You can also wire tunnels into **Cloudflare Load Balancer** to spread requests across multiple origins.

For high availability at the origin side, cloudflared supports **replica connectors**: multiple instances of cloudflared running the same tunnel configuration on different hosts. Each replica independently holds four connections to Cloudflare. Traffic distributes across all healthy replicas, with Cloudflare selecting the geographically closest one for each request. Lose a host, and the others absorb traffic without intervention.

Tunnel integrates natively with the rest of Cloudflare One. Put **Access** in front of a tunnel and you have zero-trust application access: users authenticate with your identity provider before Cloudflare forwards the request at all. Combine it with **WARP** — Cloudflare's device client — and private network routes defined in the Tunnel configuration become accessible to enrolled devices without a traditional VPN. Traffic from a WARP-enrolled laptop reaches your private subnets through cloudflared, routed over Cloudflare's backbone. **Gateway** policies can then inspect and filter that traffic for DNS and HTTP — the same security controls that apply to internet traffic now cover your private applications too.

There's also a **WARP Connector** variant for site-to-site connectivity. Where standard cloudflared handles client-initiated traffic to a server, WARP Connector enables bidirectional and mesh networking between sites — useful for connecting two private networks or enabling server-to-server communication across locations.

---

## In the Wild

**Secure remote access without a VPN appliance.** A growing startup has three engineers who need SSH access to production. The traditional answer is a bastion host, a VPN with licenses to manage, and a policy for rotating credentials. The Tunnel answer is cloudflared on each production host, Access in front of the tunnel, and short-lived SSH certificates issued from the identity provider. Engineers authenticate with SSO, get a certificate, connect. No standing credentials, no VPN client, no open port 22 on the internet.

**Self-hosted software on a home lab.** Homelab operators running services like Grafana, Jellyfin, or Nextcloud on a home connection can't rely on a static IP and don't want to expose their home network to the internet. Tunnel bridges the gap: cloudflared runs on a local machine, public traffic routes through Cloudflare's edge, and the home router never needs configuration. Access can gate the whole thing with Google or GitHub login so random visitors can't stumble onto a media server.

**Hybrid cloud connectivity.** A company runs core services in an on-premises data center but is migrating workloads to a cloud provider. Both environments need to talk to each other during the transition. Rather than negotiating an IPSec VPN between on-prem hardware and a cloud VPC, cloudflared instances in both environments join the same private network definition. Services in either environment can reach each other through Cloudflare's backbone, with no direct peering agreement required.

**Zero-trust staging environments.** Development teams often need stakeholders to preview work-in-progress without exposing an ephemeral environment to the public internet. A Tunnel with an Access policy keyed to a specific email domain gives stakeholders a stable URL, authenticated access, and no risk of a staging environment showing up in search results or getting crawled before launch.

---

## What It Doesn't Do

Tunnel moves traffic through Cloudflare; it does not replace your application firewall, WAF, or DDoS protection — those are separate Cloudflare products that can be layered on top. It also doesn't give you application-layer observability out of the box. You get connection logs, but if you want request-level tracing or distributed traces from tunnel to origin, that's instrumentation you add to your application.

The tunnel model is also one-directional in its basic form: client reaches server through cloudflared, but server-initiated outbound traffic takes the host's normal routing table, not the tunnel. Use WARP Connector if you need bidirectional or server-to-server routing between private networks.

---

## Further Reading

- [**Cloudflare Tunnel docs** — developers.cloudflare.com](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) — The canonical reference: tunnel setup, routing, private networks, and connector configuration in one place.

- [**A Boring Solution to a Boring Problem: Argo Tunnel** — blog.cloudflare.com](https://blog.cloudflare.com/argo-tunnel/) — The original launch post for what was then called Argo Tunnel; explains the design philosophy behind outbound-only connections and why Cloudflare built it this way.

- [**Tunnel with Cloudflare Access: how it works** — developers.cloudflare.com](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/) — How Access policies layer in front of tunneled applications for zero-trust authentication before a request ever reaches your origin.

- [**Replace your VPN with Cloudflare Zero Trust** — blog.cloudflare.com](https://blog.cloudflare.com/replace-your-vpn/) — Cloudflare's case for why the VPN model is architecturally broken and how Tunnel plus WARP plus Access replaces it, with a worked example.

- [**WARP Connector: site-to-site connectivity** — developers.cloudflare.com](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/private-net/warp-connector/) — Covers the bidirectional connector variant for mesh networking between private networks — the piece that handles server-initiated traffic flows the basic tunnel model can't.

- [**Cloudflare for Teams architecture deep-dive** — blog.cloudflare.com](https://blog.cloudflare.com/zero-trust-week-cloudflare-for-teams/) — Technical walkthrough of how Tunnel, Access, Gateway, and WARP compose into a complete zero-trust network architecture.

---

*Next: [Access](#/access) — identity-aware application access that gates every request before it reaches your origin.*
