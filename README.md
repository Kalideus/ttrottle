# ttrottle

A task manager for a small, invite-only team: projects, tasks and subtasks, comments, an inbox of notifications, repeating tasks, locked due dates and CSV import.

Built with Next.js (pages router) and Supabase. The browser talks to Supabase directly, and the database's row-level security rules decide who can see what. A few server routes in `src/pages/api/` use the service-role key for invites, admin actions and the nightly purge.

## Run it locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in:

   | Variable | What it is |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | The Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The public key; either name works |
   | `SUPABASE_SERVICE_ROLE_KEY` | Server only. Needed for invites, `/admin/team` and the purge |
   | `CRON_SECRET` | Server only. The purge route refuses to run without it |

3. `npm run dev`, then open http://localhost:3000

`npm test` runs the unit tests in `lib/`. `npm run lint` runs ESLint.

## Database

The schema lives in `db/migrations/`. There is no migration tool: paste each file into the Supabase SQL editor, in number order. Most are safe to re-run and say so at the top.

Some things exist only in the live database and not in this folder: the `profiles` table, the trigger that creates a profile on sign-up, and the `get_comment_counts` function.

## Things to know

- **Sign-up is by invite.** A project's owner or manager invites people from the project header; super admins can invite to any project from `/admin/team`.
- **Roles.** Per project: owner, manager (`admin` in the database) and member. Site-wide: `is_super_admin` and `can_create_projects` on `profiles`, set from `/admin/team`.
- **Deleting a task is a soft delete.** Super admins restore tasks at `/admin/deleted-tasks`. `vercel.json` schedules `/api/cron/purge-deleted-tasks` nightly, which removes tasks deleted more than 90 days ago for good, along with their photos. The same run removes the photos (not the task) of tasks completed more than 180 days ago.
- **Deleting a project is permanent** and takes its tasks and comments with it.
