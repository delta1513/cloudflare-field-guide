# WAF: The Firewall That Learns the Internet

The web is a hostile place. SQL injection attempts arrive seconds after a new site goes live. Botnets probe every login endpoint for leaked credential pairs. Zero-day vulnerabilities in popular software get weaponized before patches ship. A traditional approach to application security — maintain your own firewall, subscribe to a signature feed, tune the rules — requires a dedicated security team and still falls behind the pace of attacks. Cloudflare's WAF is built on a different premise: security intelligence accumulated across millions of properties can protect any one of them, automatically, at the edge.

---

## How It Works

Every HTTP request that reaches a Cloudflare-proxied zone passes through the **Ruleset Engine** before it touches your origin. The engine evaluates each request against a chain of rulesets — managed, custom, and rate limiting — and executes the first matching action. The decision happens in Cloudflare's edge network, before the request ever traverses the internet toward your server.

The expression language powering all of this is the **Rules language**: a structured syntax that lets you filter on virtually any property of the incoming request. IP address, ASN, country, HTTP method, URL path, individual headers, request body content, the presence of specific cookies — all addressable. Conditions compose with boolean operators. A rule expression like `http.request.uri.path contains "/wp-admin" and not ip.src in $trusted_ips` is evaluated at line rate, millions of times per second, across the global network.

**Managed rulesets** are where most protection comes from out of the box. Cloudflare ships several. The **Cloudflare Managed Ruleset** is maintained by Cloudflare's security team and covers known attack techniques and zero-day vulnerabilities — rules are updated whenever a significant new threat emerges. The **OWASP Core Ruleset** is Cloudflare's implementation of the Open Web Application Security Project's ModSecurity Core Rule Set, covering the canonical top-ten attack categories: injection, broken authentication, XSS, and the rest. Its model is distinctive: rather than hard blocking on any single match, it uses **cumulative threat scoring**. Each matching rule contributes a score. When the total exceeds a configurable threshold, the WAF takes action. This makes it less brittle than signature-only systems — a single suspicious signal doesn't trip the wire, but a cluster of them does.

On top of managed rulesets sits the **WAF Attack Score**: a machine learning system that classifies every request on a scale from 1 to 99. A score near 1 means the request almost certainly contains attack payload. Near 99 means it's almost certainly clean. The system detects SQLi, XSS, and remote code execution attempts — including obfuscated variants that evade fixed signature rules. Base64-encoded payloads, URL-encoded injections, Unicode escape sequences: the model decodes them all before scoring. This matters because attackers routinely fuzz known signatures by encoding their payloads, and signature-only rulesets miss these variants. The attack score fills that gap. Enterprise plans expose per-vector scores (`cf.waf.score.sqli`, `cf.waf.score.xss`, `cf.waf.score.rce`) in addition to the global score, letting you build tight, specific custom rules.

**Custom rules** let you express logic that no managed ruleset knows about: your application's own structure, your known-good IP ranges, the specific attack patterns in your threat logs. The rules limit scales with plan — 5 rules on Free, 20 on Pro, 100 on Business, 1,000 on Enterprise — as does regex support (Business and above). Custom rules run in evaluation order; a Block action stops the chain for that request.

**Rate limiting rules** are their own layer: define a count threshold over a time window, optionally fingerprinted to IP, cookie, or custom header, and apply an action — block, challenge, throttle — when it's exceeded. This catches credential stuffing, scraping, and API abuse that doesn't look malicious per-request but becomes obvious in aggregate.

The WAF integrates naturally with the rest of the Cloudflare platform. Bot scores from **Bot Management**, client certificate status from **mTLS**, and signals from **DDoS protection** are all available as fields in rule expressions. Security Events provides a sampled log of every rule match with the exact expression that fired, making it practical to tune rules based on real traffic rather than guesswork.

---

## In the Wild

