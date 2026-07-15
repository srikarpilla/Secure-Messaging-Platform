# SignalChat — Real-Time Messaging Application

A Signal-inspired full-stack real-time chat application built with Flask + Next.js.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (TypeScript) + Tailwind CSS + Zustand |
| Backend | **Flask + Flask-SocketIO** (eventlet) — see note below |
| Auth | Flask-JWT-Extended (access + refresh tokens, mock OTP) |
| ORM | SQLAlchemy 2 + Flask-Migrate (Alembic) |
| Database | SQLite |
| Realtime | Socket.IO (rooms per conversation) |

> **Framework note**: The assignment listed FastAPI or Django. Flask was chosen because Flask-SocketIO provides the tightest Socket.IO integration (shared app context, eventlet async), which simplified the real-time layer significantly. The REST API design follows the same RESTful conventions that FastAPI would use. A FastAPI + python-socketio equivalent would be structurally identical.

---

## Database Schema

```
users
  id, username, phone_number, display_name, avatar_url,
  password_hash, otp_code, otp_expires_at, is_verified,
  is_online, last_seen_at, created_at

contacts
  id, owner_id (FK users), contact_id (FK users), nickname, created_at
  UNIQUE(owner_id, contact_id)

conversations
  id, type (ENUM: direct|group), name (groups only),
  avatar_url (groups only), created_by, created_at, updated_at

conversation_participants
  id, conversation_id, user_id,
  role (ENUM: admin|member),
  joined_at, last_read_message_id, is_muted
  UNIQUE(conversation_id, user_id)

messages
  id, conversation_id, sender_id, content, message_type (text|image|file),
  reply_to_message_id (nullable), created_at, edited_at, is_deleted

message_status
  id, message_id, user_id, status (ENUM: sent|delivered|read), updated_at
  UNIQUE(message_id, user_id)
  -- one row per recipient per message; enables per-message granularity for
  -- double-tick UI in both direct and group chats

message_reactions
  id, message_id, user_id, emoji, created_at
  UNIQUE(message_id, user_id)

attachments
  id, message_id, file_url, file_name, file_type, file_size, created_at
```

> **Design note**: `message_status` has one row per recipient per message (not a single boolean on messages). This is required for correct delivery/read ticks in group chats where N recipients each have independent delivery state.
>
> `last_read_message_id` on `conversation_participants` enables O(1) unread-count computation without a per-message-per-user explosion for the conversation list view.

---

## REST API

### Auth — `/api/auth`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Create account, returns mock OTP |
| POST | `/verify-otp` | Verify OTP, issue JWT tokens |
| POST | `/login` | Login with phone/username + password |
| POST | `/refresh` | Refresh access token |
| POST | `/logout` | Mark offline, invalidate |
| GET  | `/me` | Get current user profile |

### Users — `/api/users`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/search?q=` | Search users by name/username |
| GET | `/<id>` | Get user profile |
| PUT | `/profile` | Update display name / username |
| POST | `/avatar` | Upload avatar image |

### Contacts — `/api/contacts`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | List contacts |
| POST | `/` | Add contact |
| DELETE | `/<contact_id>` | Remove contact |
| GET | `/check/<user_id>` | Check if user is a contact |

### Conversations — `/api/conversations`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | List conversations (sorted by last message) |
| POST | `/` | Create direct or group conversation |
| GET | `/<id>` | Get conversation detail |
| POST | `/<id>/members` | Add member (admin only) |
| DELETE | `/<id>/members/<uid>` | Remove member |
| POST | `/<id>/leave` | Leave conversation |
| PUT | `/<id>/mute` | Toggle mute |

### Messages — `/api/conversations/<id>/messages`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Paginated message history (before_id + limit) |
| DELETE | `/<msg_id>` | Soft-delete message (own only) |
| PUT | `/<msg_id>` | Edit message content (own only) |
| POST | `/<msg_id>/react` | Add/toggle/remove emoji reaction |
| POST | `/upload` | Upload file/image attachment |

---

## WebSocket Events (Socket.IO)

