'use client';
import { useState, useEffect } from 'react';
import { useChatStore } from '@/store/chatStore';
import type { User } from '@/types';
import Avatar from './Avatar';

interface Props {
  onClose: () => void;
  onConversationCreated: (convId: number) => void;
}

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export default function NewChatModal({ onClose, onConversationCreated }: Props) {
  const { apiFetch, upsertConversation, user } = useChatStore();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      const res = await apiFetch(`/api/users/search?q=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data: User[] = await res.json();
        setResults(data.filter((u) => u.id !== user!.id));
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, apiFetch, user]);

  const startChat = async (targetUser: User) => {
    const res = await apiFetch('/api/conversations/', {
      method: 'POST',
      body: JSON.stringify({ type: 'direct', participant_ids: [targetUser.id] }),
    });
    if (res.ok) {
      const conv = await res.json();
      upsertConversation(conv);
      onConversationCreated(conv.id);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>New Chat</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--signal-muted)', cursor: 'pointer', fontSize: 20 }}
          >
            ✕
          </button>
        </div>

        <input
          className="signal-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users by name or username…"
          autoFocus
          style={{ marginBottom: 16 }}
        />

        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {loading && (
            <div style={{ color: 'var(--signal-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
              Searching…
            </div>
          )}
          {!loading && results.length === 0 && search.trim() && (
            <div style={{ color: 'var(--signal-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
              No users found
            </div>
          )}
          {results.map((u) => (
            <div
              key={u.id}
              className="conv-row"
              onClick={() => startChat(u)}
            >
              <Avatar url={u.avatar_url} name={u.display_name} size={44} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{u.display_name}</div>
                <div style={{ fontSize: 12, color: 'var(--signal-muted)' }}>@{u.username}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
