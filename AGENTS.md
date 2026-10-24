<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep AI photo results as an in-memory review draft and persist a report only after explicit user confirmation, so uncertain detections never silently affect inventory.
- Keep `/oferta` data-free and prerendered as the public sales page, so it remains fast and independent from authenticated app state.
- Keep the private food catalogue separate from ideal inventory; confirmed detections must never automatically create shopping targets.
- Save immutable confirmed report snapshots and normalized detected items atomically through the authenticated database RPC; photo quota logs stay separate, and report edits do not create new analyses.
- Scope browser inventory/report caches and query keys by account identity; never import an unscoped visitor cache automatically into an account.
- Own session hydration and identity-change invalidation in one root provider; sign-out cancels queries, clears protected cache, ends the session, then replaces history with the login page.
- Keep public sales/auth/legal routes independent from protected account routes under the Cloud Auth pathless gate; private server functions always validate the bearer themselves.
- Store profile consent separately from read-only subscription entitlements; customers cannot write paid-access fields, and future payment webhooks must verify provider signatures before privileged updates.
- Cross-domain commercial integration shares the account provider, not browser storage; never transfer tokens in links, accept client purchase claims, or enable broad CORS without an explicit domain allow-list.
- Paid access is written only by the signature-verified payments webhook, which re-fetches the subscription from the provider and filters by environment derived from the build token, so test purchases never unlock live access.