### Client → Server
| Event | Payload | Description |
|---|---|---|
| `message:send` | `{conversation_id, content, message_type, reply_to_message_id, attachment}` | Send a message |
| `message:delivered` | `{message_id}` | Mark message as delivered |
| `message:read` | `{conversation_id, message_id}` | Mark messages as read up to message_id |
| `typing:start` | `{conversation_id}` | Start typing indicator |
| `typing:stop` | `{conversation_id}` | Stop typing indicator |
| `conversation:join` | `{conversation_id}` | Join a conversation room |
| `conversation:leave` | `{conversation_id}` | Leave a conversation room |

### Server → Client
| Event | Payload | Description |
|---|---|---|
| `message:new` | Message object | New message in a conversation |
| `message:status_update` | `{conversation_id, message_id, user_id, status}` | Delivery/read status changed |
| `typing:update` | `{conversation_id, user_id, is_typing}` | Typing indicator update |
| `presence:update` | `{user_id, is_online, last_seen_at}` | User online/offline status |

---

## Setup & Running

### Prerequisites
- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
pip install -r requirements.txt
python seed.py        # Creates SQLite DB + demo data
python run.py         # Starts Flask + SocketIO on :5000
```

### Frontend

```bash
cd frontend
npm install
npm run dev           # Starts Next.js on :3000
```

Open [http://localhost:3000](http://localhost:3000)

### Demo Accounts (password: `password123`)

| Username | Phone | Role in group |
|---|---|---|
| alice | +910000000001 | Admin |
| bob | +910000000002 | Member |
| charlie | +910000000003 | Member |
| diana | +910000000004 | Member |
| eve | +910000000005 | Member |

Pre-seeded conversations:
- **Alice ↔ Bob** — 9 messages (all read)
- **Alice ↔ Charlie** — 5 messages (last unread)
- **Project Team** (group, all 5 users) — 9 messages

---

## Project Structure

```
Assessment/
├── backend/
│   ├── app/
│   │   ├── __init__.py           # App factory
│   │   ├── extensions.py         # db, jwt, socketio, cors
│   │   ├── models/               # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   ├── contact.py
│   │   │   ├── conversation.py
│   │   │   ├── message.py
│   │   │   └── attachment.py
│   │   ├── blueprints/           # REST endpoints
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── contacts.py
│   │   │   ├── conversations.py
│   │   │   └── messages.py
│   │   └── socket_events/
│   │       └── chat.py           # All SocketIO handlers
│   ├── config.py
│   ├── run.py
│   ├── seed.py
│   └── requirements.txt
└── frontend/
    └── src/
        ├── app/
        │   ├── login/page.tsx
        │   ├── register/page.tsx
        │   └── chat/page.tsx
        ├── components/
        │   ├── Avatar.tsx
        │   ├── ConversationList.tsx
        │   ├── ChatWindow.tsx
        │   ├── MessageBubble.tsx
        │   ├── NewChatModal.tsx
        │   ├── NewGroupModal.tsx
        │   └── GroupInfoPanel.tsx
        ├── lib/socket.ts
        ├── store/chatStore.ts
        └── types/index.ts
```

---

## Architecture Decisions

**REST for CRUD/history, WebSocket for live events**: Sockets are used only for push (new messages, status updates, typing, presence). Paginated history is fetched over REST. This separation keeps each protocol responsible for what it does best and makes the socket handler code easy to explain in a code review.

**Separate `message_status` table**: Rather than a boolean on `messages`, each recipient gets their own row with `sent → delivered → read` state. This is required for correct double-tick semantics in groups where each of N recipients has independent delivery state.

**`last_read_message_id` pointer**: Instead of counting unread messages row-by-row, each participant stores a pointer to the last message they read. Unread count = messages newer than that pointer. O(1) for the conversation list.

**Single eventlet worker**: SQLite + Flask-SocketIO works correctly with a single process. Multiple workers would require a message broker (Redis) for SocketIO pub/sub and would hit SQLite file-locking under concurrent writes.

---

## Assumptions

- OTP is mocked and returned directly in the API response (demo only — production would send via SMS)
- Passwords are hashed with Werkzeug's PBKDF2-SHA256
- Attachments are stored on disk (in `/uploads`) — production would use S3/GCS
- JWT tokens are not blacklisted on logout (stateless); clients discard them
