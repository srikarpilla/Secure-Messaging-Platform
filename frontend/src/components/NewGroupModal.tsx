'use client';
import { useState, useEffect } from 'react';
import { useChatStore } from '@/store/chatStore';
import type { User } from '@/types';
import Avatar from './Avatar';

interface Props {
  onClose: () => void;
  onConversationCreated: (convId: number) => void;
}

export default function NewGroupModal({ onClose, onConversationCreated }: Props) {
  const { apiFetch, upsertConversation, user } = useChatStore();
  const [groupName, setGroupName] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await apiFetch(`/api/users/search?q=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data: User[] = await res.json();
        setResults(data.filter((u) => u.id !== user!.id));
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search, apiFetch, user]);

  const toggle = (u: User) => {
    setSelected((prev) =>
      prev.find((s) => s.id === u.id) ? prev.filter((s) => s.id !== u.id) : [...prev, u]
    );
  };

  const create = async () => {
    if (!groupName.trim() || selected.length < 1) return;
    setCreating(true);
    const res = await apiFetch('/api/conversations/', {
      method: 'POST',
      body: JSON.stringify({
        type: 'group',
        name: groupName.trim(),
        participant_ids: selected.map((u) => u.id),
      }),
    });
    if (res.ok) {
      const conv = await res.json();
      upsertConversation(conv);
      onConversationCreated(conv.id);
      onClose();
    }
    setCreating(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>New Group</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--signal-muted)', cursor: 'pointer', fontSize: 20 }}>
            ✕
          </button>
        </div>

        <input
          className="signal-input"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Group name…"
          style={{ marginBottom: 14 }}
          autoFocus
        />

        {/* Selected chips */}
        {selected.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {selected.map((u) => (
              <span
                key={u.id}
                style={{
                  background: 'rgba(58,118,240,0.2)',
                  border: '1px solid rgba(58,118,240,0.4)',
                  borderRadius: 20,
                  padding: '4px 10px',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {u.display_name}
                <button
                  onClick={() => toggle(u)}
                  style={{ background: 'none', border: 'none', color: 'var(--signal-muted)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        <input
          className="signal-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Add participants…"
          style={{ marginBottom: 12 }}
        />

        <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 20 }}>
          {loading && (
            <div style={{ color: 'var(--signal-muted)', fontSize: 13, textAlign: 'center', padding: 16 }}>Searching…</div>
          )}
          {results.map((u) => {
            const isSelected = !!selected.find((s) => s.id === u.id);
            return (
              <div
                key={u.id}
                className="conv-row"
                onClick={() => toggle(u)}
                style={{ background: isSelected ? 'rgba(58,118,240,0.15)' : undefined }}
              >
                <Avatar url={u.avatar_url} name={u.display_name} size={40} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{u.display_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--signal-muted)' }}>@{u.username}</div>
                </div>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: isSelected ? 'var(--signal-blue)' : 'transparent',
                    border: `2px solid ${isSelected ? 'var(--signal-blue)' : 'var(--signal-border)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="white">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" fill="none" />
                    </svg>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          className="signal-btn"
          onClick={create}
          disabled={!groupName.trim() || selected.length < 1 || creating}
          style={{ width: '100%' }}
        >
          {creating ? 'Creating…' : `Create Group (${selected.length + 1} members)`}
        </button>
      </div>
    </div>
  );
}
