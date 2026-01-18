import './globals.css';

export const metadata = {
  title: 'M3DView',
  description: 'Babylon GLB viewer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
