'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/store/chatStore';
import Avatar from '@/components/Avatar';

type Tab = 'profile' | 'privacy' | 'notifications' | 'appearance' | 'linked' | 'calls' | 'stories';

const TABS: { id: Tab; label: string; icon: string; comingSoon?: boolean }[] = [
  { id: 'profile',       label: 'Profile',          icon: '👤' },
  { id: 'privacy',       label: 'Privacy',          icon: '🔒' },
  { id: 'notifications', label: 'Notifications',    icon: '🔔' },
  { id: 'appearance',    label: 'Appearance',       icon: '🎨' },
  { id: 'linked',        label: 'Linked Devices',   icon: '📱', comingSoon: true },
  { id: 'calls',         label: 'Calls',            icon: '📞', comingSoon: true },
  { id: 'stories',       label: 'Stories',          icon: '👁️', comingSoon: true },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useChatStore();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  if (!user) {
    if (typeof window !== 'undefined') router.replace('/login');
    return null;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--signal-navy)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          background: 'var(--signal-sidebar)',
          borderBottom: '1px solid var(--signal-border)',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <button
          onClick={() => router.push('/chat')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--signal-muted)',
            cursor: 'pointer',
            fontSize: 20,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            padding: 4,
            borderRadius: 6,
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.color = 'var(--signal-text)')}
          onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.color = 'var(--signal-muted)')}
          title="Back to chats"
        >
          ←
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Settings</h1>
      </div>

      <div style={{ display: 'flex', flex: 1, maxWidth: 900, margin: '0 auto', width: '100%', padding: '32px 24px', gap: 24 }}>
        {/* Sidebar nav */}
        <nav
          style={{
            width: 200,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 10,
                background: activeTab === tab.id ? 'rgba(58,118,240,0.15)' : 'none',
                border: 'none',
                color: activeTab === tab.id ? 'var(--signal-text)' : 'var(--signal-muted)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: activeTab === tab.id ? 600 : 400,
                fontFamily: 'inherit',
                textAlign: 'left',
                transition: 'all 0.15s',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--signal-hover)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--signal-text)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'none';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--signal-muted)';
                }
              }}
            >
              <span style={{ fontSize: 16 }}>{tab.icon}</span>
              {tab.label}
              {tab.comingSoon && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 9,
                    fontWeight: 700,
                    background: 'rgba(58,118,240,0.2)',
                    color: 'var(--signal-blue)',
                    padding: '2px 5px',
                    borderRadius: 4,
                    letterSpacing: '0.04em',
                  }}
                >
                  SOON
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Content panel */}
        <div
          style={{
            flex: 1,
            background: 'var(--signal-panel)',
            borderRadius: 16,
            border: '1px solid var(--signal-border)',
            padding: 28,
            minHeight: 480,
          }}
        >
          {activeTab === 'profile' && <ProfileTab user={user} />}
          {activeTab === 'privacy' && <PrivacyTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'appearance' && <AppearanceTab />}
          {(activeTab === 'linked' || activeTab === 'calls' || activeTab === 'stories') && (
            <ComingSoonTab tab={activeTab} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Profile Tab ─────────────────────────────── */
function ProfileTab({ user }: { user: { display_name: string; username: string; avatar_url: string | null } }) {
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>Profile</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
        <Avatar url={user.avatar_url} name={user.display_name} size={72} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{user.display_name}</div>
          <div style={{ color: 'var(--signal-muted)', fontSize: 14 }}>@{user.username}</div>
          <button
            style={{
              marginTop: 8,
              fontSize: 12,
              color: 'var(--signal-blue)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: 0,
            }}
          >
            Change photo
          </button>
        </div>
      </div>
      <SettingRow label="Display Name" value={user.display_name} editable />
      <SettingRow label="Username" value={`@${user.username}`} editable />
      <SettingRow label="About" value="Hey there! I'm using SignalChat." editable />
    </div>
  );
}

/* ─── Privacy Tab ─────────────────────────────── */
function PrivacyTab() {
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>Privacy</h2>
      <SectionLabel>Who can see my…</SectionLabel>
      <ToggleRow label="Last Seen & Online" value="Nobody" />
      <ToggleRow label="Profile Photo" value="My Contacts" />
      <ToggleRow label="About" value="My Contacts" />
      <ToggleRow label="Read Receipts" value="On" />
      <Divider />
      <SectionLabel>Messaging</SectionLabel>
      <ToggleRow label="Who can message me" value="Everyone" />
      <ToggleRow label="Who can add me to groups" value="My Contacts" />
      <Divider />
      <SectionLabel>Advanced</SectionLabel>
      <ToggleRow label="Two-Step Verification" value="Disabled" />
      <ToggleRow label="Blocked Contacts" value="0 blocked" />
    </div>
  );
}

