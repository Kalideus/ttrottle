import type { GetServerSideProps } from 'next';

// `/` has no content of its own — send visitors to the real app shell.
// (This used to render a hardcoded Asana-styled mockup with fake portfolio
// data; TukTukRental's task manager is meant to replace that tool, not
// imitate it, and the mockup had no working link into the real app.)
export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: '/app',
      permanent: false,
    },
  };
};

export default function Home() {
  return null;
}
