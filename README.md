# AutoReceipt

Receipt upload, extraction, review, and billing prototype built with Next.js + shadcn/ui.

## Stack

- Next.js App Router
- Drizzle ORM + PostgreSQL
- Better Auth (email/password + Google)
- Xendit subscriptions + recurring webhooks

## Setup

1. Copy env file:

```bash
cp .env.example .env.local
```

2. Install dependencies:

```bash
pnpm install
```

3. Generate and run migrations:

```bash
pnpm db:generate
pnpm db:migrate
```

4. Run dev server:

```bash
pnpm dev
```

## Auth & Billing Routes

- Auth API: `/api/auth/*`
- Xendit subscription checkout: `/api/billing/checkout`
- Xendit cancellation: `/api/billing/cancel`
- Xendit webhook: `/api/billing/webhook`
- Usage meter: `/api/billing/usage`

## Simulate Monthly Limit (Development)

1. Set `FREE_MONTHLY_RECEIPT_LIMIT=1` in `.env.local`.
2. Restart `pnpm dev`.
3. Upload one receipt (it should work).
4. Upload the next receipt (you should see the upgrade prompt).

Or use the Billing page buttons in development:
- `Simulate limit reached`
- `Reset monthly usage`

## Guest Trial

- Visitors can analyze up to `GUEST_FREE_RECEIPT_LIMIT` receipts without signing in.
- Guest quota is tracked via an httpOnly guest cookie and `.data/guest-usage.json`.
- Set `NEXT_PUBLIC_GUEST_FREE_RECEIPT_LIMIT` to control the hero banner copy.

## Receipt File Storage (Cloudflare R2)

- Saved receipt files are uploaded to Cloudflare R2 when these env vars are present:
  - `R2_ENDPOINT` (S3 endpoint origin only, e.g. `https://<accountid>.r2.cloudflarestorage.com`)
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET` (default: `receipts`)
- Set `R2_PUBLIC_BASE_URL` to your public bucket domain (recommended for direct `Open file` links).
- R2 is required for saving signed-in receipts. If R2 upload fails, the extraction request fails with an error.

## Receipt Metadata Storage

- Signed-in users: extracted receipt records are stored in PostgreSQL (`receipt` table).
- Guests: trial usage is tracked in `.data/guest-usage.json`.
