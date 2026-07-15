'use client';
import { useState } from 'react';
import { useChatStore } from '@/store/chatStore';
import type { Conversation } from '@/types';
import Avatar from './Avatar';

interface Props {
  onNewChat: () => void;
  onNewGroup: () => void;
}

function formatTime(ts: string | null | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getConvName(conv: Conversation, currentUserId: number): string {
  if (conv.type === 'group') return conv.name || 'Group';
  const other = conv.participants.find((p) => p.user_id !== currentUserId);
  return other?.user?.display_name || 'Unknown';
}

function getConvAvatar(conv: Conversation, currentUserId: number): { url: string | null; name: string } {
  if (conv.type === 'group') return { url: conv.avatar_url, name: conv.name || 'Group' };
  const other = conv.participants.find((p) => p.user_id !== currentUserId);
  return { url: other?.user?.avatar_url || null, name: other?.user?.display_name || '?' };
}

export default function ConversationList({ onNewChat, onNewGroup }: Props) {
  const { conversations, activeConversationId, setActiveConversation, user, onlineUsers, typingUsers } =
    useChatStore();
  const [search, setSearch] = useState('');

  const filtered = conversations.filter((c) => {
    const name = getConvName(c, user!.id).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <aside
      style={{
        width: 340,
        flexShrink: 0,
        background: 'var(--signal-sidebar)',
        borderRight: '1px solid var(--signal-border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 16px 12px',
          borderBottom: '1px solid var(--signal-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar url={user?.avatar_url} name={user?.display_name || '?'} size={36} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{user?.display_name}</div>
              <div style={{ fontSize: 12, color: 'var(--signal-muted)' }}>@{user?.username}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={onNewChat}
              title="New Chat"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'none',
                border: '1px solid var(--signal-border)',
                color: 'var(--signal-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.background = 'var(--signal-hover)';
                (e.target as HTMLButtonElement).style.color = 'var(--signal-text)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.background = 'none';
                (e.target as HTMLButtonElement).style.color = 'var(--signal-muted)';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
              </svg>
            </button>
            <button
              onClick={onNewGroup}
              title="New Group"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'none',
                border: '1px solid var(--signal-border)',
                color: 'var(--signal-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.background = 'var(--signal-hover)';
                (e.target as HTMLButtonElement).style.color = 'var(--signal-text)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.background = 'none';
                (e.target as HTMLButtonElement).style.color = 'var(--signal-muted)';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="var(--signal-muted)"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
          >
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            className="signal-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            style={{ paddingLeft: 34, paddingTop: 8, paddingBottom: 8 }}
          />
        </div>
      </div>

      {/* Conversation list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--signal-muted)', fontSize: 13, marginTop: 40 }}>
            {search ? 'No results' : 'No conversations yet'}
          </div>
        )}
        {filtered.map((conv) => {
          const name = getConvName(conv, user!.id);
          const avatarInfo = getConvAvatar(conv, user!.id);
          const isActive = conv.id === activeConversationId;
          const lastMsg = conv.last_message;
          const otherUserId =
            conv.type === 'direct'
              ? conv.participants.find((p) => p.user_id !== user!.id)?.user_id
              : undefined;
          const isOnline = otherUserId ? onlineUsers.has(otherUserId) : false;
          const typing = typingUsers.find(
            (t) => t.conversation_id === conv.id && t.user_id !== user!.id
          );

          return (
            <div
              key={conv.id}
              className={`conv-row${isActive ? ' active' : ''}`}
              onClick={() => setActiveConversation(conv.id)}
            >
              <div style={{ position: 'relative' }}>
                <Avatar
                  url={avatarInfo.url}
                  name={avatarInfo.name}
                  size={48}
                  showOnline={conv.type === 'direct'}
                  isOnline={isOnline}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{name}</span>
                  <span style={{ fontSize: 11, color: 'var(--signal-muted)', flexShrink: 0, marginLeft: 8 }}>
                    {formatTime(conv.last_message?.created_at || conv.updated_at)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                  <span
                    style={{
                      fontSize: 13,
                      color: typing ? 'var(--signal-blue)' : 'var(--signal-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 180,
                    }}
                  >
                    {typing ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        typing…
                      </span>
                    ) : lastMsg?.is_deleted ? (
                      <em style={{ color: 'var(--signal-muted)' }}>This message was deleted</em>
                    ) : lastMsg?.content ? (
                      lastMsg.content
                    ) : lastMsg?.attachments?.length ? (
                      '📎 Attachment'
                    ) : (
                      ''
                    )}
                  </span>
                  {conv.unread_count > 0 && (
                    <span className="unread-badge">{conv.unread_count > 99 ? '99+' : conv.unread_count}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
