'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/store/chatStore';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');

type Step = 'register' | 'verify';

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useChatStore();
  const [step, setStep] = useState<Step>('register');
  const [userId, setUserId] = useState<number | null>(null);
  const [otp, setOtp] = useState('');
  const [mockOtp, setMockOtp] = useState('');
  const [form, setForm] = useState({
    phone_number: '',
    username: '',
    display_name: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }
      setUserId(data.user_id);
      setMockOtp(data.otp); // mocked — shown directly in UI
      setStep('verify');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'OTP verification failed');
        return;
      }
      setAuth(data.user, data.access_token, data.refresh_token);
      router.push('/chat');
    } catch {
      setError('Network error');
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
      <div style={{ width: '100%', maxWidth: 420 }}>
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
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
            {step === 'register' ? 'Create account' : 'Verify your number'}
          </h1>
          <p style={{ color: 'var(--signal-muted)', fontSize: 14 }}>
            {step === 'register'
              ? 'Join SignalChat — it only takes a minute'
              : 'Enter the OTP sent to your phone'}
          </p>
        </div>

        <div
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

          {step === 'register' ? (
            <form onSubmit={handleRegister}>
              {(['phone_number', 'username', 'display_name', 'password'] as const).map((field) => (
                <div key={field} style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 13,
                      fontWeight: 500,
                      marginBottom: 6,
                      color: 'var(--signal-muted)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {field.replace('_', ' ')}
                  </label>
                  <input
                    className="signal-input"
                    type={field === 'password' ? 'password' : 'text'}
                    value={form[field]}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    placeholder={
                      field === 'phone_number'
                        ? '+91XXXXXXXXXX'
                        : field === 'username'
                        ? 'yourname'
                        : field === 'display_name'
                        ? 'Your Name'
                        : '••••••••'
                    }
                    required={field !== 'password'}
                  />
                </div>
              ))}
              <button className="signal-btn" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
                {loading ? 'Sending OTP…' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify}>
              {mockOtp && (
                <div
                  style={{
                    background: 'rgba(74,222,128,0.1)',
                    border: '1px solid rgba(74,222,128,0.3)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    color: '#86efac',
                    fontSize: 13,
                    marginBottom: 20,
                    textAlign: 'center',
                  }}
                >
                  <strong>Mock OTP:</strong>{' '}
                  <span style={{ fontFamily: 'monospace', fontSize: 20, letterSpacing: 4 }}>
                    {mockOtp}
                  </span>
                </div>
              )}
              <div style={{ marginBottom: 24 }}>
                <label
                  style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--signal-muted)' }}
                >
                  Enter OTP
                </label>
                <input
                  className="signal-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  style={{ letterSpacing: 8, fontSize: 22, textAlign: 'center' }}
                  required
                  autoFocus
                />
              </div>
              <button className="signal-btn" type="submit" disabled={loading} style={{ width: '100%' }}>
                {loading ? 'Verifying…' : 'Verify & Sign in'}
              </button>
              <button
                type="button"
                onClick={() => setStep('register')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--signal-muted)',
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'block',
                  margin: '12px auto 0',
                  textDecoration: 'underline',
                }}
              >
                ← Back
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--signal-muted)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--signal-blue)', textDecoration: 'none', fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
