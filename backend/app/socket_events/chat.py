"""SocketIO event handlers for real-time chat."""
from datetime import datetime, timezone

from flask import request
from flask_jwt_extended import decode_token
from flask_socketio import emit, join_room, leave_room

from app.extensions import db, socketio
from app.models.user import User
from app.models.conversation import Conversation, ConversationParticipant
from app.models.message import Message, MessageStatus, MessageType, StatusEnum

# Map socket session id -> user_id for presence tracking
_sid_to_user: dict[str, int] = {}


def _get_user_from_token(token: str) -> User | None:
    try:
        decoded = decode_token(token)
        user_id = int(decoded["sub"])
        return User.query.get(user_id)
    except Exception:
        return None


def _get_conversation_room(conv_id: int) -> str:
    return f"conv_{conv_id}"


# ─────────────────────────────────────────────
# Connection lifecycle
# ─────────────────────────────────────────────

@socketio.on("connect")
def on_connect():
    token = request.args.get("token") or (
        request.headers.get("Authorization", "").replace("Bearer ", "")
    )
    user = _get_user_from_token(token)
    if not user:
        return False  # reject connection

    _sid_to_user[request.sid] = user.id

    # Mark online
    user.is_online = True
    db.session.commit()

    # Join a room per conversation they belong to
    participations = ConversationParticipant.query.filter_by(user_id=user.id).all()
    for p in participations:
        join_room(_get_conversation_room(p.conversation_id))

    # Broadcast presence to all rooms
    emit(
        "presence:update",
        {"user_id": user.id, "is_online": True},
        broadcast=True,
        include_self=False,
    )
    emit("connected", {"user_id": user.id})


@socketio.on("disconnect")
def on_disconnect():
    user_id = _sid_to_user.pop(request.sid, None)
    if not user_id:
        return

    user = User.query.get(user_id)
    if user:
        user.is_online = False
        user.last_seen_at = datetime.now(timezone.utc)
        db.session.commit()

    emit(
        "presence:update",
        {
            "user_id": user_id,
            "is_online": False,
            "last_seen_at": (
                user.last_seen_at.isoformat() if (user and user.last_seen_at) else None
            ),
        },
        broadcast=True,
        include_self=False,
    )


# ─────────────────────────────────────────────
# Messaging
# ─────────────────────────────────────────────

@socketio.on("message:send")
def on_message_send(data: dict):
    """
    data = {
        conversation_id: int,
        content: str,
        message_type: str (optional, default 'text'),
        reply_to_message_id: int | None,
        attachment: { file_url, file_name, file_type, file_size } | None
    }
    """
    user_id = _sid_to_user.get(request.sid)
    if not user_id:
        return emit("error", {"message": "Not authenticated"})

    conv_id = data.get("conversation_id")
    content = data.get("content", "").strip()
    msg_type = data.get("message_type", "text")
    reply_to = data.get("reply_to_message_id")
    attachment_data = data.get("attachment")

    if not conv_id or (not content and not attachment_data):
        return emit("error", {"message": "conversation_id and content/attachment required"})

    participant = ConversationParticipant.query.filter_by(
        conversation_id=conv_id, user_id=user_id
    ).first()
    if not participant:
        return emit("error", {"message": "Not a participant"})

    # Persist message
    message = Message(
        conversation_id=conv_id,
        sender_id=user_id,
        content=content or None,
        message_type=MessageType(msg_type),
        reply_to_message_id=reply_to,
    )
    db.session.add(message)
    db.session.flush()

    # Handle attachment
    if attachment_data:
        from app.models.attachment import Attachment
        att = Attachment(
            message_id=message.id,
            file_url=attachment_data.get("file_url", ""),
            file_name=attachment_data.get("file_name"),
            file_type=attachment_data.get("file_type"),
            file_size=attachment_data.get("file_size"),
        )
        db.session.add(att)

    # Create MessageStatus rows for all other participants
    participants = ConversationParticipant.query.filter_by(conversation_id=conv_id).all()
    for p in participants:
        if p.user_id != user_id:
            status = MessageStatus(
                message_id=message.id,
                user_id=p.user_id,
                status=StatusEnum.SENT,
            )
            db.session.add(status)

    # Update conversation updated_at
    conv = Conversation.query.get(conv_id)
    conv.updated_at = datetime.now(timezone.utc)

    db.session.commit()

    room = _get_conversation_room(conv_id)
    emit("message:new", message.to_dict(), room=room)


