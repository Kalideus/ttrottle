import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { Inter } from 'next/font/google';
import { AuthProvider } from '../context/AuthProvider';

// Brand wordmark font (self-hosted by next/font). Exposed as a CSS variable so
// only the "ttrottle" wordmark uses it; the rest of the UI keeps the system font.
const brandFont = Inter({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-brand' });

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={brandFont.variable}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#1E1F21" />
        <link rel="icon"type="image/svg+xml" href="/logo.svg" />
      </Head>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </div>
  );
}
