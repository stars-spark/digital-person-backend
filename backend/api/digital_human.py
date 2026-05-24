from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.db.database import get_db

router = APIRouter(prefix="/digital-human", tags=["digital-human"])

# 预置形象与音色列表（厂商 SDK 接入后替换为真实 ID）
_AVATAR_PRESETS = [
    {"id": "female_elegant",  "name": "素雅女性",   "style": "古典",   "gender": "female"},
    {"id": "female_young",    "name": "活泼女性",   "style": "现代",   "gender": "female"},
    {"id": "male_mature",     "name": "沉稳男性",   "style": "古典",   "gender": "male"},
    {"id": "male_young",      "name": "阳光男性",   "style": "现代",   "gender": "male"},
]

_VOICE_PRESETS = [
    {"id": "voice_gentle_f",  "name": "温柔女声",  "gender": "female", "style": "gentle"},
    {"id": "voice_lively_f",  "name": "活泼女声",  "gender": "female", "style": "lively"},
    {"id": "voice_calm_m",    "name": "沉稳男声",  "gender": "male",   "style": "calm"},
    {"id": "voice_bright_m",  "name": "明朗男声",  "gender": "male",   "style": "bright"},
]

_DEFAULT_CONFIG = {
    "avatar_id":   "female_elegant",
    "avatar_name": "素雅女性",
    "voice_id":    "voice_gentle_f",
    "voice_name":  "温柔女声",
}


class ConfigIn(BaseModel):
    scenic_id:   str
    avatar_id:   str
    avatar_name: str
    voice_id:    str
    voice_name:  str


def _row_to_dict(row) -> dict:
    return {
        "scenic_id":   row["scenic_id"],
        "avatar_id":   row["avatar_id"],
        "avatar_name": row["avatar_name"],
        "voice_id":    row["voice_id"],
        "voice_name":  row["voice_name"],
        "updated_at":  row["updated_at"],
    }


@router.get("/presets")
def get_presets():
    """返回可供选择的形象与音色列表。"""
    return {"avatars": _AVATAR_PRESETS, "voices": _VOICE_PRESETS}


@router.get("/config")
def get_config(scenic_id: str = "default"):
    """
    获取指定景区的数字人配置。
    若该景区未单独配置，回落到 'default'；若 default 也没有，返回内置默认值。
    """
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM digital_human_config WHERE scenic_id = ?", (scenic_id,)
        ).fetchone()
        if row:
            return _row_to_dict(row)

        # 回落到 default
        if scenic_id != "default":
            row = conn.execute(
                "SELECT * FROM digital_human_config WHERE scenic_id = 'default'"
            ).fetchone()
            if row:
                return {**_row_to_dict(row), "scenic_id": scenic_id, "fallback": True}

    return {**_DEFAULT_CONFIG, "scenic_id": scenic_id, "updated_at": None, "fallback": True}


@router.get("/config/all")
def get_all_configs():
    """返回所有景区的配置快照（管理后台列表页用）。"""
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM digital_human_config ORDER BY scenic_id").fetchall()
    return [_row_to_dict(r) for r in rows]


@router.put("/config")
def put_config(body: ConfigIn):
    """
    新建或更新指定景区的数字人配置（UPSERT）。
    scenic_id='default' 表示全局默认，其余景区未设置时回落到它。
    """
    avatar_ids = {a["id"] for a in _AVATAR_PRESETS}
    voice_ids  = {v["id"] for v in _VOICE_PRESETS}
    if body.avatar_id not in avatar_ids:
        raise HTTPException(status_code=400, detail=f"无效 avatar_id: {body.avatar_id}")
    if body.voice_id not in voice_ids:
        raise HTTPException(status_code=400, detail=f"无效 voice_id: {body.voice_id}")

    with get_db() as conn:
        conn.execute(
            """INSERT INTO digital_human_config
                   (scenic_id, avatar_id, avatar_name, voice_id, voice_name, updated_at)
               VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
               ON CONFLICT(scenic_id) DO UPDATE SET
                   avatar_id   = excluded.avatar_id,
                   avatar_name = excluded.avatar_name,
                   voice_id    = excluded.voice_id,
                   voice_name  = excluded.voice_name,
                   updated_at  = excluded.updated_at""",
            (body.scenic_id, body.avatar_id, body.avatar_name,
             body.voice_id, body.voice_name),
        )
    return {"ok": True, "scenic_id": body.scenic_id}
