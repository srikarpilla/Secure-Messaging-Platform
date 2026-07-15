from datetime import datetime, timezone
import enum
from app.extensions import db


class MessageType(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    FILE = "file"


class StatusEnum(str, enum.Enum):
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(
        db.Integer, db.ForeignKey("conversations.id"), nullable=False, index=True
    )
    sender_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    content = db.Column(db.Text, nullable=True)
    message_type = db.Column(
        db.Enum(MessageType), nullable=False, default=MessageType.TEXT
    )
    reply_to_message_id = db.Column(
        db.Integer, db.ForeignKey("messages.id"), nullable=True
    )
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    edited_at = db.Column(db.DateTime, nullable=True)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)

    # Relationships
    conversation = db.relationship("Conversation", back_populates="messages")
    sender = db.relationship("User", back_populates="sent_messages")
    reply_to = db.relationship("Message", remote_side=[id], foreign_keys=[reply_to_message_id])
    statuses = db.relationship("MessageStatus", back_populates="message", lazy="dynamic")
    reactions = db.relationship("MessageReaction", back_populates="message", lazy="dynamic")
    attachments = db.relationship("Attachment", back_populates="message", lazy="dynamic")

    def to_dict(self) -> dict:
        statuses_list = self.statuses.all()
        reactions_list = self.reactions.all()
        attachments_list = self.attachments.all()

        reply_preview = None
        if self.reply_to and not self.reply_to.is_deleted:
            reply_preview = {
                "id": self.reply_to.id,
                "content": self.reply_to.content,
                "sender_id": self.reply_to.sender_id,
                "sender_name": (
                    self.reply_to.sender.display_name if self.reply_to.sender else None
                ),
            }

        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "sender_id": self.sender_id,
            "sender": self.sender.to_dict() if self.sender else None,
            "content": None if self.is_deleted else self.content,
            "message_type": self.message_type.value,
            "reply_to_message_id": self.reply_to_message_id,
            "reply_preview": reply_preview,
            "created_at": self.created_at.isoformat(),
            "edited_at": self.edited_at.isoformat() if self.edited_at else None,
            "is_deleted": self.is_deleted,
            "statuses": [s.to_dict() for s in statuses_list],
            "reactions": [r.to_dict() for r in reactions_list],
            "attachments": [a.to_dict() for a in attachments_list],
        }

    def __repr__(self) -> str:
        return f"<Message id={self.id} conv={self.conversation_id}>"


class MessageStatus(db.Model):
    __tablename__ = "message_status"

    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(
        db.Integer, db.ForeignKey("messages.id"), nullable=False, index=True
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    status = db.Column(
        db.Enum(StatusEnum), nullable=False, default=StatusEnum.SENT
    )
    updated_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint("message_id", "user_id", name="uq_msg_status"),
    )

    # Relationships
    message = db.relationship("Message", back_populates="statuses")
    user = db.relationship("User", back_populates="message_statuses")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "message_id": self.message_id,
            "user_id": self.user_id,
            "status": self.status.value,
            "updated_at": self.updated_at.isoformat(),
        }


class MessageReaction(db.Model):
    __tablename__ = "message_reactions"

    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(
        db.Integer, db.ForeignKey("messages.id"), nullable=False, index=True
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    emoji = db.Column(db.String(10), nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint("message_id", "user_id", name="uq_reaction"),
    )

    # Relationships
    message = db.relationship("Message", back_populates="reactions")
    user = db.relationship("User", back_populates="reactions")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "message_id": self.message_id,
            "user_id": self.user_id,
            "emoji": self.emoji,
            "created_at": self.created_at.isoformat(),
        }
