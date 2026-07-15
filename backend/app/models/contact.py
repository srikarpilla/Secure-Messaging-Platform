from datetime import datetime, timezone
from app.extensions import db


class Contact(db.Model):
    __tablename__ = "contacts"

    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    contact_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    nickname = db.Column(db.String(120), nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint("owner_id", "contact_id", name="uq_owner_contact"),
    )

    # Relationships
    owner = db.relationship("User", foreign_keys=[owner_id], back_populates="contacts_owned")
    contact_user = db.relationship(
        "User", foreign_keys=[contact_id], back_populates="contacts_as_contact"
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "owner_id": self.owner_id,
            "contact_id": self.contact_id,
            "nickname": self.nickname,
            "created_at": self.created_at.isoformat(),
            "contact_user": self.contact_user.to_dict() if self.contact_user else None,
        }

    def __repr__(self) -> str:
        return f"<Contact owner={self.owner_id} contact={self.contact_id}>"
