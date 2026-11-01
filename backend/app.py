
import os
import sqlite3
import secrets
import hmac
from functools import wraps

from flask import Flask, jsonify, request, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash


app = Flask(__name__)

# Create a persistent secret key for signing login sessions.
SECRET_FILE = os.path.join(os.path.dirname(__file__), ".secret_key")

if os.path.exists(SECRET_FILE):
    with open(SECRET_FILE, "r") as file:
        SECRET_KEY = file.read().strip()
else:
    SECRET_KEY = secrets.token_hex(32)
    with open(SECRET_FILE, "w") as file:
        file.write(SECRET_KEY)

app.secret_key = SECRET_KEY

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False,  # Local HTTP development only
    PERMANENT_SESSION_LIFETIME=3600
)

CORS(
    app,
    origins=["http://localhost:5173"],
    supports_credentials=True
)

DATABASE = os.path.join(os.path.dirname(__file__), "studysync.db")


def get_db_connection():
    connection = sqlite3.connect(DATABASE)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.row_factory = sqlite3.Row
    return connection


# Generate and validate CSRF tokens for requests that change data.
@app.before_request
def protect_against_csrf():
    if request.method in ["POST", "PUT", "PATCH", "DELETE"]:
        token = session.get("csrf_token")
        submitted_token = request.headers.get("X-CSRF-Token")

        if (
            not token
            or not submitted_token
            or not hmac.compare_digest(token, submitted_token)
        ):
            return jsonify({"message": "Invalid or missing CSRF token"}), 403


def login_required(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"message": "Please log in first"}), 401

        return function(*args, **kwargs)

    return wrapper


def verify_user_id(user_id):
    return session.get("user_id") == user_id


def init_db():
    connection = get_db_connection()

    connection.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL
        )
    """)

    connection.execute("""
        CREATE TABLE IF NOT EXISTS subjects (
            subject_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subject_name TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(user_id)
                ON DELETE CASCADE
        )
    """)

    connection.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            task_id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_id INTEGER NOT NULL,
            task_name TEXT NOT NULL,
            deadline TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
                ON DELETE CASCADE
        )
    """)

    connection.commit()
    connection.close()

    print("StudySync database ready!")


@app.route("/")
def home():
    return jsonify({
        "message": "Welcome to StudySync Backend!",
        "status": "Running successfully"
    })


@app.route("/csrf-token", methods=["GET"])
def get_csrf_token():
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_hex(32)

    return jsonify({"csrf_token": session["csrf_token"]}), 200


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not all(isinstance(value, str) for value in [name, email, password]):
        return jsonify({"message": "All fields are required"}), 400

    name = name.strip()
    email = email.strip().lower()

    if not name or not email or not password:
        return jsonify({"message": "All fields are required"}), 400

    if len(password) < 8:
        return jsonify({
            "message": "Password must contain at least 8 characters"
        }), 400

    password_hash = generate_password_hash(password)
    connection = get_db_connection()

    try:
        connection.execute(
            """INSERT INTO users (name, email, password_hash)
               VALUES (?, ?, ?)""",
            (name, email, password_hash)
        )
        connection.commit()

        return jsonify({"message": "Registration successful!"}), 201

    except sqlite3.IntegrityError:
        return jsonify({"message": "Email already registered"}), 409

    finally:
        connection.close()


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email = data.get("email")
    password = data.get("password")

    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({
            "message": "Email and password are required"
        }), 400

    email = email.strip().lower()

    if not email or not password:
        return jsonify({
            "message": "Email and password are required"
        }), 400

    connection = get_db_connection()

    try:
        user = connection.execute(
            "SELECT * FROM users WHERE email = ?",
            (email,)
        ).fetchone()
    finally:
        connection.close()

    if user and check_password_hash(user["password_hash"], password):
        session.clear()
        session.permanent = True
        session["user_id"] = user["user_id"]
        session["csrf_token"] = secrets.token_hex(32)

        return jsonify({
            "message": "Login successful!",
            "user": {
                "id": user["user_id"],
                "name": user["name"],
                "email": user["email"]
            },
            "csrf_token": session["csrf_token"]
        }), 200

    return jsonify({"message": "Invalid email or password"}), 401


@app.route("/me", methods=["GET"])
@login_required
def get_current_user():
    connection = get_db_connection()

    try:
        user = connection.execute(
            "SELECT user_id, name, email FROM users WHERE user_id = ?",
            (session["user_id"],)
        ).fetchone()

        if not user:
            session.clear()
            return jsonify({"message": "User not found"}), 404

        return jsonify({
            "user": {
                "id": user["user_id"],
                "name": user["name"],
                "email": user["email"]
            }
        }), 200

    finally:
        connection.close()


@app.route("/logout", methods=["POST"])
@login_required
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully"}), 200


@app.route("/subjects/<int:user_id>", methods=["GET"])
@login_required
def get_subjects(user_id):
    if not verify_user_id(user_id):
        return jsonify({"message": "Access denied"}), 403

    connection = get_db_connection()

    try:
        subjects = connection.execute(
            "SELECT * FROM subjects WHERE user_id = ?",
            (session["user_id"],)
        ).fetchall()

        return jsonify([dict(subject) for subject in subjects]), 200

    finally:
        connection.close()

