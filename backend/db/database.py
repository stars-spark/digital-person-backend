"""
SQLite 会话存储。

表结构：
  conversations - 每轮问答一行，存 session_id / scenic_id / 用户问 / AI答 / 情绪 / 时间戳（服务端自动埋点）
  events        - 客户端主动上报的行为事件（画像/功能使用/到访/满意度等服务端看不到的信号）
  scenic_theme  - 景区主题色覆盖（管理端 PUT 覆盖默认；客户端切景区时套用）
"""

import json
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
            CREATE TABLE IF NOT EXISTS events (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  TEXT NOT NULL,
                scenic_id   TEXT NOT NULL DEFAULT 'lingshan',
                type        TEXT NOT NULL,
                group_type  TEXT,
                lang        TEXT,
                payload     TEXT,
                created_at  TEXT NOT NULL
                            DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_evt_type_time ON events(type, created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_evt_scenic    ON events(scenic_id, created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_evt_session   ON events(session_id)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS scenic_theme (
                scenic_id     TEXT PRIMARY KEY,
                name          TEXT,
                primary_color TEXT,
                sweet_color   TEXT,
                updated_at    TEXT NOT NULL
                              DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
            )
        """)
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
        # 数字人场景背景（'' = 原始灰底，兼容旧库/旧行为）
        _ensure_columns(conn, "digital_human_config", {
            "background_id":   "TEXT NOT NULL DEFAULT ''",
            "background_name": "TEXT NOT NULL DEFAULT ''",
        })
        # 管理端上传的自定义背景登记（合成由本地脚本 gen_avatar_background.py sync 拉取执行）
        conn.execute("""
            CREATE TABLE IF NOT EXISTS dh_background (
                bg_id      TEXT PRIMARY KEY,
                name       TEXT NOT NULL,
                scenic_id  TEXT,
                source     TEXT NOT NULL DEFAULT 'upload',
                status     TEXT NOT NULL DEFAULT 'pending',
                file_path  TEXT NOT NULL,
                created_at TEXT NOT NULL
                           DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
            )
        """)
        # 管理端可编辑的 FAQ 知识条目（新增/编辑即同步进 RAG 向量库，id 稳定→可增量 upsert）
        conn.execute("""
            CREATE TABLE IF NOT EXISTS faq_items (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                scenic_id  TEXT NOT NULL DEFAULT 'lingshan',
                question   TEXT NOT NULL,
                answer     TEXT NOT NULL,
                category   TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now','localtime')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now','localtime'))
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_faq_scenic ON faq_items(scenic_id)")
        # 管理端可编辑的文本段落（同样同步进 RAG）
        conn.execute("""
            CREATE TABLE IF NOT EXISTS text_items (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                scenic_id  TEXT NOT NULL DEFAULT 'lingshan',
                title      TEXT NOT NULL DEFAULT '',
                content    TEXT NOT NULL,
                category   TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now','localtime')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now','localtime'))
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_text_scenic ON text_items(scenic_id)")
        # 上传文档登记（真实记录文件名/大小/时间/状态，前端文档列表从此查，告别假文件名）
        conn.execute("""
            CREATE TABLE IF NOT EXISTS uploaded_docs (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                scenic_id  TEXT NOT NULL DEFAULT 'lingshan',
                filename   TEXT NOT NULL,
                size_bytes INTEGER NOT NULL DEFAULT 0,
                chunks     INTEGER NOT NULL DEFAULT 0,
                status     TEXT NOT NULL DEFAULT 'indexed',
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now','localtime'))
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_doc_scenic ON uploaded_docs(scenic_id)")
        conn.commit()


def _ensure_columns(conn, table: str, cols: dict[str, str]) -> None:
    """幂等补列：SQLite 无 ADD COLUMN IF NOT EXISTS，先查 PRAGMA 再 ALTER。"""
    existing = {r[1] for r in conn.execute(f"PRAGMA table_info({table})")}
    for name, ddl in cols.items():
        if name not in existing:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")


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


def save_event(
    session_id: str,
    scenic_id: str,
    type: str,
    group_type: str | None = None,
    lang: str | None = None,
    payload: dict | None = None,
) -> None:
    """落库一条客户端上报事件。payload 存 JSON 字符串，容错（坏 payload 不抛）。"""
    try:
        payload_str = json.dumps(payload, ensure_ascii=False) if payload else None
    except (TypeError, ValueError):
        payload_str = None
    with get_db() as conn:
        conn.execute(
            """INSERT INTO events (session_id, scenic_id, type, group_type, lang, payload)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (session_id, scenic_id, type, group_type, lang, payload_str),
        )


def load_theme_override(scenic_id: str) -> dict | None:
    """读某景区的主题覆盖；无则 None。只返回非空字段。"""
    with get_db() as conn:
        row = conn.execute(
            "SELECT name, primary_color, sweet_color FROM scenic_theme WHERE scenic_id=?",
            (scenic_id,),
        ).fetchone()
    if not row:
        return None
    out = {}
    if row["name"]:          out["name"] = row["name"]
    if row["primary_color"]: out["primary"] = row["primary_color"]
    if row["sweet_color"]:   out["sweet"] = row["sweet_color"]
    return out or None


def save_theme(scenic_id: str, name: str | None, primary: str | None, sweet: str | None) -> None:
    """管理端覆盖某景区主题（部分字段：保留已有、只更新传入的非空项）。"""
    with get_db() as conn:
        conn.execute(
            """INSERT INTO scenic_theme (scenic_id, name, primary_color, sweet_color, updated_at)
               VALUES (?, ?, ?, ?, strftime('%Y-%m-%d %H:%M:%S','now','localtime'))
               ON CONFLICT(scenic_id) DO UPDATE SET
                 name          = COALESCE(excluded.name, scenic_theme.name),
                 primary_color = COALESCE(excluded.primary_color, scenic_theme.primary_color),
                 sweet_color   = COALESCE(excluded.sweet_color, scenic_theme.sweet_color),
                 updated_at    = excluded.updated_at""",
            (scenic_id, name, primary, sweet),
        )
