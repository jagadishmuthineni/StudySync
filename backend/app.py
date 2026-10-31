
import sqlite3
import os

from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app)

DATABASE = os.path.join(os.path.dirname(__file__), "studysync.db")


def get_db_connection():
    connection = sqlite3.connect(DATABASE)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.row_factory = sqlite3.Row
    return connection


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


@app.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not name or not email or not password:
        return jsonify({"message": "All fields are required"}), 400

    if len(password) < 8:
        return jsonify({"message": "Password must contain at least 8 characters"}), 400

    password_hash = generate_password_hash(password)

    try:
        connection = get_db_connection()
        connection.execute(
            "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
            (name, email, password_hash)
        )
        connection.commit()
        connection.close()
        return jsonify({"message": "Registration successful!"}), 201

    except sqlite3.IntegrityError:
        return jsonify({"message": "Email already registered"}), 409


@app.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({"message": "Email and password are required"}), 400

    connection = get_db_connection()
    user = connection.execute(
        "SELECT * FROM users WHERE email = ?",
        (email,)
    ).fetchone()
    connection.close()

    if user and check_password_hash(user['password_hash'], password):
        return jsonify({
            "message": "Login successful!",
            "user": {
                "id": user['user_id'],
                "name": user['name'],
                "email": user['email']
            }
        }), 200

    return jsonify({"message": "Invalid email or password"}), 401


@app.route('/subjects/<int:user_id>', methods=['GET'])
def get_subjects(user_id):
    connection = get_db_connection()

    subjects = connection.execute(
        "SELECT * FROM subjects WHERE user_id = ?",
        (user_id,)
    ).fetchall()

    connection.close()
    return jsonify([dict(subject) for subject in subjects]), 200


@app.route('/subjects', methods=['POST'])
def add_subject():
    data = request.get_json(silent=True) or {}

    user_id = data.get('user_id')
    subject_name = data.get('subject_name', '').strip()

    if not user_id or not subject_name:
        return jsonify({"message": "User ID and subject name are required"}), 400

    connection = get_db_connection()

    try:
        connection.execute(
            "INSERT INTO subjects (user_id, subject_name) VALUES (?, ?)",
            (user_id, subject_name)
        )
        connection.commit()
        connection.close()
        return jsonify({"message": "Subject added successfully!"}), 201

    except sqlite3.IntegrityError:
        connection.close()
        return jsonify({"message": "Invalid student account"}), 400


# Delete a subject
@app.route('/subjects/<int:subject_id>', methods=['DELETE'])
def delete_subject(subject_id):
    connection = get_db_connection()

    cursor = connection.execute(
        "DELETE FROM subjects WHERE subject_id = ?",
        (subject_id,)
    )

    connection.commit()
    connection.close()

    if cursor.rowcount == 0:
        return jsonify({"message": "Subject not found"}), 404

    return jsonify({"message": "Subject deleted successfully!"}), 200


@app.route('/')
def home():
    return jsonify({
        "message": "Welcome to StudySync Backend!",
        "status": "Running successfully"
    })


if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
