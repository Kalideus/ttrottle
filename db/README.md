# Database

This folder contains SQL migrations for the ttrottle application.

Apply migrations using `psql` or your preferred migration tool. Example using `psql`:

```bash
p sql -f db/migrations/001_init.sql
```

When deploying to Supabase prefer the Supabase migration tooling or run these statements in the SQL editor.
