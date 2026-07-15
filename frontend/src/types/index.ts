export interface User {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  phone_number?: string;
  is_online: boolean;
  last_seen_at: string | null;
  created_at: string;
  is_verified?: boolean;
}

export interface Contact {
  id: number;
  owner_id: number;
  contact_id: number;
  nickname: string | null;
  created_at: string;
  contact_user: User;
}

export type ConversationType = 'direct' | 'group';
export type ParticipantRole = 'admin' | 'member';

export interface ConversationParticipant {
  id: number;
  conversation_id: number;
  user_id: number;
  role: ParticipantRole;
  joined_at: string;
  last_read_message_id: number | null;
  is_muted: boolean;
  user: User;
}

export interface Conversation {
  id: number;
  type: ConversationType;
  name: string | null;
  avatar_url: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  participants: ConversationParticipant[];
  last_message: Message | null;
  unread_count: number;
}

export type MessageType = 'text' | 'image' | 'file';
export type MessageStatusEnum = 'sent' | 'delivered' | 'read';

export interface MessageStatusRow {
  id: number;
  message_id: number;
  user_id: number;
  status: MessageStatusEnum;
  updated_at: string;
}

export interface Attachment {
  id: number;
  message_id: number;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
}

export interface Reaction {
  id: number;
  message_id: number;
  user_id: number;
  emoji: string;
}

export interface ReplyPreview {
  id: number;
  content: string | null;
  sender_id: number;
  sender_name: string | null;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender: User | null;
  content: string | null;
  message_type: MessageType;
  reply_to_message_id: number | null;
  reply_preview: ReplyPreview | null;
  created_at: string;
  edited_at: string | null;
  is_deleted: boolean;
  statuses: MessageStatusRow[];
  reactions: Reaction[];
  attachments: Attachment[];
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface TypingState {
  conversation_id: number;
  user_id: number;
  is_typing: boolean;
}
