# Paystack Payment Integration

This document explains how the Studdyhub payment system works using **Paystack** and
points to the code that implements it. If you're building a new payment flow or
want to understand the existing one, read this guide while looking at
`supabase/functions/paystack-webhook/index.ts` and the database schema.

---

## 1. Architecture overview

1. The client or server creates a **Paystack subscription** or **charge** using the
   Paystack REST API.  (This step is not implemented in the repository; it lives
   in whatever piece of code sets up a checkout widget in the frontend.)
2. Paystack sends webhook events to a Supabase Edge Function (`paystack-webhook`).
3. The webhook handler verifies the signature and then updates the
   `subscriptions` table inside Supabase.
4. Application code reads the `subscriptions` row for the logged‑in user to
   determine access/plan.

All payment state is persisted in the `subscriptions` table and is kept in
synchrony with Paystack via the webhook; there is no polling or client‑side
state stored elsewhere.

---

## 2. Database schema

The relevant table is defined in the migration files and visible in
`supabase/functions/gemini-chat/db_schema.ts` (see section “subscriptions”).

```sql
-- simplified representation
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  plan_type text,           -- "genius" or "scholar"
  status text,              -- active | past_due | cancelled
  current_period_end timestamp,
  paystack_sub_code text,   -- Paystack subscription reference or charge ref
  paystack_customer_code text,
  created_at timestamp,
  updated_at timestamp
);
```

Row‑level security policies permit users to `SELECT` only their own row;
writes are done by **security‑definer** RPCs or the webhook function.

Fields `paystack_sub_code`/`paystack_customer_code` store identifiers returned
by Paystack so we can correlate incoming events with our records.

---

## 3. Supabase Edge Function: `paystack-webhook`

Location: `supabase/functions/paystack-webhook/index.ts`.
This is a standard Deno HTTP server created by `serve()`.

### Required environment variables

- `PAYSTACK_SECRET_KEY` – your Paystack secret key used to verify webhook
  signatures (HMAC‑SHA512).
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` – used by the function to
  connect to the database with elevated privileges.

The function returns `500` if the Paystack key is missing or an error occurs.

### Event handling logic

The switch statement dispatches on `event.event` from Paystack.

- **`subscription.create`** – new recurring subscription has been created. The
  handler:
  1. derives `planType` by inspecting `plan.name` (contains "genius" or
     else defaults to "scholar").
  2. looks up the user by email via `supabase.auth.admin.listUsers()`;
  3. `upsert()`s a subscriptions row with `status` active or past_due and sets
     `current_period_end` to 30 days in the future (Paystack does not provide
     the next‑billing date so we approximate).

- **`subscription.disable` / `subscription.not_renew`** – user cancelled their
  subscription. The row matching the Paystack subscription code is updated to
  `{ status: 'cancelled' }`.

- **`charge.success`** – one‑time payment succeeded (usually used for promo or
  manual charges). If the payload contains `metadata.plan_type`, the same
  `upsert()` logic as above is applied and the reference is saved.

- **`invoice.payment_failed`** – recurring invoice failed; the matching row is
  updated to `{ status: 'past_due' }`.

Unhandled event types are ignored, but the function always returns `200` with
`{ received: true }` on success.

### Signature verification

Paystack sends an `x-paystack-signature` header. The function computes an
HMAC‑SHA512 of the raw request body using `PAYSTACK_SECRET_KEY` and compares
hex digest strings. If they don't match, the request is rejected with status
`401`.

### CORS

The function allows `*` origin and includes `x-paystack-signature` in the
allowed headers list. This is mainly relevant if you ever test the webhook from
a browser (but Paystack itself posts from server‑side).

### Error logging

Any exception is caught and logged to `system_error_logs` via the shared
`logSystemError` helper. The function still responds with `500` to Paystack so
an error will trigger a retry according to Paystack policies.

---

## 4. Deploying the webhook function

1. Add the function to your Supabase project in `supabase/config.toml` if not
   already present:
   ```toml
   [functions.paystack-webhook]
   path = "supabase/functions/paystack-webhook"
   ```
2. Set the environment variable `PAYSTACK_SECRET_KEY` in your Supabase
   dashboard (or via CLI) alongside the standard `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY`.
3. Deploy with `supabase functions deploy paystack-webhook`.
4. Note the generated URL – you will configure this in Paystack.

---

## 5. Configuring Paystack

1. In the Paystack dashboard, go to **Settings → Developer → Webhooks**.
2. Set the webhook URL to the function endpoint URL obtained above.
3. Subscribe to these events:
   - `subscription.create`
   - `subscription.disable`
   - `subscription.not_renew`
   - `charge.success`
   - `invoice.payment_failed`
4. Ensure the webhook signing secret there matches the `PAYSTACK_SECRET_KEY`
   stored in your environment variables.

During development you can use Paystack’s CLI (`paystack trigger`) or the
`ngrok`-style forwarding feature to test events locally.

---

## 6. Creating a subscription from your application

While the repository contains no example, your frontend/server should:

1. Call Paystack’s **Create Subscription** API (https://paystack.com/docs/api/
   subscription#create) or **Initialize Transaction** API for one‑time charges.
2. Include the customer’s email and, if relevant, `metadata.plan_type` set to
   `'genius'` or `'scholar'` depending on which plan the user chose.  This makes
   it easier for the webhook to know which plan the payment refers to.
3. Save the returned `subscription_code` or `reference` in your local state if
   you need to link to it before the webhook arrives, but the webhook is the
   source of truth for the subscription row.

Example metadata payload:

```json
{
  "plan_type": "genius"
}
```

For recurring billing, you normally create a Paystack plan and then create the
subscription using that plan’s code.

---

## 7. Reading subscription state in the app

Client code can query the `subscriptions` table (or use a custom RPC that joins
plan details) to check the logged‑in user’s current `status` and
`current_period_end`.  Because of row‑level security the user may only read
their own record.

The TypeScript type is defined in `src/types/Subscription.ts`:

```ts
export interface Subscription {
  id: string;
  user_id: string;
  plan_type: string;
  status: string;
  current_period_end: string;
  paystackSubCode: string | null;
  paystackCustomerCode: string | null;
}
```

---

## 8. Troubleshooting & Tips

- **Signature mismatches**: ensure the webhook secret is identical in Paystack
  and your env var; do not URL‑encode it.
- **Missing users**: the webhook looks up users by email via the Admin API.  If
  you create users with a different email than the one used to purchase, the
  row will not be created.
- **Testing events**: use the `paystack` CLI or send a manual POST with a
  computed signature to mimic Paystack.
- **Extending**: you can add additional event cases (e.g. `subscription.update`
  or `transfer.success`) depending on your business needs.

---

With the information above and by studying
`supabase/functions/paystack-webhook/index.ts`, a developer should be able to
mirror the Paystack integration in another project or modify it for new
payment providers.
