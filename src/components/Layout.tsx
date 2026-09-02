import Link from 'next/link';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header style={{ padding: 12, borderBottom: '1px solid #eee' }}>
        <Link href="/">ttrottle</Link> — <Link href="/login">Login</Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