@app.route("/subjects", methods=["POST"])
@login_required
def add_subject():
    data = request.get_json(silent=True) or {}
    subject_name = data.get("subject_name")

    if not isinstance(subject_name, str) or not subject_name.strip():
        return jsonify({"message": "Subject name is required"}), 400

    subject_name = subject_name.strip()

    connection = get_db_connection()

    try:
        # Check whether this user already has the subject.
        existing_subject = connection.execute(
            """SELECT subject_id FROM subjects
               WHERE user_id = ? AND LOWER(subject_name) = LOWER(?)""",
            (session["user_id"], subject_name)
        ).fetchone()

        if existing_subject:
            return jsonify({
                "message": "This subject already exists"
            }), 409

        # Add the subject if it does not already exist.
        connection.execute(
            "INSERT INTO subjects (user_id, subject_name) VALUES (?, ?)",
            (session["user_id"], subject_name)
        )
        connection.commit()

        return jsonify({"message": "Subject added successfully!"}), 201

    finally:
        connection.close()


@app.route("/subjects/<int:subject_id>", methods=["DELETE"])
@login_required
def delete_subject(subject_id):
    connection = get_db_connection()

    try:
        cursor = connection.execute(
            """DELETE FROM subjects
               WHERE subject_id = ? AND user_id = ?""",
            (subject_id, session["user_id"])
        )
        connection.commit()

        if cursor.rowcount == 0:
            return jsonify({"message": "Subject not found"}), 404

        return jsonify({"message": "Subject deleted successfully!"}), 200

    finally:
        connection.close()


@app.route("/tasks/<int:user_id>", methods=["GET"])
@login_required
def get_tasks(user_id):
    if not verify_user_id(user_id):
        return jsonify({"message": "Access denied"}), 403

    connection = get_db_connection()

    try:
        tasks = connection.execute("""
            SELECT
                tasks.task_id,
                tasks.task_name,
                tasks.deadline,
                tasks.completed,
                subjects.subject_name,
                subjects.subject_id
            FROM tasks
            JOIN subjects
            ON tasks.subject_id = subjects.subject_id
            WHERE subjects.user_id = ?
            ORDER BY tasks.deadline ASC
        """, (session["user_id"],)).fetchall()

        return jsonify([dict(task) for task in tasks]), 200

    finally:
        connection.close()


@app.route("/tasks", methods=["POST"])
@login_required
def add_task():
    data = request.get_json(silent=True) or {}

    subject_id = data.get("subject_id")
    task_name = data.get("task_name")
    deadline = data.get("deadline")

    if (
        not isinstance(task_name, str)
        or not isinstance(deadline, str)
        or not task_name.strip()
        or not deadline.strip()
        or not isinstance(subject_id, int)
        or isinstance(subject_id, bool)
    ):
        return jsonify({"message": "All fields are required"}), 400

    connection = get_db_connection()

    try:
        subject = connection.execute(
            """SELECT subject_id FROM subjects
               WHERE subject_id = ? AND user_id = ?""",
            (subject_id, session["user_id"])
        ).fetchone()

        if not subject:
            return jsonify({"message": "Invalid subject"}), 400

        connection.execute(
            """INSERT INTO tasks (subject_id, task_name, deadline)
               VALUES (?, ?, ?)""",
            (subject_id, task_name.strip(), deadline.strip())
        )
        connection.commit()

        return jsonify({"message": "Task added successfully!"}), 201

    finally:
        connection.close()


@app.route("/tasks/<int:task_id>", methods=["PUT"])
@login_required
def update_task(task_id):
    data = request.get_json(silent=True) or {}
    completed = data.get("completed")

    if completed not in [0, 1] or isinstance(completed, bool):
        return jsonify({"message": "Invalid completion status"}), 400

    connection = get_db_connection()

    try:
        cursor = connection.execute("""
            UPDATE tasks
            SET completed = ?
            WHERE task_id = ?
            AND subject_id IN (
                SELECT subject_id FROM subjects WHERE user_id = ?
            )
        """, (completed, task_id, session["user_id"]))

        connection.commit()

        if cursor.rowcount == 0:
            return jsonify({"message": "Task not found"}), 404

        return jsonify({"message": "Task updated successfully!"}), 200

    finally:
        connection.close()


@app.route("/tasks/<int:task_id>", methods=["DELETE"])
@login_required
def delete_task(task_id):
    connection = get_db_connection()

    try:
        cursor = connection.execute("""
            DELETE FROM tasks
            WHERE task_id = ?
            AND subject_id IN (
                SELECT subject_id FROM subjects WHERE user_id = ?
            )
        """, (task_id, session["user_id"]))

        connection.commit()

        if cursor.rowcount == 0:
            return jsonify({"message": "Task not found"}), 404

        return jsonify({"message": "Task deleted successfully!"}), 200

    finally:
        connection.close()


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