@socketio.on("message:delivered")
def on_message_delivered(data: dict):
    """Mark a message as delivered for the current user."""
    user_id = _sid_to_user.get(request.sid)
    if not user_id:
        return

    message_id = data.get("message_id")
    status_row = MessageStatus.query.filter_by(
        message_id=message_id, user_id=user_id
    ).first()
    if status_row and status_row.status == StatusEnum.SENT:
        status_row.status = StatusEnum.DELIVERED
        status_row.updated_at = datetime.now(timezone.utc)
        db.session.commit()

        # Notify sender room
        msg = Message.query.get(message_id)
        if msg:
            emit(
                "message:status_update",
                {
                    "message_id": message_id,
                    "user_id": user_id,
                    "status": "delivered",
                },
                room=_get_conversation_room(msg.conversation_id),
            )


@socketio.on("message:read")
def on_message_read(data: dict):
    """Mark messages up to message_id as read; update last_read_message_id."""
    user_id = _sid_to_user.get(request.sid)
    if not user_id:
        return

    conv_id = data.get("conversation_id")
    message_id = data.get("message_id")  # last visible message

    participant = ConversationParticipant.query.filter_by(
        conversation_id=conv_id, user_id=user_id
    ).first()
    if not participant:
        return

    # Update last read pointer
    participant.last_read_message_id = message_id
    db.session.flush()

    # Mark all unread statuses up to this message as read
    unread = (
        MessageStatus.query.filter_by(user_id=user_id, status=StatusEnum.DELIVERED)
        .join(Message)
        .filter(Message.conversation_id == conv_id, Message.id <= message_id)
        .all()
    )
    now = datetime.now(timezone.utc)
    for s in unread:
        s.status = StatusEnum.READ
        s.updated_at = now

    db.session.commit()

    emit(
        "message:status_update",
        {
            "conversation_id": conv_id,
            "message_id": message_id,
            "user_id": user_id,
            "status": "read",
        },
        room=_get_conversation_room(conv_id),
    )


# ─────────────────────────────────────────────
# Typing indicators
# ─────────────────────────────────────────────

@socketio.on("typing:start")
def on_typing_start(data: dict):
    user_id = _sid_to_user.get(request.sid)
    conv_id = data.get("conversation_id")
    if not user_id or not conv_id:
        return
    emit(
        "typing:update",
        {"user_id": user_id, "is_typing": True, "conversation_id": conv_id},
        room=_get_conversation_room(conv_id),
        include_self=False,
    )


@socketio.on("typing:stop")
def on_typing_stop(data: dict):
    user_id = _sid_to_user.get(request.sid)
    conv_id = data.get("conversation_id")
    if not user_id or not conv_id:
        return
    emit(
        "typing:update",
        {"user_id": user_id, "is_typing": False, "conversation_id": conv_id},
        room=_get_conversation_room(conv_id),
        include_self=False,
    )


# ─────────────────────────────────────────────
# Join / leave a conversation room on demand
# ─────────────────────────────────────────────

@socketio.on("conversation:join")
def on_join_conversation(data: dict):
    user_id = _sid_to_user.get(request.sid)
    conv_id = data.get("conversation_id")
    if not user_id or not conv_id:
        return
    p = ConversationParticipant.query.filter_by(
        conversation_id=conv_id, user_id=user_id
    ).first()
    if p:
        join_room(_get_conversation_room(conv_id))


@socketio.on("conversation:leave")
def on_leave_conversation(data: dict):
    conv_id = data.get("conversation_id")
    if conv_id:
        leave_room(_get_conversation_room(conv_id))
