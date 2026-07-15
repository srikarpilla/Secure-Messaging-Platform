import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Conversation, Message, TypingState, MessageStatusEnum } from '@/types';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');

interface ChatState {
  // Auth
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  // Data
  conversations: Conversation[];
  activeConversationId: number | null;
  messages: Record<number, Message[]>; // conv_id -> messages
  typingUsers: TypingState[];
  onlineUsers: Set<number>;

  // UI
  replyTo: Message | null;

  // Auth actions
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;

  // Conversation actions
  setConversations: (convs: Conversation[]) => void;
  upsertConversation: (conv: Conversation) => void;
  setActiveConversation: (id: number | null) => void;
  updateConversationLastMessage: (convId: number, msg: Message) => void;

  // Message actions
  setMessages: (convId: number, msgs: Message[]) => void;
  prependMessages: (convId: number, msgs: Message[]) => void;
  addMessage: (msg: Message) => void;
  updateMessageStatus: (convId: number, messageId: number, userId: number, status: MessageStatusEnum) => void;
  updateMessage: (msg: Message) => void;

  // Typing
  setTyping: (state: TypingState) => void;

  // Presence
  setUserOnline: (userId: number, isOnline: boolean) => void;

  // Reply
  setReplyTo: (msg: Message | null) => void;

  // API helpers
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      conversations: [],
      activeConversationId: null,
      messages: {},
      typingUsers: [],
      onlineUsers: new Set<number>(),
      replyTo: null,

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),

      clearAuth: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          conversations: [],
          messages: {},
          activeConversationId: null,
        }),

      setConversations: (convs) => set({ conversations: convs }),

      upsertConversation: (conv) =>
        set((state) => {
          const idx = state.conversations.findIndex((c) => c.id === conv.id);
          if (idx >= 0) {
            const updated = [...state.conversations];
            updated[idx] = conv;
            return { conversations: updated };
          }
          return { conversations: [conv, ...state.conversations] };
        }),

      setActiveConversation: (id) => set({ activeConversationId: id }),

      updateConversationLastMessage: (convId, msg) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === convId ? { ...c, last_message: msg, updated_at: msg.created_at } : c
          ),
        })),

      setMessages: (convId, msgs) =>
        set((state) => ({ messages: { ...state.messages, [convId]: msgs } })),

      prependMessages: (convId, msgs) =>
        set((state) => ({
          messages: {
            ...state.messages,
            [convId]: [...msgs, ...(state.messages[convId] || [])],
          },
        })),

      addMessage: (msg) =>
        set((state) => {
          const existing = state.messages[msg.conversation_id] || [];
          const alreadyExists = existing.some((m) => m.id === msg.id);
          if (alreadyExists) return state;
          return {
            messages: {
              ...state.messages,
              [msg.conversation_id]: [...existing, msg],
            },
          };
        }),

      updateMessageStatus: (convId, messageId, userId, status) =>
        set((state) => {
          const msgs = state.messages[convId] || [];
          return {
            messages: {
              ...state.messages,
              [convId]: msgs.map((m) => {
                if (m.id <= messageId) {
                  return {
                    ...m,
                    statuses: m.statuses.map((s) =>
                      s.user_id === userId && s.message_id === m.id
                        ? { ...s, status }
                        : s
                    ),
                  };
                }
                return m;
              }),
            },
          };
        }),

      updateMessage: (msg) =>
        set((state) => {
          const msgs = state.messages[msg.conversation_id] || [];
          return {
            messages: {
              ...state.messages,
              [msg.conversation_id]: msgs.map((m) => (m.id === msg.id ? msg : m)),
            },
          };
        }),

      setTyping: (ts) =>
        set((state) => {
          const filtered = state.typingUsers.filter(
            (t) =>
              !(t.conversation_id === ts.conversation_id && t.user_id === ts.user_id)
          );
          if (ts.is_typing) {
            return { typingUsers: [...filtered, ts] };
          }
          return { typingUsers: filtered };
        }),

      setUserOnline: (userId, isOnline) =>
        set((state) => {
          const set_ = new Set(state.onlineUsers);
          if (isOnline) set_.add(userId);
          else set_.delete(userId);
          return { onlineUsers: set_ };
        }),

      setReplyTo: (msg) => set({ replyTo: msg }),

      apiFetch: async (path, options = {}) => {
        const { accessToken } = get();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(options.headers as Record<string, string>),
        };
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }
        return fetch(`${API}${path}`, { ...options, headers });
      },
    }),
    {
      name: 'chat-store',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
