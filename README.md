# Tracking platform super admin

Standalone React application; backend APIs live in the separate Backend project.

## Run locally

Use Node 24, then `npm ci` and `npm run dev`. Open http://localhost:3002.
Set `API_PROXY_TARGET` to the intended backend (e.g. http://127.0.0.1:8001 for isolated company development).
Run `npm run verify` for lint, tests, audit and production build.

## Owner activation

A normal advertiser/network admin account cannot self-promote. An authorized backend operator runs:

```
python scripts/grant_owner.py --email pushkar@vedhaka.com
```

Run this against the intended backend database. It requires an existing active,
verified account, keeps its password, revokes sessions/API keys and records an audit.
It is not executed automatically at startup. In company database mode it creates
control-plane access from one existing verified company identity; use `--company`
when needed to disambiguate. The owner signs in on the control-domain super admin app.
Never put the user's password or database credentials in this repository.

## Permissions

Platform owners can inspect networks, accounts, campaigns, conversions, invoices,
domains and network audit records. They can suspend/reactivate networks and change
account roles, enablement, API access, publisher parent and restrictive staff modules.
Role changes revoke sessions and API keys. Removing the last active network admin,
changing super admin accounts through tenant controls and orphaning affiliate
publishers are blocked. Financial history and invoice reservations are retained.

Network admin is the `admin` role. Platform owner is `platform_admin`; the latter
can only be granted by the operator bootstrap, never a public signup or role selector.

## Hosting

Use the existing free Vercel team, Vite preset, `npm run verify` build command and
`dist` output. Set server-side `API_ORIGIN` to the HTTPS backend origin; the browser
uses the same-origin `/api` proxy. Do not set a company slug on the control-plane
app. GitHub Actions verifies Node 24 tests/build/audit on each push.

This testing deployment requires no live billing or external provider credentials.
