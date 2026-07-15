"""Contacts blueprint — list, add, remove, check."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models.user import User
from app.models.contact import Contact

contacts_bp = Blueprint("contacts", __name__)


@contacts_bp.get("/")
@jwt_required()
def list_contacts():
    current_id = int(get_jwt_identity())
    contacts = Contact.query.filter_by(owner_id=current_id).all()
    return jsonify([c.to_dict() for c in contacts]), 200


@contacts_bp.post("/")
@jwt_required()
def add_contact():
    current_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    contact_user_id = data.get("contact_id")
    nickname = data.get("nickname")

    if not contact_user_id:
        return jsonify({"error": "contact_id is required"}), 400

    if contact_user_id == current_id:
        return jsonify({"error": "Cannot add yourself"}), 400

    target = User.query.get(contact_user_id)
    if not target:
        return jsonify({"error": "User not found"}), 404

    existing = Contact.query.filter_by(
        owner_id=current_id, contact_id=contact_user_id
    ).first()
    if existing:
        return jsonify({"error": "Contact already added"}), 409

    contact = Contact(
        owner_id=current_id,
        contact_id=contact_user_id,
        nickname=nickname,
    )
    db.session.add(contact)
    db.session.commit()
    return jsonify(contact.to_dict()), 201


@contacts_bp.delete("/<int:contact_id>")
@jwt_required()
def remove_contact(contact_id: int):
    current_id = int(get_jwt_identity())
    contact = Contact.query.filter_by(
        owner_id=current_id, contact_id=contact_id
    ).first_or_404()
    db.session.delete(contact)
    db.session.commit()
    return jsonify({"message": "Contact removed"}), 200


@contacts_bp.get("/check/<int:user_id>")
@jwt_required()
def check_contact(user_id: int):
    current_id = int(get_jwt_identity())
    contact = Contact.query.filter_by(
        owner_id=current_id, contact_id=user_id
    ).first()
    return jsonify({"is_contact": contact is not None}), 200
