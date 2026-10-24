# Authentication and commercial integration

## Current implementation
- Existing Cloud Auth remains the account owner. Email/password, Google and Lovable sign-in use the same user IDs.
- `/auth`, `/cadastro`, `/recuperar-senha`, `/reset-password`, `/auth/callback`, `/termos`, `/privacidade`, `/` and `/oferta` are public. `/conta` lives under the client-only authenticated gate. API/server authentication is separate from the UI gate.
- Profile creation and a free subscription record happen atomically during signup. Profiles contain no roles. Customers can read their subscription but cannot insert/update/delete it.
- `tem_acesso_pago` requires backend-confirmed provider identity plus a current paid period. No existing free feature has been reclassified as paid; paid features/limits still need a business decision.
- Duplicate email handling remains with Cloud Auth; signup responses deliberately avoid revealing account existence.
- Default Cloud Auth emails are used. No custom sender or email provider has been configured.

## Separate commercial domain
1. Identify both real domains and the commercial app's owner/backend. A second app must connect to the same account provider; do not create a second identity store.
2. Safest initial flow: static sales page links to the functional application's login/account and checkout. This requires no shared cookies or cross-origin credential transfer.
3. If login is required on both domains, configure the same Cloud Auth provider and exact callback allow-list for both. Each domain keeps its own session. Do not pass access/refresh tokens through URLs, query strings or postMessage without a reviewed OAuth flow.
4. In More → Users → Auth settings → Advanced add the exact external-domain callback patterns. Current managed preview and published domains are already allowed. Localhost test callbacks are not on the hosted allow-list.
5. Cross-origin APIs, if required, must verify a bearer with Cloud Auth, use a strict origin allow-list, and scope all operations to that verified user ID. Do not accept a user ID in request data as authentication.

## Payment integration not enabled
- Choose/enable the actual provider, create the real product/price and associate checkout with the authenticated user server-side.
- Verify webhooks against the raw signed payload; persist unique event IDs for idempotency; verify environment, product, currency and payment status with the provider before writes.
- Only privileged provider handlers may update `assinaturas`; bind by a server-established customer/user mapping, never an untrusted metadata/user-ID alone.
- Record provider subscription/transaction IDs, verified time and paid period; handle pending, cancellation, expiry, refunds and renewal events.
- Do not expose a generic endpoint that lets the browser set a plan or subscription status.
- Test checkout, signed webhook, replay rejection and access readback across both actual domains before describing integration as complete.

## Legal/operator configuration still required
The included terms/privacy text is an initial operational draft, not legal advice. The operator must supply legal entity/name, contact channel, retention/deletion policy and final subscription terms before commercial launch. Do not invent these details.