**E-commerce on WordPress.** A mid-sized retailer running WooCommerce on a Business plan enables the Cloudflare Managed Ruleset and the OWASP Core Ruleset with the `wordpress` tag filter turned on — a group of rules pre-tuned for WordPress-specific attack patterns. They add one custom rule: block any request where the WAF Attack Score Class is `attack` (score 1–20) and the path is under `/wp-login.php`. During a credential stuffing campaign that hits 40,000 requests per hour, their origin sees none of it. The rules fire at the edge.

**Financial services API.** A fintech company exposes a REST API to mobile clients and third-party partners. They use rate limiting rules to enforce per-IP request budgets on authentication endpoints — 5 login attempts per 10-second window. They use custom rules to allow only known partner ASNs to reach certain administrative endpoints. And they deploy the Exposed Credentials Check ruleset on `/auth/login`, which checks submitted credential pairs against Cloudflare's database of billions of previously breached username/password combinations and issues a Managed Challenge when a match is found. No server code changes required.

**SaaS platform with multi-tenant risk.** A B2B SaaS company running on Enterprise uses **account-level WAF configuration** to deploy a single managed ruleset across all 200+ of their customer zones simultaneously. When the security team needs to push a rule change — say, blocking exploitation of a new CVE in a dependency they use across all tenants — they push it once at the account level and it applies everywhere within seconds. Without this, the alternative would be scripting the Cloudflare API across every zone individually.

**Media site defending against scraping.** A news publisher uses the WAF attack score combined with bot score in a single custom rule expression: block requests with an attack score below 25 *or* a bot score below 15. The conjunction catches two different threat categories — attack traffic and malicious automation — without building separate rules for each, keeping the ruleset legible and the false-positive rate manageable.

---

## What It Doesn't Do

The WAF filters HTTP(S) requests. It has no visibility into non-HTTP protocols — if you're running SMTP or custom TCP services, that traffic doesn't pass through it. It also doesn't replace application-level input validation: a WAF is a defense-in-depth layer, not a substitute for parameterized queries or output escaping in your code.

Body inspection has a ceiling: 128 KB for Enterprise plans, lower for others. A request body larger than that limit is analyzed only up to the limit — content beyond it passes uninspected. For applications that accept large file uploads, this is worth understanding. The `http.request.body.truncated` field lets you write a custom rule that flags or challenges requests whose bodies exceeded the inspection limit.

The OWASP scoring model, by design, can produce false positives on applications with unusual request shapes — long query strings, complex JSON bodies, certain encoding patterns. New deployments typically need a period of monitoring in log-only mode before switching to block.

---

## Further Reading

- [**WAF documentation overview** — developers.cloudflare.com](https://developers.cloudflare.com/waf/) — Starting point for the full WAF feature set, including managed rulesets, custom rules, rate limiting, and analytics.

- [**WAF attack score** — developers.cloudflare.com](https://developers.cloudflare.com/waf/detections/attack-score/) — Details on the ML scoring model: available fields, score classes, recommended thresholds, and how to combine attack score with other signals in custom rule expressions.

- [**OWASP Core Ruleset concepts** — developers.cloudflare.com](https://developers.cloudflare.com/waf/managed-rules/reference/owasp-core-ruleset/concepts/) — Explains the cumulative scoring model in depth: how individual rule scores accumulate, how thresholds work, and how to tune sensitivity without disabling entire categories.

- [**Security features interoperability** — developers.cloudflare.com](https://developers.cloudflare.com/waf/feature-interoperability/) — Documents the execution order of WAF custom rules, managed rules, bot fight mode, DDoS protection, and other Cloudflare security layers — essential reading before deploying multiple features together.

- [**Introducing WAF Machine Learning** — blog.cloudflare.com](https://blog.cloudflare.com/waf-ml/) — Cloudflare's original post on how they trained the attack score model, what data it was built on, and why fuzzing-resistant detection requires ML rather than signatures alone.

- [**WAF changelog** — developers.cloudflare.com](https://developers.cloudflare.com/waf/change-log/) — The running log of managed ruleset updates: which rules were added, modified, or disabled, and why. Useful for understanding how Cloudflare responds to new CVEs.

---

*Next: [DDoS Protection](#/ddos) — volumetric and protocol attack mitigation built into the same edge network.*
