'use client';

import dynamic from 'next/dynamic';

const Viewer = dynamic(() => import('./viewer/Viewer'), { ssr: false });

export default function Page() {
  return (
    <main style={{ width: '100vw', height: '100vh' }}>
      <Viewer />
    </main>
  );
}
