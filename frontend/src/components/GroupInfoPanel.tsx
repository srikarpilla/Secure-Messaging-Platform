'use client';
import { useState } from 'react';
import { useChatStore } from '@/store/chatStore';
import type { Conversation } from '@/types';
import Avatar from './Avatar';

interface Props {
  conversation: Conversation;
  onClose: () => void;
}

export default function GroupInfoPanel({ conversation, onClose }: Props) {
  const { user, apiFetch, upsertConversation } = useChatStore();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: number; display_name: string; username: string; avatar_url: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  const currentUserRole = conversation.participants.find((p) => p.user_id === user!.id)?.role;
  const isAdmin = currentUserRole === 'admin';

  const searchUsers = async (q: string) => {
    setSearch(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setLoading(true);
    const res = await apiFetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      const existingIds = conversation.participants.map((p) => p.user_id);
      setSearchResults(data.filter((u: { id: number }) => !existingIds.includes(u.id)));
    }
    setLoading(false);
  };

  const addMember = async (userId: number) => {
    const res = await apiFetch(`/api/conversations/${conversation.id}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
    if (res.ok) {
      const refreshed = await apiFetch(`/api/conversations/${conversation.id}`);
      if (refreshed.ok) {
        upsertConversation(await refreshed.json());
      }
      setSearch('');
      setSearchResults([]);
    }
  };

  const removeMember = async (userId: number) => {
    setRemoving(userId);
    const res = await apiFetch(`/api/conversations/${conversation.id}/members/${userId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      const refreshed = await apiFetch(`/api/conversations/${conversation.id}`);
      if (refreshed.ok) {
        upsertConversation(await refreshed.json());
      }
    }
    setRemoving(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        style={{ width: 440, maxHeight: '80vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Group Info</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--signal-muted)', cursor: 'pointer', fontSize: 20 }}>
            ✕
          </button>
        </div>

        {/* Group avatar + name */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Avatar
            url={conversation.avatar_url}
            name={conversation.name || 'Group'}
            size={72}
          />
          <div style={{ marginTop: 12, fontWeight: 700, fontSize: 18 }}>{conversation.name}</div>
          <div style={{ fontSize: 13, color: 'var(--signal-muted)', marginTop: 4 }}>
            {conversation.participants.length} members
          </div>
        </div>

        {/* Participants */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--signal-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            Members
          </div>
          {conversation.participants.map((p) => (
            <div
              key={p.user_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 0',
                borderBottom: '1px solid var(--signal-border)',
              }}
            >
              <Avatar url={p.user?.avatar_url} name={p.user?.display_name || '?'} size={38} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {p.user?.display_name}
                  {p.user_id === user!.id && <span style={{ color: 'var(--signal-muted)', fontWeight: 400 }}> (you)</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--signal-muted)' }}>@{p.user?.username}</div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: p.role === 'admin' ? 'rgba(58,118,240,0.2)' : 'var(--signal-input-bg)',
                  color: p.role === 'admin' ? 'var(--signal-blue)' : 'var(--signal-muted)',
                  fontWeight: 600,
                  border: `1px solid ${p.role === 'admin' ? 'rgba(58,118,240,0.4)' : 'var(--signal-border)'}`,
                }}
              >
                {p.role}
              </span>
              {isAdmin && p.user_id !== user!.id && (
                <button
                  onClick={() => removeMember(p.user_id)}
                  disabled={removing === p.user_id}
                  style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 6,
                    color: '#fca5a5',
                    fontSize: 12,
                    padding: '3px 8px',
                    cursor: 'pointer',
                  }}
                >
                  {removing === p.user_id ? '…' : 'Remove'}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add member (admin only) */}
        {isAdmin && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--signal-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Add Member
            </div>
            <input
              className="signal-input"
              value={search}
              onChange={(e) => searchUsers(e.target.value)}
              placeholder="Search users to add…"
              style={{ marginBottom: 8 }}
            />
            {loading && <div style={{ fontSize: 13, color: 'var(--signal-muted)', textAlign: 'center' }}>Searching…</div>}
            {searchResults.map((u) => (
              <div
                key={u.id}
                className="conv-row"
                onClick={() => addMember(u.id)}
              >
                <Avatar url={u.avatar_url} name={u.display_name} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{u.display_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--signal-muted)' }}>@{u.username}</div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--signal-blue)' }}>+ Add</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
