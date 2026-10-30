# Family Birthdays

React + Vite + Supabase, deployed on Cloudflare Workers. One codebase, two deployments.

| | Family (private) | Public |
|---|---|---|
| Build / deploy | `npm run build` / `npm run deploy` | `npm run build:public` / `npm run deploy:public` |
| Mode | `family` (default) | `public` (`--mode public`, see `.env.public`) |
| Cloudflare Worker | `family-birthdays` | `family-birthdays-public` |
| Supabase env file | `.env.local` | `.env.public.local` |
| SQL to run | `0001`, `0003` | `0001`, `0002`, `0003` |
| New user without a family | must use an invite code | creates their own family, or joins with a code |

Use **separate Supabase projects**. The public one never holds family data, and `create_family` (`0002`) never exists on the private one.

## Who can do what
- Every member sees all of their family's birthdays, and nothing from other families.
- A member can add birthdays, and edit or delete only the ones they added. The owner can edit or delete any of them.
- The owner creates invite links and sees or revokes active codes in **Family**. The owner can also remove members there.
- A member can leave from **Family**. The owner can't leave.

These rules live in the database (RLS + RPCs). `npm test` checks them against the real migration SQL in an in-process Postgres (`supabase/tests/rls.test.ts`).

## Supabase settings (both projects)
- Auth → URL Configuration: set the deployed URL as Site URL and add it to the redirect URLs.
- Auth → Providers: enable Email (and Google if wanted). With "Confirm email" on, sign-up shows a "check your email" screen.

## Dev
- Copy `.env.example` to `.env.local` (and `.env.public.local` for the public project).
- `npm run dev` runs family mode, `npm run dev:public` public mode.
- `npm test` and `npm run lint` for checks.
