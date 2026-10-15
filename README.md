# RASI TEX - Wholesale & POS Billing

Independent React, Vite, and Supabase billing administration for RASI TEX.

## Local setup

1. Copy `.env.example` to `.env` and fill in your Supabase project URL, anon key, and service role key (see "Environment variables" below).
2. Apply the database migrations:
   - Run `npm run migrate:db <your_db_password>` OR paste `supabase/all_migrations_consolidated.sql` in your Supabase SQL Editor.
3. Sync store branding and categories:
   - Run `npm run sync:brand`
4. Run `npm install`.
5. Run `npm run dev`.

## Split payments (cash + QR)

POS bills, advance-order deposits and advance-order final payments can be paid with the **Split** option. Enter how much was
collected by cash and QR; the amounts must add up to the bill / deposit / final amount. The analytics dashboard shows
**Cash Collected**, **QR Collected** and **Card Collected** KPI cards that count split payments by their parts.
Advance-order split payments need migration `20260930_0023_split_payments.sql` (already included in
`supabase/all_migrations_consolidated.sql`). If your database already ran migrations 1-22, run only that file.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (scripts only - never expose in the browser, never commit) |
| `VITE_WHATSAPP_NUMBER` | Store WhatsApp number (`919080501232`) |
| `VITE_ADMIN_ID` / `VITE_ADMIN_PASSWORD` | Admin login credentials |
| `VITE_STAFF_ID` / `VITE_STAFF_PASSWORD` | Staff login credentials |
| `VITE_API_URL` | Optional API base URL |

## Brand Identity & Contact

- **Store Name:** RASI TEX
- **Owner:** Rafeekmohamed
- **Address:** 35, Kalaignar Nootrandu Vanika Valagam, Thanjai Salai, Thiruvarur - 610001
- **Phone / WhatsApp:** +91 9080501232 (E.164: 919080501232)
- **Email:** rasitexofficial@gmail.com
- **Instagram:** @rasitex_official (https://www.instagram.com/rasitex_official/)
- **GSTIN:** 33APAPR3524F1Z9

Brand values live in `src/lib/brand.ts`, `src/constants/business.ts` and `scripts/sync-universal-look.cjs`.

## Logo

The master logo is located in `public/rasi-logo.png`.
To regenerate PWA icons, favicons and the print/PDF logo (`src/lib/logoBase64.ts`), run `npm run generate:icons`.
