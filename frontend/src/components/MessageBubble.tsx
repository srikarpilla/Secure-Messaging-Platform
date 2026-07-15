'use client';
import type { Message } from '@/types';
import { useChatStore } from '@/store/chatStore';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

interface Props {
  message: Message;
  isSent: boolean;
  showAvatar: boolean;
  isLastInGroup: boolean;
  onReply: (msg: Message) => void;
  onReact: (msg: Message) => void;
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function StatusTick({ statuses }: { statuses: Message['statuses'] }) {
  if (!statuses || statuses.length === 0) {
    return (
      <svg width="14" height="10" viewBox="0 0 16 12" fill="var(--signal-delivered)">
        <path d="M1 6l4 4 8-8" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    );
  }

  const allRead = statuses.every((s) => s.status === 'read');
  const allDelivered = statuses.every((s) => s.status === 'delivered' || s.status === 'read');
  const color = allRead ? 'var(--signal-read)' : 'var(--signal-delivered)';

  if (allDelivered || allRead) {
    // Double tick
    return (
      <svg width="18" height="12" viewBox="0 0 20 12" fill={color}>
        <path d="M1 6l4 4 8-8" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M6 6l4 4 8-8" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    );
  }

  // Single tick (sent)
  return (
    <svg width="14" height="10" viewBox="0 0 16 12" fill="var(--signal-delivered)">
      <path d="M1 6l4 4 8-8" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}

export default function MessageBubble({
  message,
  isSent,
  showAvatar,
  isLastInGroup,
  onReply,
  onReact,
}: Props) {
  const { user } = useChatStore();
  const [showActions, setShowActions] = useState(false);

  const bubbleClass = isSent
    ? isLastInGroup ? 'bubble-sent bubble-sent-tail' : 'bubble-sent'
    : isLastInGroup ? 'bubble-recv bubble-recv-tail' : 'bubble-recv';

  const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  if (message.is_deleted) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: isSent ? 'flex-end' : 'flex-start',
          marginBottom: 2,
          paddingLeft: isSent ? 0 : 44,
        }}
      >
        <span
          style={{
            fontSize: 13,
            color: 'var(--signal-muted)',
            fontStyle: 'italic',
            padding: '6px 12px',
            background: 'var(--signal-input-bg)',
            borderRadius: 12,
            border: '1px solid var(--signal-border)',
          }}
        >
          🚫 This message was deleted
        </span>
      </div>
    );
  }

  return (
    <div
      className="fade-in"
      style={{
        display: 'flex',
        flexDirection: isSent ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 8,
        marginBottom: isLastInGroup ? 12 : 2,
        paddingLeft: !isSent && !showAvatar ? 44 : 0,
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar (other user, last in group only) */}
      {!isSent && showAvatar && isLastInGroup && (
        <div style={{ flexShrink: 0 }}>
          <AvatarSmall user={message.sender} />
        </div>
      )}
      {!isSent && !isLastInGroup && <div style={{ width: 32 }} />}

      <div style={{ maxWidth: '65%', display: 'flex', flexDirection: 'column', alignItems: isSent ? 'flex-end' : 'flex-start' }}>
        {/* Sender name in group */}
        {!isSent && showAvatar && isLastInGroup && (
          <span style={{ fontSize: 11, color: 'var(--signal-blue)', fontWeight: 600, marginBottom: 3, paddingLeft: 4 }}>
            {message.sender?.display_name}
          </span>
        )}

        {/* Reply preview */}
        {message.reply_preview && (
          <div className="reply-strip" style={{ marginBottom: 4, maxWidth: '100%' }}>
            <div style={{ fontWeight: 600, color: 'var(--signal-blue)', fontSize: 11 }}>
              {message.reply_preview.sender_name}
            </div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {message.reply_preview.content || '📎 Attachment'}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: isSent ? 'row-reverse' : 'row' }}>
          {/* Bubble */}
          <div
            className={bubbleClass}
            style={{
              padding: '8px 12px',
              position: 'relative',
              wordBreak: 'break-word',
            }}
          >
            {/* Attachment */}
            {message.attachments?.length > 0 && (
              <div style={{ marginBottom: message.content ? 6 : 0 }}>
                {message.attachments.map((att) => {
                  const isImage = att.file_type?.startsWith('image/');
                  if (isImage) {
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={att.id}
                        src={att.file_url.startsWith('http') ? att.file_url : `${API}${att.file_url}`}
                        alt={att.file_name || 'image'}
                        style={{ maxWidth: 220, borderRadius: 8, display: 'block' }}
                      />
                    );
                  }
                  return (
                    <a
                      key={att.id}
                      href={att.file_url.startsWith('http') ? att.file_url : `${API}${att.file_url}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'inherit', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                    >
                      📎 {att.file_name || 'File'}
                    </a>
                  );
                })}
              </div>
            )}

            {/* Text */}
            {message.content && (
              <span style={{ fontSize: 14, lineHeight: 1.5 }}>{message.content}</span>
            )}

            {/* Timestamp + status */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 4,
                justifyContent: 'flex-end',
                opacity: 0.7,
              }}
            >
              {message.edited_at && (
                <span style={{ fontSize: 10 }}>edited</span>
              )}
              <span style={{ fontSize: 11 }}>{formatTime(message.created_at)}</span>
              {isSent && <StatusTick statuses={message.statuses} />}
            </div>
          </div>

          {/* Hover actions */}
          {showActions && (
            <div
              style={{
                display: 'flex',
                flexDirection: isSent ? 'row-reverse' : 'row',
                gap: 4,
                opacity: showActions ? 1 : 0,
                transition: 'opacity 0.15s',
              }}
            >
              <button
                onClick={() => onReply(message)}
                title="Reply"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--signal-input-bg)',
                  border: 'none',
                  color: 'var(--signal-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
                </svg>
              </button>
              <button
                onClick={() => onReact(message)}
                title="React"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--signal-input-bg)',
                  border: 'none',
                  color: 'var(--signal-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                }}
              >
                😊
              </button>
            </div>
          )}
        </div>

        {/* Reactions */}
        {message.reactions?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {Object.entries(
              message.reactions.reduce((acc: Record<string, number>, r) => {
                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                return acc;
              }, {})
            ).map(([emoji, count]) => (
              <span key={emoji} className="reaction-pill">
                {emoji} {count > 1 && count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Tiny inline avatar for message sender
function AvatarSmall({ user }: { user: Message['sender'] }) {
  if (!user) return <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--signal-input-bg)' }} />;
  const initials = user.display_name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['#3a76f0', '#7c4dff', '#f0503a', '#3af07c', '#f0c83a'];
  const color = colors[user.id % colors.length];
  const fullUrl = user.avatar_url
    ? (user.avatar_url.startsWith('http') ? user.avatar_url : `${API}${user.avatar_url}`)
    : null;

  return fullUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={fullUrl} alt={user.display_name} width={32} height={32} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
  ) : (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#fff' }}>
      {initials}
    </div>
  );
}

// React import needed for useState
import { useState } from 'react';
