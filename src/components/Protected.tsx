import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthProvider';

export default function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user === null) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!user) return <div style={{ padding: 24 }}>Redirecting to login…</div>;

  return <>{children}</>;
}
