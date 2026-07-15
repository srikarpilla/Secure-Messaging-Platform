'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useChatStore } from '@/store/chatStore';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import type { Message, Conversation } from '@/types';
import ConversationList from '@/components/ConversationList';
import ChatWindow from '@/components/ChatWindow';
import NewChatModal from '@/components/NewChatModal';
import NewGroupModal from '@/components/NewGroupModal';
import Avatar from '@/components/Avatar';

export default function ChatPage() {
  const router = useRouter();
  const {
    user,
    accessToken,
    clearAuth,
    conversations,
    activeConversationId,
    setActiveConversation,
    setConversations,
    upsertConversation,
    addMessage,
    updateMessageStatus,
    setTyping,
    setUserOnline,
    apiFetch,
  } = useChatStore();

  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Auth guard
  useEffect(() => {
    if (!user || !accessToken) {
      router.replace('/login');
    }
  }, [user, accessToken, router]);

  // Load conversations
  useEffect(() => {
    if (!user || !accessToken) return;
    apiFetch('/api/conversations/').then(async (res) => {
      if (res.ok) {
        const data: Conversation[] = await res.json();
        setConversations(data);
      }
    });
  }, [user, accessToken, apiFetch, setConversations]);

  // Socket connection
  useEffect(() => {
    if (!accessToken) return;

    const socket = connectSocket(accessToken);

    socket.on('message:new', (msg: Message) => {
      addMessage(msg);
      upsertConversation({
        ...conversations.find((c) => c.id === msg.conversation_id)!,
        last_message: msg,
        updated_at: msg.created_at,
      } as Conversation);
      // Re-fetch conversation to get accurate unread count
      apiFetch(`/api/conversations/${msg.conversation_id}`).then(async (res) => {
        if (res.ok) upsertConversation(await res.json());
      });
    });

    socket.on('message:status_update', (data: { conversation_id: number; message_id: number; user_id: number; status: string }) => {
      updateMessageStatus(data.conversation_id, data.message_id, data.user_id, data.status);
    });

    socket.on('typing:update', (data: { conversation_id: number; user_id: number; is_typing: boolean }) => {
      setTyping(data);
    });

    socket.on('presence:update', (data: { user_id: number; is_online: boolean }) => {
      setUserOnline(data.user_id, data.is_online);
    });

    socket.on('error', (data: { message: string }) => {
      showToast(`Error: ${data.message}`);
    });

    socket.on('disconnect', () => {
      showToast('Disconnected from server. Reconnecting…');
    });

    socket.on('connect', () => {
      showToast('Connected ✓');
    });

    return () => {
      socket.off('message:new');
      socket.off('message:status_update');
      socket.off('typing:update');
      socket.off('presence:update');
      socket.off('error');
      socket.off('disconnect');
      socket.off('connect');
    };
  }, [accessToken, addMessage, upsertConversation, updateMessageStatus, setTyping, setUserOnline, apiFetch, conversations]);

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    disconnectSocket();
    clearAuth();
    router.replace('/login');
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  if (!user) return null;

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        background: 'var(--signal-navy)',
        overflow: 'hidden',
      }}
    >
      {/* Narrow icon nav strip (Signal-style left rail) */}
      <NavRail onLogout={handleLogout} user={user} />

      {/* Conversation sidebar */}
      <ConversationList
        onNewChat={() => setShowNewChat(true)}
        onNewGroup={() => setShowNewGroup(true)}
      />

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeConversation ? (
          <ChatWindow conversation={activeConversation} />
        ) : (
          <EmptyState onNewChat={() => setShowNewChat(true)} onLogout={handleLogout} user={user} />
        )}
      </div>

      {/* Modals */}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onConversationCreated={(id) => {
            setActiveConversation(id);
            setShowNewChat(false);
          }}
        />
      )}
      {showNewGroup && (
        <NewGroupModal
          onClose={() => setShowNewGroup(false)}
          onConversationCreated={(id) => {
            setActiveConversation(id);
            setShowNewGroup(false);
          }}
        />
      )}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function EmptyState({ onNewChat, onLogout, user }: { onNewChat: () => void; onLogout: () => void; user: { display_name: string; username: string; avatar_url: string | null } }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        textAlign: 'center',
        position: 'relative',
      }}
    >
      {/* Logout button */}
      <button
        onClick={onLogout}
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          background: 'none',
          border: '1px solid var(--signal-border)',
          borderRadius: 8,
          padding: '6px 14px',
          color: 'var(--signal-muted)',
          cursor: 'pointer',
          fontSize: 13,
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLButtonElement).style.color = '#fca5a5';
          (e.target as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.4)';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLButtonElement).style.color = 'var(--signal-muted)';
          (e.target as HTMLButtonElement).style.borderColor = 'var(--signal-border)';
        }}
      >
        Sign out
      </button>

      {/* Logo */}
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #3a76f0 0%, #7c4dff 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 28,
          boxShadow: '0 20px 60px rgba(58,118,240,0.35)',
          animation: 'pulse-dot 3s ease-in-out infinite',
        }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
        </svg>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 10 }}>
        Welcome back, {user.display_name.split(' ')[0]}
      </h1>
      <p style={{ color: 'var(--signal-muted)', fontSize: 15, maxWidth: 360, lineHeight: 1.6, marginBottom: 32 }}>
        Select a conversation from the sidebar or start a new one. Messages are end-to-end encrypted.
      </p>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          className="signal-btn"
          onClick={onNewChat}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
          </svg>
          New Chat
        </button>
      </div>

      {/* Feature highlights */}
      <div style={{ display: 'flex', gap: 20, marginTop: 48, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { icon: '🔒', label: 'End-to-end encrypted' },
          { icon: '✓✓', label: 'Read receipts' },
          { icon: '👥', label: 'Group chats' },
          { icon: '📎', label: 'File sharing' },
        ].map((f) => (
          <div
            key={f.label}
            style={{
              padding: '10px 16px',
              background: 'var(--signal-sidebar)',
              border: '1px solid var(--signal-border)',
              borderRadius: 12,
              fontSize: 13,
              color: 'var(--signal-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>{f.icon}</span>
            {f.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Narrow left icon nav rail ─────────────────── */
function NavRailIcon({
  icon,
  label,
  active,
  comingSoon,
  onClick,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  comingSoon?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const [tooltip, setTooltip] = useState(false);

  const inner = (
    <div
      onClick={onClick}
      onMouseEnter={() => setTooltip(true)}
      onMouseLeave={() => setTooltip(false)}
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        background: active ? 'rgba(58,118,240,0.2)' : 'none',
        color: active ? 'var(--signal-blue)' : 'var(--signal-muted)',
        transition: 'all 0.15s',
        position: 'relative',
      }}
    >
      {icon}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: 52,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'var(--signal-panel)',
            border: '1px solid var(--signal-border)',
            borderRadius: 8,
            padding: '5px 10px',
            fontSize: 12,
            whiteSpace: 'nowrap',
            zIndex: 100,
            pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            color: 'var(--signal-text)',
          }}
        >
          {label}
          {comingSoon && (
            <span style={{ color: 'var(--signal-blue)', marginLeft: 6, fontSize: 10, fontWeight: 700 }}>SOON</span>
          )}
        </div>
      )}
    </div>
  );

  if (href) return <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link>;
  return inner;
}

function NavRail({
  onLogout,
  user,
}: {
  onLogout: () => void;
  user: { avatar_url: string | null; display_name: string };
}) {
  return (
    <div
      style={{
        width: 60,
        flexShrink: 0,
        background: 'var(--signal-sidebar)',
        borderRight: '1px solid var(--signal-border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 14,
        paddingBottom: 14,
        gap: 6,
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #3a76f0, #7c4dff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
        </svg>
      </div>

      {/* Chats */}
      <NavRailIcon
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>}
        label="Chats"
        active
      />

      {/* Calls — coming soon */}
      <NavRailIcon
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" /></svg>}
        label="Calls"
        comingSoon
      />

      {/* Stories — coming soon */}
      <NavRailIcon
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" /></svg>}
        label="Stories"
        comingSoon
      />

      <div style={{ flex: 1 }} />

      {/* Settings */}
      <NavRailIcon
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" /></svg>}
        label="Settings"
        href="/settings"
      />

      {/* Avatar / sign out */}
      <div
        onClick={onLogout}
        title="Sign out"
        style={{ cursor: 'pointer', marginTop: 8 }}
      >
        <Avatar url={user.avatar_url} name={user.display_name} size={32} />
      </div>
    </div>
  );
}
