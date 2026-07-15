"""Auth blueprint — register (mock OTP), verify OTP, login, logout, refresh."""
import random
import string
from datetime import datetime, timedelta, timezone

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    jwt_required,
)

from app.extensions import db
from app.models.user import User

auth_bp = Blueprint("auth", __name__)


def _generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


@auth_bp.post("/register")
def register():
    """Step 1: create account and return a mock OTP."""
    data = request.get_json(silent=True) or {}
    phone_number = data.get("phone_number", "").strip()
    username = data.get("username", "").strip()
    display_name = data.get("display_name", "").strip()
    password = data.get("password", "")

    if not phone_number or not username or not display_name:
        return jsonify({"error": "phone_number, username, display_name are required"}), 400

    if User.query.filter_by(phone_number=phone_number).first():
        return jsonify({"error": "Phone number already registered"}), 409

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already taken"}), 409

    otp = _generate_otp()
    user = User(
        username=username,
        phone_number=phone_number,
        display_name=display_name,
        otp_code=otp,
        otp_expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        is_verified=False,
    )
    if password:
        user.set_password(password)

    db.session.add(user)
    db.session.commit()

    # In production you'd send via SMS; here we return it directly
    return jsonify(
        {
            "message": "OTP sent (mocked)",
            "otp": otp,          # expose for demo/testing
            "user_id": user.id,
        }
    ), 201


@auth_bp.post("/verify-otp")
def verify_otp():
    """Step 2: verify OTP and issue JWT tokens."""
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    otp = data.get("otp", "").strip()

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if user.is_verified:
        return jsonify({"error": "Already verified — please log in"}), 400

    now = datetime.now(timezone.utc)
    expires = user.otp_expires_at
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    if user.otp_code != otp or (expires and now > expires):
        return jsonify({"error": "Invalid or expired OTP"}), 401

    user.is_verified = True
    user.otp_code = None
    user.otp_expires_at = None
    db.session.commit()

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify(
        {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": user.to_dict(include_private=True),
        }
    ), 200


@auth_bp.post("/login")
def login():
    """Login with phone_number (or username) + password."""
    data = request.get_json(silent=True) or {}
    identifier = data.get("identifier", "").strip()   # phone or username
    password = data.get("password", "")

    user = (
        User.query.filter_by(phone_number=identifier).first()
        or User.query.filter_by(username=identifier).first()
    )

    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid credentials"}), 401

    if not user.is_verified:
        return jsonify({"error": "Account not verified"}), 403

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify(
        {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": user.to_dict(include_private=True),
        }
    ), 200


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    access_token = create_access_token(identity=identity)
    return jsonify({"access_token": access_token}), 200


@auth_bp.post("/logout")
@jwt_required()
def logout():
    """Mark user offline; client should discard tokens."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if user:
        user.is_online = False
        user.last_seen_at = datetime.now(timezone.utc)
        db.session.commit()
    return jsonify({"message": "Logged out"}), 200


@auth_bp.get("/me")
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict(include_private=True)), 200
