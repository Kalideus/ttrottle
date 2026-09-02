# Implementation Checklist — ttrottle

Phase 1 — Initial setup

- [ ] Create repository and basic files (README, .gitignore)
- [ ] Scaffold Next.js + TypeScript app
- [ ] Add Tailwind CSS and shadcn/ui setup
- [ ] Initialize Supabase project & schema
- [ ] Add `lib/time.ts` helper for `Asia/Colombo` business date
- [ ] Create database migrations for core tables (`users`, `projects`, `tasks`, `task_recurrences`, etc.)

Phase 2 — Core features

- [ ] Authentication (Supabase Auth)
- [ ] Users CRUD (admin)
- [ ] Projects CRUD
- [ ] Tasks CRUD (L1/L2 hierarchy enforcement)
- [ ] Comments and attachments

Phase 3 — Recurrences

- [ ] `task_recurrences` schema and generator
- [ ] Cron endpoint and Vercel Cron setup
- [ ] Admin recurrence management and manual run

Phase 4 — Dashboard, search, filters

- [ ] Dashboard cards and links
- [ ] Search and filtering UI

Phase 5 — Polish and tests

- [ ] Tests, linting, type checking
- [ ] Deploy to Vercel + Supabase
