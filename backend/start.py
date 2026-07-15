import eventlet
eventlet.monkey_patch()

import os
from app import create_app
from app.extensions import db, socketio

app = create_app(os.environ.get("FLASK_ENV", "production"))


def seed_if_empty():
    """Seed demo data only if the database is empty (first deploy)."""
    with app.app_context():
        from app.models.user import User
        if User.query.count() == 0:
            print("[startup] Empty DB detected — running seed…")
            try:
                from app.models.user import User
                from app.models.contact import Contact
                from app.models.conversation import (
                    Conversation, ConversationParticipant,
                    ConversationType, ParticipantRole,
                )
                from app.models.message import Message, MessageStatus, MessageType, StatusEnum
                from datetime import datetime, timedelta, timezone

                USERS = [
                    {"username": "alice",   "phone_number": "+910000000001", "display_name": "Alice Johnson",  "password": "password123"},
                    {"username": "bob",     "phone_number": "+910000000002", "display_name": "Bob Smith",      "password": "password123"},
                    {"username": "charlie", "phone_number": "+910000000003", "display_name": "Charlie Brown",  "password": "password123"},
                    {"username": "diana",   "phone_number": "+910000000004", "display_name": "Diana Prince",   "password": "password123"},
                    {"username": "eve",     "phone_number": "+910000000005", "display_name": "Eve Williams",   "password": "password123"},
                ]

                base_time = datetime.now(timezone.utc) - timedelta(days=30)
                users = []
                for i, u in enumerate(USERS):
                    user = User(
                        username=u["username"],
                        phone_number=u["phone_number"],
                        display_name=u["display_name"],
                        is_verified=True,
                        created_at=base_time + timedelta(days=i),
                    )
                    user.set_password(u["password"])
                    db.session.add(user)
                db.session.commit()
                users = User.query.order_by(User.id).all()
                alice, bob, charlie, diana, eve = users

                # Contacts
                for owner, contact in [
                    (alice, bob), (alice, charlie), (alice, diana), (alice, eve),
                    (bob, alice), (bob, charlie), (bob, diana),
                    (charlie, alice), (charlie, bob), (charlie, eve),
                    (diana, alice), (diana, bob),
                    (eve, alice), (eve, charlie),
                ]:
                    db.session.add(Contact(owner_id=owner.id, contact_id=contact.id))
                db.session.commit()

                # Alice-Bob direct
                ab_conv = Conversation(type=ConversationType.DIRECT, created_by=alice.id,
                                       created_at=base_time + timedelta(days=5),
                                       updated_at=datetime.now(timezone.utc) - timedelta(hours=2))
                db.session.add(ab_conv)
                db.session.flush()
                for u in [alice, bob]:
                    db.session.add(ConversationParticipant(conversation_id=ab_conv.id, user_id=u.id, role=ParticipantRole.MEMBER))
                db.session.commit()

                ab_msgs_data = [
                    (0, "Hey Bob! How's the project going?"),
                    (1, "Pretty good! Just finished the auth module"),
                    (0, "Nice! I'm working on the UI now"),
                    (1, "Let me know if you need the API docs"),
                    (0, "Will do, thanks! 🙌"),
                    (1, "How's the Signal clone coming along?"),
                    (0, "It's shaping up nicely! The real-time part is tricky"),
                    (1, "Yeah, WebSockets can be a pain sometimes"),
                    (0, "Tell me about it 😅 But getting there!"),
                ]
                for i, (ui, content) in enumerate(ab_msgs_data):
                    sender = [alice, bob][ui]
                    recipient = bob if sender == alice else alice
                    msg = Message(conversation_id=ab_conv.id, sender_id=sender.id,
                                  content=content, message_type=MessageType.TEXT,
                                  created_at=base_time + timedelta(days=6, minutes=i * 5))
                    db.session.add(msg)
                    db.session.flush()
                    db.session.add(MessageStatus(message_id=msg.id, user_id=recipient.id, status=StatusEnum.READ))
                db.session.commit()

                # Alice-Charlie direct
                ac_conv = Conversation(type=ConversationType.DIRECT, created_by=alice.id,
                                       created_at=base_time + timedelta(days=7),
                                       updated_at=datetime.now(timezone.utc) - timedelta(hours=5))
                db.session.add(ac_conv)
                db.session.flush()
                for u in [alice, charlie]:
                    db.session.add(ConversationParticipant(conversation_id=ac_conv.id, user_id=u.id, role=ParticipantRole.MEMBER))
                db.session.commit()

                ac_msgs_data = [
                    (0, "Charlie, did you see the new design mockups?"),
                    (1, "Not yet! Share them with me?"),
                    (0, "Sending them over in the group chat"),
                    (1, "Got it, they look amazing!"),
                    (0, "Thanks! Took a while to get right"),
                ]
                for i, (ui, content) in enumerate(ac_msgs_data):
                    sender = [alice, charlie][ui]
                    recipient = charlie if sender == alice else alice
                    msg = Message(conversation_id=ac_conv.id, sender_id=sender.id,
                                  content=content, message_type=MessageType.TEXT,
                                  created_at=base_time + timedelta(days=8, minutes=i * 3))
                    db.session.add(msg)
                    db.session.flush()
                    st = StatusEnum.DELIVERED if i == 4 else StatusEnum.READ
                    db.session.add(MessageStatus(message_id=msg.id, user_id=recipient.id, status=st))
                db.session.commit()

                # Group
                group_conv = Conversation(type=ConversationType.GROUP, name="Project Team",
                                          created_by=alice.id,
                                          created_at=base_time + timedelta(days=10),
                                          updated_at=datetime.now(timezone.utc) - timedelta(minutes=30))
                db.session.add(group_conv)
                db.session.flush()
                members = [alice, bob, charlie, diana, eve]
                for u in members:
                    role = ParticipantRole.ADMIN if u == alice else ParticipantRole.MEMBER
                    db.session.add(ConversationParticipant(conversation_id=group_conv.id, user_id=u.id, role=role))
                db.session.commit()

                group_msgs_data = [
                    (0, "Hey team! Welcome to the group 🎉"),
                    (1, "Thanks! Glad to be here."),
                    (2, "Same! What's the first task?"),
                    (0, "Let's plan the project structure first"),
                    (3, "I can handle the frontend part"),
                    (4, "I'll work on the backend API"),
                    (1, "Great! Let's sync tomorrow morning"),
                    (2, "Sounds like a plan! 👍"),
                    (0, "Perfect. See you all at 10 AM"),
                ]
                for i, (ui, content) in enumerate(group_msgs_data):
                    sender = members[ui]
                    msg = Message(conversation_id=group_conv.id, sender_id=sender.id,
                                  content=content, message_type=MessageType.TEXT,
                                  created_at=base_time + timedelta(days=11, minutes=i * 2))
                    db.session.add(msg)
                    db.session.flush()
                    for m in members:
                        if m.id != sender.id:
                            st = StatusEnum.READ if i < 7 else StatusEnum.DELIVERED
                            db.session.add(MessageStatus(message_id=msg.id, user_id=m.id, status=st))
                db.session.commit()
                print("[startup] Seed complete — 5 users, 3 conversations, 23 messages.")
            except Exception as e:
                print(f"[startup] Seed error: {e}")
                db.session.rollback()


with app.app_context():
    db.create_all()

seed_if_empty()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, debug=False)