/* ─── Notifications Tab ───────────────────────── */
function NotificationsTab() {
  const [msgNoti, setMsgNoti] = useState(true);
  const [groupNoti, setGroupNoti] = useState(true);
  const [sound, setSound] = useState(true);
  const [preview, setPreview] = useState(true);

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>Notifications</h2>
      <SectionLabel>Messages</SectionLabel>
      <SwitchRow label="Message notifications" checked={msgNoti} onChange={setMsgNoti} />
      <SwitchRow label="Show preview" checked={preview} onChange={setPreview} />
      <SwitchRow label="Notification sounds" checked={sound} onChange={setSound} />
      <Divider />
      <SectionLabel>Groups</SectionLabel>
      <SwitchRow label="Group notifications" checked={groupNoti} onChange={setGroupNoti} />
      <Divider />
      <SectionLabel>Do Not Disturb</SectionLabel>
      <ToggleRow label="DND Schedule" value="Off" />
    </div>
  );
}

/* ─── Appearance Tab ──────────────────────────── */
function AppearanceTab() {
  const [theme, setTheme] = useState<'dark' | 'darker'>('dark');
  const [fontSize, setFontSize] = useState('Medium');

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>Appearance</h2>
      <SectionLabel>Theme</SectionLabel>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {(['dark', 'darker'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: `1px solid ${theme === t ? 'var(--signal-blue)' : 'var(--signal-border)'}`,
              background: theme === t ? 'rgba(58,118,240,0.15)' : 'var(--signal-input-bg)',
              color: theme === t ? 'var(--signal-text)' : 'var(--signal-muted)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: theme === t ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            {t === 'dark' ? '🌙 Dark' : '⬛ Darker'}
          </button>
        ))}
      </div>
      <SectionLabel>Font Size</SectionLabel>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['Small', 'Medium', 'Large'].map((s) => (
          <button
            key={s}
            onClick={() => setFontSize(s)}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: `1px solid ${fontSize === s ? 'var(--signal-blue)' : 'var(--signal-border)'}`,
              background: fontSize === s ? 'rgba(58,118,240,0.15)' : 'var(--signal-input-bg)',
              color: fontSize === s ? 'var(--signal-text)' : 'var(--signal-muted)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: s === 'Small' ? 11 : s === 'Medium' ? 13 : 16,
              transition: 'all 0.15s',
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <SectionLabel>Chat Wallpaper</SectionLabel>
      <ToggleRow label="Background" value="Default (Navy)" />
      <ToggleRow label="Message bubbles" value="Signal Blue" />
    </div>
  );
}

/* ─── Coming Soon Tab ─────────────────────────── */
function ComingSoonTab({ tab }: { tab: Tab }) {
  const info: Record<string, { icon: string; title: string; desc: string }> = {
    linked: {
      icon: '📱',
      title: 'Linked Devices',
      desc: 'Link up to 5 additional devices to your Signal account. Access your messages from your phone, tablet, or desktop seamlessly.',
    },
    calls: {
      icon: '📞',
      title: 'Voice & Video Calls',
      desc: 'End-to-end encrypted voice and video calls. Make free calls to anyone on SignalChat, anywhere in the world.',
    },
    stories: {
      icon: '👁️',
      title: 'Stories',
      desc: 'Share photos, videos, and text updates that disappear after 24 hours. Only your contacts can see your stories.',
    },
  };
  const { icon, title, desc } = info[tab];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 400,
        textAlign: 'center',
        gap: 20,
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'var(--signal-input-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 36,
          border: '1px solid var(--signal-border)',
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{title}</div>
        <div style={{ color: 'var(--signal-muted)', fontSize: 14, maxWidth: 360, lineHeight: 1.7 }}>{desc}</div>
      </div>
      <span
        style={{
          padding: '8px 20px',
          borderRadius: 20,
          background: 'rgba(58,118,240,0.12)',
          border: '1px solid rgba(58,118,240,0.3)',
          color: 'var(--signal-blue)',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.04em',
        }}
      >
        Coming Soon
      </span>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────── */
function SettingRow({ label, value, editable }: { label: string; value: string; editable?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 0',
        borderBottom: '1px solid var(--signal-border)',
      }}
    >
      <div>
        <div style={{ fontSize: 13, color: 'var(--signal-muted)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14 }}>{value}</div>
      </div>
      {editable && (
        <button
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--signal-blue)',
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'inherit',
          }}
        >
          Edit
        </button>
      )}
    </div>
  );
}

function ToggleRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 0',
        borderBottom: '1px solid var(--signal-border)',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 14 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--signal-muted)' }}>{value}</span>
        <span style={{ color: 'var(--signal-muted)', fontSize: 16 }}>›</span>
      </div>
    </div>
  );
}

function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 0',
        borderBottom: '1px solid var(--signal-border)',
      }}
    >
      <div style={{ fontSize: 14 }}>{label}</div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          background: checked ? 'var(--signal-blue)' : 'var(--signal-input-bg)',
          border: `1px solid ${checked ? 'var(--signal-blue)' : 'var(--signal-border)'}`,
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 0.2s, border-color 0.2s',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 22 : 2,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}
        />
      </button>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--signal-blue)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 4,
        marginTop: 8,
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--signal-border)', margin: '16px 0 8px' }} />;
}
