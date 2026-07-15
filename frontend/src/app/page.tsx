'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/store/chatStore';

export default function Home() {
  const router = useRouter();
  const { user, accessToken } = useChatStore();

  useEffect(() => {
    if (user && accessToken) {
      router.replace('/chat');
    } else {
      router.replace('/login');
    }
  }, [user, accessToken, router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--signal-navy)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--signal-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
        </div>
        <p style={{ color: 'var(--signal-muted)', fontSize: 14 }}>Loading…</p>
      </div>
    </div>
  );
}
