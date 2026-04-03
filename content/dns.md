# DNS: The Address Book That Runs Everything

Every domain on the internet depends on DNS. It's the system that translates `example.com` into an IP address a router can use — the phone book nobody thinks about until it breaks. For most of the web's history, DNS was an afterthought: slow to propagate, easy to spoof, and managed through arcane zone file syntax. Cloudflare's DNS offering is a quiet revolution in that infrastructure. It's authoritative DNS built on the same global anycast network that handles hundreds of millions of HTTP requests per second — and it's free on every plan.

---

## How It Works

**Cloudflare operates as your authoritative nameserver.** When you add a domain, Cloudflare assigns you two nameservers (like `alice.ns.cloudflare.com` and `bob.ns.cloudflare.com`). Once you point your registrar to those, Cloudflare answers all DNS queries for your zone from its network of data centers in over 330 cities. No single server, no single point of failure — every location answers independently using **anycast routing**, which means a query from Tokyo hits a Tokyo node, not Virginia.

Propagation is fast because Cloudflare's infrastructure is what's propagating. Changes to DNS records typically go live across the entire network in under a minute. The industry used to measure propagation in hours; the old mental model of "wait 48 hours for DNS to propagate" comes from a world where authoritative servers were single machines in a single location with long TTLs. Cloudflare's model makes that irrelevant.

**Record types are standard.** A, AAAA, CNAME, MX, TXT, NS, SRV, CAA — all the records you'd expect, plus less common ones like SSHFP and TLSA. What's distinctive is how Cloudflare handles the **proxy toggle**, the orange cloud icon in the dashboard. Records marked as proxied have their traffic routed through Cloudflare's network, enabling DDoS protection, caching, and Workers. Records marked DNS-only resolve directly to your origin IP. That toggle is the gateway between pure DNS and Cloudflare's full platform.

**CNAME flattening** solves a long-standing DNS limitation. The DNS spec prohibits CNAME records at the zone apex — `example.com` — because CNAME and SOA/NS records can't coexist. Cloudflare resolves this by chasing the CNAME chain server-side and returning the final A or AAAA record instead. You configure a CNAME at your root domain pointing to a load balancer, a Pages site, or any dynamic target, and clients see a plain IP. This is the mechanism that powers root custom domains on Cloudflare Pages.

**DNSSEC** adds cryptographic integrity to DNS. Without it, an attacker between a resolver and an authoritative server can inject false records — a technique called DNS spoofing or cache poisoning. DNSSEC signs every record in your zone with a private key; resolvers that support it can verify those signatures against a chain of trust anchored at the root. Cloudflare uses **Algorithm 13** (ECDSA with P-256 and SHA-256) by default, which produces compact signatures and is widely supported. Enabling it takes one click in the dashboard; Cloudflare handles key generation, signing, and rotation automatically. If you also use Cloudflare Registrar, the DS record is submitted upstream automatically.

For teams that can't fully commit to Cloudflare as their primary DNS provider, there are two alternative setups. **CNAME setup (partial)** lets you proxy individual subdomains through Cloudflare while keeping your existing authoritative DNS elsewhere — useful for large enterprises migrating incrementally. **Secondary DNS** (Enterprise) uses standard AXFR/IXFR zone transfers to keep Cloudflare in sync with a primary provider, adding Cloudflare's anycast network as a secondary layer without giving up control. Multi-signer DNSSEC is supported for secondary setups, a technically demanding configuration that keeps both providers' keys valid simultaneously.

**DNS Firewall** serves a different population: teams running their own authoritative nameservers who still want Cloudflare's anycast network in front of them. It acts as a caching proxy and DDoS shield for your infrastructure, without requiring any change to where records are managed.

Limits worth knowing: a zone can have up to 200,000 DNS records on paid plans. Free plans support 1,000. API access is included on all plans; you can manage records programmatically through the REST API or Terraform provider.

---

## In the Wild

