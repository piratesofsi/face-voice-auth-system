#!/usr/bin/env python3
"""
Reset script to clear database and embeddings for fresh testing.
"""
import os
import sqlite3
from pathlib import Path

DB_PATH = "database/users.db"
FACES_DIR = "embeddings/faces"
VOICES_DIR = "embeddings/voices"

def reset_database():
    """Clear all data from the database."""
    try:
        if os.path.exists(DB_PATH):
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            # Get counts before deletion
            cursor.execute("SELECT COUNT(*) FROM users")
            user_count = cursor.fetchone()[0] if cursor.description else 0
            cursor.execute("SELECT COUNT(*) FROM access_logs")
            log_count = cursor.fetchone()[0] if cursor.description else 0
            
            # Delete all data (don't drop tables, just clear them)
            cursor.execute("DELETE FROM access_logs")
            cursor.execute("DELETE FROM users")
            cursor.execute("DELETE FROM sqlite_sequence")  # Reset auto-increment
            
            conn.commit()
            conn.close()
            print(f"✓ Database cleared: {DB_PATH}")
            if user_count > 0:
                print(f"  Deleted {user_count} users")
            if log_count > 0:
                print(f"  Deleted {log_count} access logs")
        else:
            print(f"✓ Database not found (already clean): {DB_PATH}")
    except Exception as e:
        print(f"✗ Error clearing database: {e}")

def reset_embeddings():
    """Delete all stored embeddings."""
    for dir_path, dir_name in [(FACES_DIR, "Face"), (VOICES_DIR, "Voice")]:
        try:
            if os.path.exists(dir_path):
                files = list(Path(dir_path).glob("*.pkl"))
                for f in files:
                    os.remove(f)
                    print(f"  Deleted: {f.name}")
                if files:
                    print(f"✓ Cleared {dir_name} embeddings ({len(files)} files)")
                else:
                    print(f"✓ {dir_name} embeddings already clean")
        except Exception as e:
            print(f"✗ Error clearing {dir_name} embeddings: {e}")

def reinit_db():
    """Reinitialize the database with fresh schema."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                name          TEXT NOT NULL,
                email         TEXT UNIQUE NOT NULL,
                password_hash TEXT,
                auth_method   TEXT DEFAULT 'face',
                role          TEXT DEFAULT 'user',
                is_active     INTEGER DEFAULT 1,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS access_logs (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER,
                user_name  TEXT,
                email      TEXT,
                method     TEXT,
                status     TEXT,
                logged_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        conn.commit()
        conn.close()
        print(f"✓ Database reinitialized: {DB_PATH}")
    except Exception as e:
        print(f"✗ Error reinitializing database: {e}")

if __name__ == "__main__":
    print("\n" + "="*50)
    print("RESETTING FOR FRESH TESTING")
    print("="*50 + "\n")
    
    reset_database()
    reset_embeddings()
    reinit_db()
    
    print("\n" + "="*50)
    print("✓ RESET COMPLETE - Ready for fresh testing!")
    print("="*50 + "\n")
