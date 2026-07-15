'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/store/chatStore';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useChatStore();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      setAuth(data.user, data.access_token, data.refresh_token);
      router.push('/chat');
    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--signal-navy)',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3a76f0, #7c4dff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 8px 32px rgba(58,118,240,0.4)',
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Welcome back</h1>
          <p style={{ color: 'var(--signal-muted)', fontSize: 14 }}>Sign in to SignalChat</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleLogin}
          style={{
            background: 'var(--signal-panel)',
            borderRadius: 20,
            padding: 28,
            border: '1px solid var(--signal-border)',
          }}
        >
          {error && (
            <div
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: 10,
                padding: '10px 14px',
                color: '#fca5a5',
                fontSize: 13,
                marginBottom: 20,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label
              style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--signal-muted)' }}
            >
              Phone number or username
            </label>
            <input
              className="signal-input"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="+91... or alice"
              required
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--signal-muted)' }}
            >
              Password
            </label>
            <input
              className="signal-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button className="signal-btn" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          {/* Demo hint */}
          <div
            style={{
              marginTop: 20,
              padding: '12px 14px',
              background: 'rgba(58,118,240,0.1)',
              borderRadius: 10,
              fontSize: 12,
              color: 'var(--signal-muted)',
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: 'var(--signal-text)' }}>Demo accounts</strong> (password: <code>password123</code>)
            <br />
            alice · bob · charlie · diana · eve
          </div>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--signal-muted)' }}>
          No account?{' '}
          <Link href="/register" style={{ color: 'var(--signal-blue)', textDecoration: 'none', fontWeight: 600 }}>
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
