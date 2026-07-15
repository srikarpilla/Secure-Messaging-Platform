from datetime import datetime, timezone
import enum
from app.extensions import db


class ConversationType(str, enum.Enum):
    DIRECT = "direct"
    GROUP = "group"


class ParticipantRole(str, enum.Enum):
    ADMIN = "admin"
    MEMBER = "member"


class Conversation(db.Model):
    __tablename__ = "conversations"

    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(
        db.Enum(ConversationType), nullable=False, default=ConversationType.DIRECT
    )
    name = db.Column(db.String(120), nullable=True)          # Groups only
    avatar_url = db.Column(db.String(255), nullable=True)    # Groups only
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    creator = db.relationship("User", foreign_keys=[created_by])
    participants = db.relationship(
        "ConversationParticipant", back_populates="conversation", lazy="dynamic"
    )
    messages = db.relationship(
        "Message",
        back_populates="conversation",
        lazy="dynamic",
        order_by="Message.created_at",
    )

    def to_dict(self, current_user_id: int | None = None) -> dict:
        participants = self.participants.all()
        last_msg = (
            self.messages.order_by(db.text("created_at DESC")).first()
        )
        unread_count = 0
        if current_user_id:
            participant = next(
                (p for p in participants if p.user_id == current_user_id), None
            )
            if participant:
                if participant.last_read_message_id is None:
                    unread_count = self.messages.count()
                else:
                    from app.models.message import Message
                    last_read = Message.query.get(participant.last_read_message_id)
                    if last_read:
                        unread_count = self.messages.filter(
                            Message.created_at > last_read.created_at
                        ).count()

        return {
            "id": self.id,
            "type": self.type.value,
            "name": self.name,
            "avatar_url": self.avatar_url,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "participants": [p.to_dict() for p in participants],
            "last_message": last_msg.to_dict() if last_msg else None,
            "unread_count": unread_count,
        }

    def __repr__(self) -> str:
        return f"<Conversation id={self.id} type={self.type}>"


class ConversationParticipant(db.Model):
    __tablename__ = "conversation_participants"

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(
        db.Integer, db.ForeignKey("conversations.id"), nullable=False, index=True
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    role = db.Column(
        db.Enum(ParticipantRole), nullable=False, default=ParticipantRole.MEMBER
    )
    joined_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    last_read_message_id = db.Column(
        db.Integer, db.ForeignKey("messages.id"), nullable=True
    )
    is_muted = db.Column(db.Boolean, default=False, nullable=False)

    __table_args__ = (
        db.UniqueConstraint(
            "conversation_id", "user_id", name="uq_conv_participant"
        ),
    )

    # Relationships
    conversation = db.relationship("Conversation", back_populates="participants")
    user = db.relationship("User", back_populates="participations")
    last_read_message = db.relationship("Message", foreign_keys=[last_read_message_id])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "user_id": self.user_id,
            "role": self.role.value,
            "joined_at": self.joined_at.isoformat(),
            "last_read_message_id": self.last_read_message_id,
            "is_muted": self.is_muted,
            "user": self.user.to_dict() if self.user else None,
        }

    def __repr__(self) -> str:
        return f"<Participant conv={self.conversation_id} user={self.user_id}>"
