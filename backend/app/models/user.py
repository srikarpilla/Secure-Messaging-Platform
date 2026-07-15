from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    phone_number = db.Column(db.String(20), unique=True, nullable=False, index=True)
    display_name = db.Column(db.String(120), nullable=False)
    avatar_url = db.Column(db.String(255), nullable=True)
    password_hash = db.Column(db.String(255), nullable=True)

    # Mock OTP: store the generated OTP (plaintext for demo only)
    otp_code = db.Column(db.String(6), nullable=True)
    otp_expires_at = db.Column(db.DateTime, nullable=True)
    is_verified = db.Column(db.Boolean, default=False, nullable=False)

    is_online = db.Column(db.Boolean, default=False, nullable=False)
    last_seen_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    contacts_owned = db.relationship(
        "Contact", foreign_keys="Contact.owner_id", back_populates="owner", lazy="dynamic"
    )
    contacts_as_contact = db.relationship(
        "Contact", foreign_keys="Contact.contact_id", back_populates="contact_user", lazy="dynamic"
    )
    participations = db.relationship(
        "ConversationParticipant", back_populates="user", lazy="dynamic"
    )
    sent_messages = db.relationship(
        "Message", back_populates="sender", lazy="dynamic"
    )
    message_statuses = db.relationship(
        "MessageStatus", back_populates="user", lazy="dynamic"
    )
    reactions = db.relationship(
        "MessageReaction", back_populates="user", lazy="dynamic"
    )

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def to_dict(self, include_private: bool = False) -> dict:
        data = {
            "id": self.id,
            "username": self.username,
            "display_name": self.display_name,
            "avatar_url": self.avatar_url,
            "is_online": self.is_online,
            "last_seen_at": (
                self.last_seen_at.isoformat() if self.last_seen_at else None
            ),
            "created_at": self.created_at.isoformat(),
        }
        if include_private:
            data["phone_number"] = self.phone_number
            data["is_verified"] = self.is_verified
        return data

    def __repr__(self) -> str:
        return f"<User {self.username}>"
