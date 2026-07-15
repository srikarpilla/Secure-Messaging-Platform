"""Users blueprint — profile, avatar upload, search."""
import os
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from app.extensions import db
from app.models.user import User

users_bp = Blueprint("users", __name__)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}


def _allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@users_bp.get("/search")
@jwt_required()
def search_users():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([]), 200
    users = User.query.filter(
        (User.username.ilike(f"%{q}%")) | (User.display_name.ilike(f"%{q}%"))
    ).limit(20).all()
    return jsonify([u.to_dict() for u in users]), 200


@users_bp.get("/<int:user_id>")
@jwt_required()
def get_user(user_id: int):
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict()), 200


@users_bp.put("/profile")
@jwt_required()
def update_profile():
    current_id = int(get_jwt_identity())
    user = User.query.get_or_404(current_id)
    data = request.get_json(silent=True) or {}

    if "display_name" in data and data["display_name"].strip():
        user.display_name = data["display_name"].strip()
    if "username" in data and data["username"].strip():
        existing = User.query.filter_by(username=data["username"].strip()).first()
        if existing and existing.id != current_id:
            return jsonify({"error": "Username taken"}), 409
        user.username = data["username"].strip()

    db.session.commit()
    return jsonify(user.to_dict(include_private=True)), 200


@users_bp.post("/avatar")
@jwt_required()
def upload_avatar():
    current_id = int(get_jwt_identity())
    user = User.query.get_or_404(current_id)

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "" or not _allowed_file(file.filename):
        return jsonify({"error": "Invalid file type"}), 400

    filename = secure_filename(f"avatar_{current_id}_{file.filename}")
    filepath = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)

    user.avatar_url = f"/api/uploads/{filename}"
    db.session.commit()
    return jsonify({"avatar_url": user.avatar_url}), 200


@users_bp.get("/uploads/<path:filename>")
def serve_upload(filename: str):
    return send_from_directory(current_app.config["UPLOAD_FOLDER"], filename)
