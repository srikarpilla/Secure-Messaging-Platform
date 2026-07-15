'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '@/store/chatStore';
import { getSocket } from '@/lib/socket';
import type { Message, Conversation } from '@/types';
import MessageBubble from './MessageBubble';
import GroupInfoPanel from './GroupInfoPanel';
import Avatar from './Avatar';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');
const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface Props {
  conversation: Conversation;
}

export default function ChatWindow({ conversation }: Props) {
  const {
    user,
    messages,
    addMessage,
    setMessages,
    prependMessages,
    updateMessageStatus,
    typingUsers,
    replyTo,
    setReplyTo,
    apiFetch,
    onlineUsers,
  } = useChatStore();

  const convMessages = messages[conversation.id] || [];
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [reactTarget, setReactTarget] = useState<Message | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const otherParticipants =
    conversation.type === 'direct'
      ? conversation.participants.filter((p) => p.user_id !== user!.id)
      : [];

  const convName =
    conversation.type === 'group'
      ? conversation.name || 'Group'
      : otherParticipants[0]?.user?.display_name || 'Chat';

  const isOnline =
    conversation.type === 'direct' && otherParticipants[0]
      ? onlineUsers.has(otherParticipants[0].user_id)
      : false;

  const typingInConv = typingUsers.filter(
    (t) => t.conversation_id === conversation.id && t.user_id !== user!.id
  );

  // Load initial messages
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const res = await apiFetch(`/api/conversations/${conversation.id}/messages?limit=50`);
      if (res.ok && mounted) {
        const data: Message[] = await res.json();
        setMessages(conversation.id, data);
        setHasMore(data.length === 50);
        // Mark last message as read
        if (data.length > 0) {
          const socket = getSocket();
          socket?.emit('message:read', {
            conversation_id: conversation.id,
            message_id: data[data.length - 1].id,
          });
        }
      }
      if (mounted) setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, [conversation.id, apiFetch, setMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convMessages.length]);

  // Mark messages as read when they arrive
  useEffect(() => {
    if (convMessages.length > 0) {
      const last = convMessages[convMessages.length - 1];
      const socket = getSocket();
      socket?.emit('message:read', {
        conversation_id: conversation.id,
        message_id: last.id,
      });
    }
  }, [convMessages, conversation.id]);

  // Load more (infinite scroll)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || convMessages.length === 0) return;
    setLoadingMore(true);
    const firstId = convMessages[0].id;
    const res = await apiFetch(
      `/api/conversations/${conversation.id}/messages?before_id=${firstId}&limit=50`
    );
    if (res.ok) {
      const data: Message[] = await res.json();
      prependMessages(conversation.id, data);
      setHasMore(data.length === 50);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, convMessages, conversation.id, apiFetch, prependMessages]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (el && el.scrollTop < 80) loadMore();
  }, [loadMore]);

  // Typing indicator
  const handleTyping = () => {
    const socket = getSocket();
    socket?.emit('typing:start', { conversation_id: conversation.id });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket?.emit('typing:stop', { conversation_id: conversation.id });
    }, 2000);
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !replyTo) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit('message:send', {
      conversation_id: conversation.id,
      content: input.trim(),
      message_type: 'text',
      reply_to_message_id: replyTo?.id || null,
    });

    // Stop typing
    socket.emit('typing:stop', { conversation_id: conversation.id });
    if (typingTimer.current) clearTimeout(typingTimer.current);

    setInput('');
    setReplyTo(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);

    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API}/api/conversations/${conversation.id}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${useChatStore.getState().accessToken}` },
      body: formData,
    });

    if (res.ok) {
      const att = await res.json();
      const socket = getSocket();
      socket?.emit('message:send', {
        conversation_id: conversation.id,
        content: null,
        message_type: file.type.startsWith('image/') ? 'image' : 'file',
        attachment: att,
      });
    }
    setUploadLoading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleReact = async (msg: Message, emoji: string) => {
    setReactTarget(null);
    await apiFetch(`/api/conversations/${conversation.id}/messages/${msg.id}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
    // Refresh messages
    const res = await apiFetch(`/api/conversations/${conversation.id}/messages?limit=50`);
    if (res.ok) {
      const data: Message[] = await res.json();
      setMessages(conversation.id, data);
    }
  };

  // Group messages into consecutive groups
  const groupedMessages = convMessages.reduce<{ sender_id: number; messages: Message[] }[]>((acc, msg) => {
    const last = acc[acc.length - 1];
    if (last && last.sender_id === msg.sender_id) {
      last.messages.push(msg);
    } else {
      acc.push({ sender_id: msg.sender_id, messages: [msg] });
    }
    return acc;
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Header */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--signal-border)',
          background: 'var(--signal-sidebar)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Avatar
          url={
            conversation.type === 'group'
              ? conversation.avatar_url
              : otherParticipants[0]?.user?.avatar_url
          }
          name={convName}
          size={40}
          showOnline={conversation.type === 'direct'}
          isOnline={isOnline}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{convName}</div>
          <div style={{ fontSize: 12, color: 'var(--signal-muted)' }}>
            {conversation.type === 'group'
              ? `${conversation.participants.length} members`
              : isOnline
              ? '🟢 Online'
              : otherParticipants[0]?.user?.last_seen_at
              ? `Last seen ${new Date(otherParticipants[0].user.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Offline'}
          </div>
        </div>
        {conversation.type === 'group' && (
          <button
            onClick={() => setShowGroupInfo(true)}
            title="Group info"
            style={{
              background: 'none',
              border: '1px solid var(--signal-border)',
              borderRadius: 8,
              padding: '6px 10px',
              color: 'var(--signal-muted)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Info
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 20px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        {loadingMore && (
          <div style={{ textAlign: 'center', color: 'var(--signal-muted)', fontSize: 12, padding: 8 }}>
            Loading more…
          </div>
        )}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '20px 0' }}>
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="skeleton"
                style={{
                  height: 44,
                  width: `${Math.random() * 30 + 40}%`,
                  alignSelf: i % 2 === 0 ? 'flex-start' : 'flex-end',
                }}
              />
            ))}
          </div>
        ) : (
          groupedMessages.map((group) =>
            group.messages.map((msg, idx) => {
              const isSent = msg.sender_id === user!.id;
              const isLastInGroup = idx === group.messages.length - 1;
              const showAvatar = !isSent && conversation.type === 'group';
              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isSent={isSent}
                  showAvatar={showAvatar}
                  isLastInGroup={isLastInGroup}
                  onReply={setReplyTo}
                  onReact={setReactTarget}
                />
              );
            })
          )
        )}
        {typingInConv.length > 0 && (
          <div className="fade-in" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <span style={{ fontSize: 12, color: 'var(--signal-muted)' }}>
              {typingInConv.map((t) => {
                const p = conversation.participants.find((p) => p.user_id === t.user_id);
                return p?.user?.display_name || 'Someone';
              }).join(', ')}{' '}
              {typingInConv.length === 1 ? 'is' : 'are'} typing
            </span>
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply strip */}
      {replyTo && (
        <div
          style={{
            padding: '8px 20px',
            background: 'var(--signal-sidebar)',
            borderTop: '1px solid var(--signal-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div className="reply-strip" style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: 'var(--signal-blue)', fontSize: 11 }}>
              {replyTo.sender?.display_name}
            </div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
              {replyTo.content || '📎 Attachment'}
            </div>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            style={{ background: 'none', border: 'none', color: 'var(--signal-muted)', cursor: 'pointer', fontSize: 18 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Compose */}
      <form
        onSubmit={sendMessage}
        style={{
          padding: '12px 20px',
          background: 'var(--signal-sidebar)',
          borderTop: '1px solid var(--signal-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploadLoading}
          title="Attach file"
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'none',
            border: '1px solid var(--signal-border)',
            color: 'var(--signal-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {uploadLoading ? (
            <span style={{ fontSize: 14 }}>⏳</span>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" />
            </svg>
          )}
        </button>
        <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFileUpload} />

        <input
          className="signal-input"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            handleTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Message…"
          style={{ flex: 1, paddingTop: 10, paddingBottom: 10 }}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: input.trim() ? 'var(--signal-blue)' : 'var(--signal-input-bg)',
            border: 'none',
            color: input.trim() ? '#fff' : 'var(--signal-muted)',
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s, color 0.2s',
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>

      {/* Emoji reaction picker */}
      {reactTarget && (
        <div className="modal-overlay" onClick={() => setReactTarget(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--signal-panel)',
              borderRadius: 16,
              padding: '16px 20px',
              border: '1px solid var(--signal-border)',
              display: 'flex',
              gap: 12,
              fontSize: 28,
            }}
          >
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => handleReact(reactTarget, e)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 28,
                  padding: 4,
                  borderRadius: 8,
                  transition: 'transform 0.1s',
                }}
                onMouseEnter={(ev) => ((ev.target as HTMLButtonElement).style.transform = 'scale(1.3)')}
                onMouseLeave={(ev) => ((ev.target as HTMLButtonElement).style.transform = 'scale(1)')}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Group info panel */}
      {showGroupInfo && (
        <GroupInfoPanel conversation={conversation} onClose={() => setShowGroupInfo(false)} />
      )}
    </div>
  );
}
