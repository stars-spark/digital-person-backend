"""
SQLite 会话存储。

表结构：
  conversations - 每轮问答一行，存 session_id / scenic_id / 用户问 / AI答 / 情绪 / 时间戳
"""

import sqlite3
from contextlib import contextmanager
from pathlib import Path

from backend.core.config import settings

DB_PATH: Path = settings.vector_store_dir.parent / "conversations.db"


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id   TEXT    NOT NULL,
                scenic_id    TEXT    NOT NULL DEFAULT 'lingshan',
                user_message TEXT    NOT NULL,
                ai_reply     TEXT    NOT NULL,
                emotion      TEXT    NOT NULL DEFAULT 'neutral',
                context_used INTEGER NOT NULL DEFAULT 1,
                created_at   TEXT    NOT NULL
                             DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_scenic_time ON conversations(scenic_id, created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_session      ON conversations(session_id)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS digital_human_config (
                scenic_id    TEXT PRIMARY KEY,
                avatar_id    TEXT NOT NULL DEFAULT 'female_elegant',
                avatar_name  TEXT NOT NULL DEFAULT '素雅女性',
                voice_id     TEXT NOT NULL DEFAULT 'voice_gentle_f',
                voice_name   TEXT NOT NULL DEFAULT '温柔女声',
                updated_at   TEXT NOT NULL
                             DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
            )
        """)
        conn.commit()


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def save_conversation(
    session_id: str,
    scenic_id: str,
    user_message: str,
    ai_reply: str,
    emotion: str,
    context_used: bool,
) -> None:
    with get_db() as conn:
        conn.execute(
            """INSERT INTO conversations
               (session_id, scenic_id, user_message, ai_reply, emotion, context_used)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (session_id, scenic_id, user_message, ai_reply, emotion, int(context_used)),
        )
