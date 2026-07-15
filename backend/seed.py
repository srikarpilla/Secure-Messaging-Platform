"""
Seed script — creates realistic demo data:
  - 5 users (Alice, Bob, Charlie, Diana, Eve)
  - Contacts between them
  - 2 direct conversations with pre-populated messages
  - 1 group conversation with messages
  - Message statuses (delivered/read)

Run: python seed.py
"""
import eventlet
eventlet.monkey_patch()

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.contact import Contact
from app.models.conversation import Conversation, ConversationParticipant, ConversationType, ParticipantRole
from app.models.message import Message, MessageStatus, MessageType, StatusEnum
from datetime import datetime, timedelta, timezone

app = create_app("development")

USERS = [
    {
        "username": "alice",
        "phone_number": "+910000000001",
        "display_name": "Alice Johnson",
        "password": "password123",
    },
    {
        "username": "bob",
        "phone_number": "+910000000002",
        "display_name": "Bob Smith",
        "password": "password123",
    },
    {
        "username": "charlie",
        "phone_number": "+910000000003",
        "display_name": "Charlie Brown",
        "password": "password123",
    },
    {
        "username": "diana",
        "phone_number": "+910000000004",
        "display_name": "Diana Prince",
        "password": "password123",
    },
    {
        "username": "eve",
        "phone_number": "+910000000005",
        "display_name": "Eve Williams",
        "password": "password123",
    },
]

GROUP_MESSAGES = [
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

DIRECT_MESSAGES_ALICE_BOB = [
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

DIRECT_MESSAGES_ALICE_CHARLIE = [
    (0, "Charlie, did you see the new design mockups?"),
    (1, "Not yet! Share them with me?"),
    (0, "Sending them over in the group chat"),
    (1, "Got it, they look amazing!"),
    (0, "Thanks! Took a while to get right"),
]


def seed():
    with app.app_context():
        print("Dropping and recreating tables...")
        db.drop_all()
        db.create_all()

        print("Creating users...")
        users = []
        base_time = datetime.now(timezone.utc) - timedelta(days=30)
        for i, u_data in enumerate(USERS):
            user = User(
                username=u_data["username"],
                phone_number=u_data["phone_number"],
                display_name=u_data["display_name"],
                is_verified=True,
                created_at=base_time + timedelta(days=i),
            )
            user.set_password(u_data["password"])
            db.session.add(user)
        db.session.commit()

        users = User.query.order_by(User.id).all()
        alice, bob, charlie, diana, eve = users
        print(f"  Created: {[u.username for u in users]}")

        print("Creating contacts...")
        contact_pairs = [
            (alice, bob), (alice, charlie), (alice, diana), (alice, eve),
            (bob, alice), (bob, charlie), (bob, diana),
            (charlie, alice), (charlie, bob), (charlie, eve),
            (diana, alice), (diana, bob),
            (eve, alice), (eve, charlie),
        ]
        for owner, contact in contact_pairs:
            c = Contact(owner_id=owner.id, contact_id=contact.id)
            db.session.add(c)
        db.session.commit()
        print(f"  Created {len(contact_pairs)} contact relationships")

        print("Creating Alice-Bob direct conversation...")
        ab_conv = Conversation(
            type=ConversationType.DIRECT,
            created_by=alice.id,
            created_at=base_time + timedelta(days=5),
            updated_at=datetime.now(timezone.utc) - timedelta(hours=2),
        )
        db.session.add(ab_conv)
        db.session.flush()
        for u in [alice, bob]:
            db.session.add(
                ConversationParticipant(conversation_id=ab_conv.id, user_id=u.id, role=ParticipantRole.MEMBER)
            )
        db.session.commit()

        ab_users = [alice, bob]
        ab_msgs = []
        for i, (user_idx, content) in enumerate(DIRECT_MESSAGES_ALICE_BOB):
            sender = ab_users[user_idx]
            msg = Message(
                conversation_id=ab_conv.id,
                sender_id=sender.id,
                content=content,
                message_type=MessageType.TEXT,
                created_at=base_time + timedelta(days=6, minutes=i * 5),
            )
            db.session.add(msg)
            db.session.flush()
            ab_msgs.append(msg)
            # Status for the other user
            recipient = bob if sender == alice else alice
            status = MessageStatus(
                message_id=msg.id,
                user_id=recipient.id,
                status=StatusEnum.READ,
            )
            db.session.add(status)
        db.session.commit()
        print(f"  Alice-Bob conv: {len(ab_msgs)} messages")

        print("Creating Alice-Charlie direct conversation...")
        ac_conv = Conversation(
            type=ConversationType.DIRECT,
            created_by=alice.id,
            created_at=base_time + timedelta(days=7),
            updated_at=datetime.now(timezone.utc) - timedelta(hours=5),
        )
        db.session.add(ac_conv)
        db.session.flush()
        for u in [alice, charlie]:
            db.session.add(
                ConversationParticipant(conversation_id=ac_conv.id, user_id=u.id, role=ParticipantRole.MEMBER)
            )
        db.session.commit()

        ac_users = [alice, charlie]
        ac_msgs = []
        for i, (user_idx, content) in enumerate(DIRECT_MESSAGES_ALICE_CHARLIE):
            sender = ac_users[user_idx]
            recipient = charlie if sender == alice else alice
            msg = Message(
                conversation_id=ac_conv.id,
                sender_id=sender.id,
                content=content,
                message_type=MessageType.TEXT,
                created_at=base_time + timedelta(days=8, minutes=i * 3),
            )
            db.session.add(msg)
            db.session.flush()
            ac_msgs.append(msg)
            st = StatusEnum.DELIVERED if i == len(DIRECT_MESSAGES_ALICE_CHARLIE) - 1 else StatusEnum.READ
            status = MessageStatus(message_id=msg.id, user_id=recipient.id, status=st)
            db.session.add(status)
        db.session.commit()
        print(f"  Alice-Charlie conv: {len(ac_msgs)} messages")

        print("Creating group conversation...")
        group_conv = Conversation(
            type=ConversationType.GROUP,
            name="Project Team",
            created_by=alice.id,
            created_at=base_time + timedelta(days=10),
            updated_at=datetime.now(timezone.utc) - timedelta(minutes=30),
        )
        db.session.add(group_conv)
        db.session.flush()

        group_members = [alice, bob, charlie, diana, eve]
        for u in group_members:
            role = ParticipantRole.ADMIN if u == alice else ParticipantRole.MEMBER
            db.session.add(
                ConversationParticipant(conversation_id=group_conv.id, user_id=u.id, role=role)
            )
        db.session.commit()

        group_msgs = []
        for i, (user_idx, content) in enumerate(GROUP_MESSAGES):
            sender = group_members[user_idx]
            msg = Message(
                conversation_id=group_conv.id,
                sender_id=sender.id,
                content=content,
                message_type=MessageType.TEXT,
                created_at=base_time + timedelta(days=11, minutes=i * 2),
            )
            db.session.add(msg)
            db.session.flush()
            group_msgs.append(msg)
            # Status for all other participants
            for member in group_members:
                if member.id != sender.id:
                    st = StatusEnum.READ if i < len(GROUP_MESSAGES) - 2 else StatusEnum.DELIVERED
                    status = MessageStatus(message_id=msg.id, user_id=member.id, status=st)
                    db.session.add(status)
        db.session.commit()
        print(f"  Group conv '{group_conv.name}': {len(group_msgs)} messages")

        print("\nSeed complete!")
        print("\nTest credentials (all password: 'password123'):")
        for u in users:
            print(f"  username: {u.username} | phone: {u.phone_number}")


if __name__ == "__main__":
    seed()
