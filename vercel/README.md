# ReleaseRadar on Vercel

Complete application migration source, separate from the current Sites deployment. Includes the regression/stress labs, QA copilot, AI chat, API relay/imports, OAuth with refresh, Agile/RST workbench, and Jira import/bug/evidence flows. Deployed at https://releaseradar-lime.vercel.app. When importing this repository, set Root Directory to vercel. See the production verification notes below for remaining limitations.

## Required services

1. Vercel account/project. Import this folder or run `npx vercel` from it after logging in. Use Framework **Other**, build `npm run build`, output `public`, Node 24. Do not deploy `dist` alone: it would omit server functions.
2. Supabase project for PostgreSQL and email/password authentication. Use the transaction pooler connection URI as `DATABASE_URL`. Never expose the database password in browser code. Apply `migrations/001.sql` in Supabase SQL Editor, or run `npm run migrate` with the server environment configured. Tables have RLS enabled and no browser grants; the server database role must have access and bypass RLS.
3. Configure Vercel server environment variables from `.env.example`: `APP_ORIGIN` must be the exact production HTTPS origin, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `OPENAI_API_KEY`, and a new 32-byte base64url `OAUTH_TOKEN_KEY`. Keep encryption keys stable after deployment. Optional `DATABASE_CA_CERT` supports a trusted database CA; TLS verification is never disabled. Do not paste secrets into chat or commit them.
4. In Supabase Auth, enable email/password, set Site URL to the production origin, and allow `<origin>/api/auth/callback`. Configure an email sender for public signups; Supabase's default email service may restrict recipients. Keep email confirmation enabled. Signup confirmation uses PKCE; open the link in the same browser. Account UI supports signup, signin and signout. Password reset can be initiated from Supabase administration until a recovery flow is added.
5. Deploy, then verify signup/confirmation/signin, chat and copilot, a public API relay call, OAuth connect/refresh, Jira story import, and an explicitly approved test issue plus JSON attachment. Update external OAuth apps with the new callback `<origin>/api/oauth/callback`.

## Migration behavior and security

Existing Sites database and secrets are not copied. User IDs change, so Jira/OAuth connections must be reconnected. Browser-local workspaces and API collections do not follow domains: export from the old site and import on Vercel. API exports intentionally omit transport credentials. The previous hostname remains available during verification. No request is silently forwarded to the old host.

The entrypoint removes supplied identity headers and derives identity only from Supabase `getUser`. The browser has HttpOnly Secure SameSite=Lax auth cookies; token refresh is managed server-side by Supabase SSR. Provider tokens remain encrypted at rest, owner-scoped. POST actions require the production Origin. Only the configured production hostname can use APIs; preview deployments intentionally fail closed unless pointed to separate preview services and their own APP_ORIGIN. PostgreSQL queries are parameterized. Server secrets and Worker bundle are excluded from public output.

The public demo and prepared/imported test generation remain available. Live chat/QA, relay, Jira and OAuth require their configured backend dependencies. Vercel/Supabase/OpenAI account limits and usage charges are independent; this migration does not guarantee zero cost. Do not enable paid upgrades without approval.

## Validation

`npm test` runs inherited feature tests plus migration checks against an embedded PostgreSQL engine and mocked identity providers. `npm run build` creates the static assets. Live Vercel/Supabase integration must be checked after provisioning; local tests do not prove production setup.

## Production deployment — 29 October 2026

URL: https://releaseradar-lime.vercel.app
Vercel project: ankit-kalluraya/releaseradar. Supabase Free backend provisioned in Sydney; schema applied with verified TLS. 60 tests passed. Production checks passed for public pages, API configuration, API relay, synthetic account sign-in/session/sign-out, and authenticated Jira connection status. Synthetic account was removed. No real Jira issue created.

Live AI is blocked: the transferred local OpenAI key returns HTTP 401 invalid_api_key. Replace OPENAI_API_KEY in the Vercel Production environment and redeploy. Email signup/delivery, provider OAuth callbacks, and live Jira import/create/attachment still need verification with real accounts. Configure Supabase Site URL and allowed redirect URL to this production origin and /api/auth/callback, and configure a suitable mail sender for public signups.

