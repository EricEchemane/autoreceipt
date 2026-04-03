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
