import { useEffect } from 'react';
import { useRouter } from 'next/router';

// This app is invite-only (see api/invite.ts) -- public self-signup was a
// leftover scaffold page that let anyone create an account with just an
// email/password, bypassing invites entirely. Redirect rather than delete
// the route outright in case anything still links here.
export default function SignUpPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/login');
  }, [router]);
  return null;
}
