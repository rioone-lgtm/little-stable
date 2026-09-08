import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Little Stable | 小さな厩舎',
  description: '10頭の馬がのんびり暮らす、Three.jsの小さな3D箱庭。',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