**Enterprises migrating off legacy DNS providers.** A company with thousands of DNS records spread across a decade of vendor contracts can't flip a switch. They use Cloudflare's partial (CNAME) setup to proxy high-traffic subdomains — `www`, `api`, `auth` — through Cloudflare first, validating the behavior, then gradually move the full zone when they're confident. The business case is DDoS protection and performance from day one, without a risky cutover.

**SaaS platforms using CNAME delegation.** A platform that lets customers use custom domains (`invoices.theircustomerdomain.com`) asks customers to point a CNAME at their subdomain on Cloudflare. Cloudflare's CNAME setup and SSL-for-SaaS make this tractable at scale — thousands of custom domains, each with valid TLS certificates and proxied traffic, managed through a single account and API. DNS is the entry point that makes the whole architecture work.

**High-availability setups with Secondary DNS.** A financial services company needs their DNS to survive any single provider outage. They run their own authoritative DNS cluster as the primary, configure zone transfers to Cloudflare, and publish both sets of nameservers. Even if their primary cluster goes dark, Cloudflare's anycast network keeps answering. The zone transfer happens over IXFR, so incremental updates propagate in seconds. The cost of the backup is a fraction of the cost of the outage it prevents.

**Protecting brand domains with DNSSEC.** A media company with a recognizable domain — the kind that phishing campaigns impersonate constantly — enables DNSSEC as a baseline hygiene measure. Even if an attacker compromises an upstream resolver's cache, they can't forge records that pass signature validation. Combined with CAA records (which restrict which certificate authorities can issue TLS certificates for the domain) and MX records with SPF/DKIM/DMARC TXT records, the DNS layer becomes a meaningful part of the security perimeter.

---

## What It Doesn't Do

Cloudflare DNS is authoritative, not recursive. It answers queries for zones you control — it doesn't resolve arbitrary internet names on your behalf. For that, you want the [1.1.1.1](https://1.1.1.1) public resolver, which is a separate product. The two are complementary but distinct.

Secondary DNS and partial (CNAME) setup require Business or Enterprise plans. The free and Pro tiers are full-setup only: Cloudflare is your primary authoritative server.

Internal DNS — serving private DNS zones for your internal network — is available on Enterprise and currently in beta. It's not a split-horizon setup you can bolt on to a free zone.

---

## Further Reading

- [**Cloudflare DNS · developers.cloudflare.com**](https://developers.cloudflare.com/dns/) — The full product documentation, covering every record type, zone setup option, DNSSEC configuration, and API reference.

- [**How DNSSEC Works · Cloudflare Learning Center**](https://www.cloudflare.com/learning/dns/dns-security/) — A clear conceptual walkthrough of the DNSSEC chain of trust, key signing keys, and why cache poisoning was such a persistent problem before it.

- [**Introducing CNAME Flattening · blog.cloudflare.com**](https://blog.cloudflare.com/introducing-cname-flattening-rfc-compliant-cnames-at-a-domains-root/) — The original post explaining why CNAME at the apex was prohibited, what the standard workarounds were, and why Cloudflare's server-side resolution is cleaner than ALIAS records.

- [**Secondary DNS — Deep Dive · blog.cloudflare.com**](https://blog.cloudflare.com/secondary-dns-deep-dive/) — Covers the AXFR/IXFR protocol mechanics, how Cloudflare handles zone transfers, and the failover math behind running multiple authoritative providers.

- [**DNS over HTTPS — The Encryption That Wasn't · blog.cloudflare.com**](https://blog.cloudflare.com/dns-encryption-explained/) — Explains the distinction between DNSSEC (integrity) and DNS-over-HTTPS (privacy), and why you need both for different threat models.

- [**Cloudflare DNS Terraform Provider**](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs/resources/record) — The Terraform resource reference for `cloudflare_record`; essential for teams managing DNS-as-code at scale.

---

*Next: [Registrar](#/registrar) — domain registration at cost, with no markup and automatic DNSSEC.*
