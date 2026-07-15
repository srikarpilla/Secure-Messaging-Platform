import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SignalChat — Secure Messaging',
  description:
    'A Signal-inspired real-time messaging application with end-to-end chat, group conversations, and read receipts.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
