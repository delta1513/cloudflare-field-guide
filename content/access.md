# Access: The Bouncer at Every Door

The old model of network security assumed that getting inside the perimeter meant you were trusted. Get onto the VPN, and you could reach everything. That model broke in obvious ways: one compromised credential, one misconfigured firewall rule, and an attacker moved freely. Cloudflare Access is the replacement: every application gets its own policy, every request is authenticated, and "inside the network" earns you nothing by itself.

Access is Cloudflare's Zero Trust application gateway. It sits between users and applications — internal tools, cloud dashboards, SSH servers, third-party SaaS — and makes an access decision on every single request. Not just at login. Every request.

---

## How It Works

Access operates on a **deny-by-default posture**. Nothing reaches your application unless an explicit Allow policy matches. The system evaluates every inbound request against the policies you've configured, and if no policy grants access, the request is blocked — no fallthrough, no implicit trust.

**Policies are built from three layers.** The action says what to do: Allow, Block, Bypass, or Service Auth. The rule type shapes the logic: Include is OR (match any), Require is AND (match all), Exclude is NOT (match none). Selectors supply the actual criteria — email address, IdP group membership, country, IP range, device posture score, WARP client presence, SAML or OIDC claims. Combine them and you can express things like: "allow members of the engineering IdP group, from a managed device with disk encryption enabled, unless they're connecting from a sanctioned country."

**Identity providers are the source of truth.** Access integrates with any SAML or OIDC provider — Microsoft Entra ID, Okta, Google Workspace, GitHub, or a generic identity system. Users authenticate through their existing IdP; Access validates the response and issues its own session tokens. Two tokens are created: a **global session token** scoped to your team domain that enables SSO across Access-protected apps, and a per-application **CF\_Authorization cookie** scoped to each application's domain. Both are JWTs signed by Cloudflare. Your origin server can independently validate those JWTs using Cloudflare's public keys — meaning your application can trust the identity claims without implementing its own auth logic.

**The split between identity-based and non-identity selectors matters.** Identity attributes — group membership, email domain, SAML claims — are checked at login. Non-identity attributes — IP address, country, device posture, whether the WARP client is active — are **continuously polled** throughout the session. If a user authenticates from an allowed country and then their IP changes mid-session, the country check re-evaluates and can terminate the session. This is what separates Access from a firewall rule that only runs at connection setup.

**Self-hosted applications** are the core use case. You have an internal tool — a Grafana dashboard, a Jenkins server, an admin panel — and you want to gate it without putting it on a VPN. Access fronts the application, and all traffic flows through Cloudflare's network. The standard deployment pairs Access with **Cloudflare Tunnel**: a lightweight daemon running on your infrastructure that opens an outbound connection to Cloudflare. No inbound firewall holes, no public IP required. The application doesn't need to be reachable from the internet at all — Cloudflare's edge handles the user-facing HTTPS, validates the Access token, then proxies authenticated requests through the Tunnel to your origin.

**SaaS applications** work differently. You don't control the infrastructure, so you can't put Cloudflare Tunnel in front of it. Instead, Access acts as a SAML or OIDC identity provider to the SaaS app. When a user signs into Salesforce or Confluence, the SaaS app redirects to Cloudflare for the auth handshake. Access checks your policies and, if the user passes, issues an assertion back to the SaaS app. The limitation here is real: Access can only enforce policies **at sign-on** and when the SaaS session token is reissued. Once the user is in, session management belongs to the SaaS vendor.

**Gateway and Access are designed to complement each other.** Access handles browser-based application access; **Cloudflare Gateway** handles network-layer traffic filtering and DNS. Together, they're the two halves of a Zero Trust architecture — Access ensures only authorized users reach specific applications, Gateway ensures all outbound traffic from those users is filtered and logged.

---

## In the Wild

**Replacing the engineering VPN.** A software company with a distributed team uses Access to protect its internal tools: GitHub Enterprise, internal documentation, staging environments, Kubernetes dashboards. Engineers install the Cloudflare One client once; after that, Access checks their Okta group membership and device certificate on every request. The VPN concentrator is gone. So is the help desk queue for VPN troubleshooting.

**Contractor and vendor access.** A financial services firm needs to give an outside auditor temporary access to a specific internal application — nothing else, and only for two weeks. They create an Access policy scoped to the auditor's email domain, set a session duration, and attach a short-lived service token. The auditor gets a login link. When the engagement ends, the policy is deleted. No accounts provisioned on internal systems, no credentials to rotate.

**Securing non-HTTP infrastructure.** Access isn't limited to web applications. An infrastructure team uses it to protect SSH access to production servers. Engineers authenticate through Access — which checks their IdP group and requires the WARP client to be active — and get a short-lived SSH certificate in return. The server never sees a long-lived key. The same Access audit log that tracks web app logins also tracks every SSH session.

**SaaS consolidation under a single IdP.** A mid-size company has accumulated a dozen SaaS tools, each with its own login. By configuring Access as a SAML identity provider for each one, HR can deprovision an employee in a single place — their Entra ID account — and have that revocation propagate to every connected application immediately. When SCIM provisioning is enabled, group membership changes in the IdP force re-authentication, so access adjustments take effect without waiting for token expiry.

---

## What It Doesn't Do

Access is not a WAF. It controls who can reach your application, not what authenticated users do once they're in. For request inspection, rate limiting, and bot management after authentication, you need Cloudflare WAF or custom Workers logic.

For SaaS apps, Access cannot enforce policies mid-session. If you revoke a user's Access policy after they've already signed into Salesforce, they remain logged in until the SaaS session expires. The tighter the SaaS session duration, the closer you get to real-time enforcement.

Access also doesn't replace application-level authorization. It's excellent at the front door — determining whether a user is allowed to enter — but it doesn't know whether a particular user should see the finance tab versus the engineering tab once they're inside. That's still your application's responsibility.

---

## Further Reading

- [**Cloudflare Access overview — developers.cloudflare.com**](https://developers.cloudflare.com/cloudflare-one/policies/access/) — The canonical policy reference: rule types, selectors, action semantics, and the evaluation order that determines which policy wins.

- [**Authorization cookie and JWT validation — developers.cloudflare.com**](https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/) — How the CF\_Authorization JWT is structured, what claims it carries, and how to validate it on your origin so your application can trust the identity without implementing its own auth.

- [**Cloudflare Tunnel documentation — developers.cloudflare.com**](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) — The network layer that pairs with Access for self-hosted apps: how the daemon works, how it connects to Cloudflare's edge, and how to route private network traffic without exposing infrastructure to the internet.

- [**How we built Cloudflare Access — blog.cloudflare.com**](https://blog.cloudflare.com/cloudflare-access-now-teams-of-any-size/) — The original product announcement with design rationale; explains why BeyondCorp-style Zero Trust works better at the application layer than at the network perimeter.

- [**Device posture checks — developers.cloudflare.com**](https://developers.cloudflare.com/cloudflare-one/identity/devices/) — Reference for the non-identity selectors that make Access context-aware: disk encryption, OS version, certificate presence, endpoint detection status, and how continuous evaluation works.

- [**Access SSH and infrastructure — developers.cloudflare.com**](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/use-cases/ssh/) — How Access handles non-HTTP protocols: the short-lived certificate flow for SSH, browser-based terminal rendering, and audit logging for infrastructure sessions.

---

*Next: [Gateway](#/gateway) — the DNS and network filtering layer that pairs with Access to complete the Zero Trust picture.*
