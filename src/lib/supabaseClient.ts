import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  // In dev this is expected to be filled; keep code robust in case env is missing
  console.warn('Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
}

// Use the cookie-backed browser client (@supabase/ssr) rather than the plain
// @supabase/supabase-js client, whose default localStorage-based session is
// invisible to the server and to any other client instance created via
// `createBrowserClient` (e.g. lib/supabase/client.ts, used by the login page).
// A separate storage mechanism here meant this client never observed a
// session established by signInWithPassword() elsewhere in the app.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;
