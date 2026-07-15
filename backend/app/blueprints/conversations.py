"""Conversations blueprint — list, create (direct/group), detail, members."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import desc

from app.extensions import db
from app.models.user import User
from app.models.conversation import Conversation, ConversationParticipant, ConversationType, ParticipantRole
from app.models.message import Message

conversations_bp = Blueprint("conversations", __name__)


def _assert_participant(conv_id: int, user_id: int) -> ConversationParticipant:
    p = ConversationParticipant.query.filter_by(
        conversation_id=conv_id, user_id=user_id
    ).first()
    if not p:
        from flask import abort
        abort(403)
    return p


@conversations_bp.get("/")
@jwt_required()
def list_conversations():
    current_id = int(get_jwt_identity())
    # Get all conversation IDs the user is part of
    participations = ConversationParticipant.query.filter_by(user_id=current_id).all()
    conv_ids = [p.conversation_id for p in participations]

    conversations = (
        Conversation.query.filter(Conversation.id.in_(conv_ids))
        .order_by(desc(Conversation.updated_at))
        .all()
    )
    return jsonify([c.to_dict(current_user_id=current_id) for c in conversations]), 200


@conversations_bp.post("/")
@jwt_required()
def create_conversation():
    current_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    conv_type = data.get("type", "direct")
    participant_ids: list[int] = data.get("participant_ids", [])

    if conv_type == "direct":
        if len(participant_ids) != 1:
            return jsonify({"error": "Direct chat requires exactly 1 other participant"}), 400
        other_id = participant_ids[0]
        if other_id == current_id:
            return jsonify({"error": "Cannot chat with yourself"}), 400

        # Check if direct chat already exists
        existing_p = ConversationParticipant.query.filter_by(
            user_id=current_id
        ).join(Conversation).filter(Conversation.type == ConversationType.DIRECT).all()
        for p in existing_p:
            other_p = ConversationParticipant.query.filter_by(
                conversation_id=p.conversation_id, user_id=other_id
            ).first()
            if other_p:
                conv = Conversation.query.get(p.conversation_id)
                return jsonify(conv.to_dict(current_user_id=current_id)), 200

        conv = Conversation(type=ConversationType.DIRECT, created_by=current_id)
        db.session.add(conv)
        db.session.flush()

        for uid in [current_id, other_id]:
            p = ConversationParticipant(
                conversation_id=conv.id,
                user_id=uid,
                role=ParticipantRole.MEMBER,
            )
            db.session.add(p)

    elif conv_type == "group":
        name = data.get("name", "").strip()
        if not name:
            return jsonify({"error": "Group name is required"}), 400
        if len(participant_ids) < 1:
            return jsonify({"error": "Group needs at least 2 members"}), 400

        conv = Conversation(
            type=ConversationType.GROUP,
            name=name,
            avatar_url=data.get("avatar_url"),
            created_by=current_id,
        )
        db.session.add(conv)
        db.session.flush()

        all_ids = list(set([current_id] + participant_ids))
        for uid in all_ids:
            role = ParticipantRole.ADMIN if uid == current_id else ParticipantRole.MEMBER
            p = ConversationParticipant(
                conversation_id=conv.id,
                user_id=uid,
                role=role,
            )
            db.session.add(p)
    else:
        return jsonify({"error": "type must be 'direct' or 'group'"}), 400

    db.session.commit()
    return jsonify(conv.to_dict(current_user_id=current_id)), 201


@conversations_bp.get("/<int:conv_id>")
@jwt_required()
def get_conversation(conv_id: int):
    current_id = int(get_jwt_identity())
    _assert_participant(conv_id, current_id)
    conv = Conversation.query.get_or_404(conv_id)
    return jsonify(conv.to_dict(current_user_id=current_id)), 200


@conversations_bp.post("/<int:conv_id>/members")
@jwt_required()
def add_member(conv_id: int):
    current_id = int(get_jwt_identity())
    participant = _assert_participant(conv_id, current_id)

    if participant.role != ParticipantRole.ADMIN:
        return jsonify({"error": "Only admins can add members"}), 403

    conv = Conversation.query.get_or_404(conv_id)
    if conv.type != ConversationType.GROUP:
        return jsonify({"error": "Cannot add members to a direct chat"}), 400

    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    existing = ConversationParticipant.query.filter_by(
        conversation_id=conv_id, user_id=user_id
    ).first()
    if existing:
        return jsonify({"error": "User already in group"}), 409

    p = ConversationParticipant(
        conversation_id=conv_id,
        user_id=user_id,
        role=ParticipantRole.MEMBER,
    )
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201


@conversations_bp.delete("/<int:conv_id>/members/<int:user_id>")
@jwt_required()
def remove_member(conv_id: int, user_id: int):
    current_id = int(get_jwt_identity())
    participant = _assert_participant(conv_id, current_id)

    if participant.role != ParticipantRole.ADMIN and current_id != user_id:
        return jsonify({"error": "Only admins can remove other members"}), 403

    target = ConversationParticipant.query.filter_by(
        conversation_id=conv_id, user_id=user_id
    ).first_or_404()

    db.session.delete(target)
    db.session.commit()
    return jsonify({"message": "Member removed"}), 200


@conversations_bp.post("/<int:conv_id>/leave")
@jwt_required()
def leave_conversation(conv_id: int):
    current_id = int(get_jwt_identity())
    p = _assert_participant(conv_id, current_id)
    db.session.delete(p)
    db.session.commit()
    return jsonify({"message": "Left conversation"}), 200


@conversations_bp.put("/<int:conv_id>/mute")
@jwt_required()
def toggle_mute(conv_id: int):
    current_id = int(get_jwt_identity())
    p = _assert_participant(conv_id, current_id)
    p.is_muted = not p.is_muted
    db.session.commit()
    return jsonify({"is_muted": p.is_muted}), 200
