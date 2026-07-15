import os
from flask import Flask, send_from_directory
from config import config
from app.extensions import db, migrate, jwt, socketio, cors


def create_app(config_name: str = "default") -> Flask:
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "out"))
    
    app = Flask(__name__, static_folder=frontend_dir, static_url_path="/")
    app.config.from_object(config[config_name])

    # Ensure upload folder exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Initialise extensions
    cors_origins = app.config.get("CORS_ORIGINS", "*")
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    socketio.init_app(app, cors_allowed_origins=cors_origins)
    cors.init_app(app, resources={r"/api/*": {"origins": cors_origins}})

    # Register blueprints
    from app.blueprints.auth import auth_bp
    from app.blueprints.users import users_bp
    from app.blueprints.contacts import contacts_bp
    from app.blueprints.conversations import conversations_bp
    from app.blueprints.messages import messages_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(contacts_bp, url_prefix="/api/contacts")
    app.register_blueprint(conversations_bp, url_prefix="/api/conversations")
    app.register_blueprint(messages_bp, url_prefix="/api/conversations")

    # Register SocketIO events
    from app.socket_events import chat  # noqa: F401

    # Import all models so Alembic sees them
    from app.models import (  # noqa: F401
        User, Contact, Conversation, ConversationParticipant,
        Message, MessageStatus, MessageReaction, Attachment,
    )

    @app.route("/api/health")
    def health():
        return {"status": "ok"}, 200

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        # Serve exact file if it exists (e.g. /_next/static/...)
        if path != "" and os.path.exists(os.path.join(frontend_dir, path)):
            return send_from_directory(frontend_dir, path)
            
        # Serve Next.js trailingSlash: true page (e.g. /chat -> /chat/index.html)
        if path != "" and os.path.exists(os.path.join(frontend_dir, path, "index.html")):
            return send_from_directory(frontend_dir, os.path.join(path, "index.html"))
            
        # Serve Next.js trailingSlash: false page (e.g. /chat -> /chat.html)
        if path != "" and os.path.exists(os.path.join(frontend_dir, path + ".html")):
            return send_from_directory(frontend_dir, path + ".html")

        # Fallback to root index.html
        return send_from_directory(frontend_dir, "index.html")

    return app
