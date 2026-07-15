"""Messages blueprint — paginated history and reactions via REST."""
import os
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from app.extensions import db
from app.models.conversation import ConversationParticipant
from app.models.message import Message, MessageReaction, MessageStatus, StatusEnum
from app.models.attachment import Attachment

messages_bp = Blueprint("messages", __name__)

ALLOWED_UPLOAD = {"png", "jpg", "jpeg", "gif", "webp", "pdf", "mp4", "txt", "zip"}


def _assert_participant(conv_id: int, user_id: int):
    p = ConversationParticipant.query.filter_by(
        conversation_id=conv_id, user_id=user_id
    ).first()
    if not p:
        from flask import abort
        abort(403)
    return p


@messages_bp.get("/<int:conv_id>/messages")
@jwt_required()
def get_messages(conv_id: int):
    current_id = int(get_jwt_identity())
    _assert_participant(conv_id, current_id)

    before_id = request.args.get("before_id", type=int)
    limit = min(request.args.get("limit", 50, type=int), 100)

    query = Message.query.filter_by(conversation_id=conv_id)
    if before_id:
        query = query.filter(Message.id < before_id)
    messages = query.order_by(Message.id.desc()).limit(limit).all()
    messages = list(reversed(messages))

    # Mark messages as delivered for this user
    for msg in messages:
        if msg.sender_id != current_id:
            status_row = MessageStatus.query.filter_by(
                message_id=msg.id, user_id=current_id
            ).first()
            if status_row and status_row.status == StatusEnum.SENT:
                status_row.status = StatusEnum.DELIVERED
                status_row.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    return jsonify([m.to_dict() for m in messages]), 200


@messages_bp.delete("/<int:conv_id>/messages/<int:msg_id>")
@jwt_required()
def delete_message(conv_id: int, msg_id: int):
    current_id = int(get_jwt_identity())
    _assert_participant(conv_id, current_id)

    msg = Message.query.filter_by(id=msg_id, conversation_id=conv_id).first_or_404()
    if msg.sender_id != current_id:
        return jsonify({"error": "Cannot delete another user's message"}), 403

    msg.is_deleted = True
    msg.content = None
    db.session.commit()
    return jsonify({"message": "Deleted"}), 200


@messages_bp.put("/<int:conv_id>/messages/<int:msg_id>")
@jwt_required()
def edit_message(conv_id: int, msg_id: int):
    current_id = int(get_jwt_identity())
    _assert_participant(conv_id, current_id)

    msg = Message.query.filter_by(id=msg_id, conversation_id=conv_id).first_or_404()
    if msg.sender_id != current_id:
        return jsonify({"error": "Cannot edit another user's message"}), 403
    if msg.is_deleted:
        return jsonify({"error": "Cannot edit deleted message"}), 400

    data = request.get_json(silent=True) or {}
    content = data.get("content", "").strip()
    if not content:
        return jsonify({"error": "content required"}), 400

    msg.content = content
    msg.edited_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(msg.to_dict()), 200


@messages_bp.post("/<int:conv_id>/messages/<int:msg_id>/react")
@jwt_required()
def react_to_message(conv_id: int, msg_id: int):
    current_id = int(get_jwt_identity())
    _assert_participant(conv_id, current_id)

    data = request.get_json(silent=True) or {}
    emoji = data.get("emoji", "").strip()
    if not emoji:
        return jsonify({"error": "emoji required"}), 400

    existing = MessageReaction.query.filter_by(
        message_id=msg_id, user_id=current_id
    ).first()
    if existing:
        if existing.emoji == emoji:
            db.session.delete(existing)
            db.session.commit()
            return jsonify({"message": "Reaction removed"}), 200
        existing.emoji = emoji
        db.session.commit()
        return jsonify(existing.to_dict()), 200

    reaction = MessageReaction(message_id=msg_id, user_id=current_id, emoji=emoji)
    db.session.add(reaction)
    db.session.commit()
    return jsonify(reaction.to_dict()), 201


@messages_bp.post("/<int:conv_id>/upload")
@jwt_required()
def upload_file(conv_id: int):
    current_id = int(get_jwt_identity())
    _assert_participant(conv_id, current_id)

    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_UPLOAD:
        return jsonify({"error": "File type not allowed"}), 400

    filename = secure_filename(f"attach_{current_id}_{int(datetime.now().timestamp())}_{file.filename}")
    filepath = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)
    size = os.path.getsize(filepath)

    return jsonify(
        {
            "file_url": f"/api/uploads/{filename}",
            "file_name": file.filename,
            "file_type": file.content_type,
            "file_size": size,
        }
    ), 201
