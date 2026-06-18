"""管理端知识库编辑：FAQ / 文本段落 的逐条 CRUD（持久化到 SQLite）+ 实时同步进 RAG 向量库。

与 /kb/upload（整文档上传）互补：这里是管理员手填的细粒度知识条目，新增/编辑即时
以稳定 id upsert 进对应景区的 ChromaDB collection，删除即时移除——游客问答立刻能检索到。
契约见 API_DOC「知识库内容管理」节。供队友管理端前端直接调（经 /rag/kb/... 公网网关）。
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.db.database import get_db
from backend.rag.indexer import upsert_item, delete_item

router = APIRouter(prefix="/kb", tags=["knowledge-base"])


# ───────────────────────── FAQ ─────────────────────────
class FaqIn(BaseModel):
    scenic_id: str = "lingshan"
    question: str
    answer: str
    category: str = ""


def _faq_text(question: str, answer: str) -> str:
    return f"问：{question}\n答：{answer}"


@router.get("/faq")
def list_faq(scenic_id: str | None = None):
    """列出 FAQ（可按 scenic_id 过滤）。"""
    with get_db() as conn:
        if scenic_id:
            rows = conn.execute("SELECT * FROM faq_items WHERE scenic_id=? ORDER BY updated_at DESC", (scenic_id,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM faq_items ORDER BY updated_at DESC").fetchall()
    return {"items": [dict(r) for r in rows]}


@router.post("/faq")
def create_faq(body: FaqIn):
    """新增 FAQ → 落库 + 同步进 RAG。"""
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO faq_items (scenic_id, question, answer, category) VALUES (?,?,?,?)",
            (body.scenic_id, body.question, body.answer, body.category),
        )
        new_id = cur.lastrowid
    upsert_item(body.scenic_id, f"faq_{new_id}", _faq_text(body.question, body.answer),
                {"source": "faq", "faq_id": new_id, "category": body.category})
    return {"id": new_id, "scenic_id": body.scenic_id, "synced": True}


@router.put("/faq/{item_id}")
def update_faq(item_id: int, body: FaqIn):
    """编辑 FAQ → 更新库 + 重新同步进 RAG（旧景区若变更则从旧库移除）。"""
    with get_db() as conn:
        old = conn.execute("SELECT scenic_id FROM faq_items WHERE id=?", (item_id,)).fetchone()
        if not old:
            raise HTTPException(404, "FAQ 不存在")
        conn.execute(
            """UPDATE faq_items SET scenic_id=?, question=?, answer=?, category=?,
               updated_at=strftime('%Y-%m-%d %H:%M:%S','now','localtime') WHERE id=?""",
            (body.scenic_id, body.question, body.answer, body.category, item_id),
        )
    if old["scenic_id"] != body.scenic_id:
        delete_item(old["scenic_id"], f"faq_{item_id}")
    upsert_item(body.scenic_id, f"faq_{item_id}", _faq_text(body.question, body.answer),
                {"source": "faq", "faq_id": item_id, "category": body.category})
    return {"id": item_id, "synced": True}


@router.delete("/faq/{item_id}")
def remove_faq(item_id: int):
    """删除 FAQ → 删库 + 从 RAG 移除。"""
    with get_db() as conn:
        row = conn.execute("SELECT scenic_id FROM faq_items WHERE id=?", (item_id,)).fetchone()
        if not row:
            raise HTTPException(404, "FAQ 不存在")
        conn.execute("DELETE FROM faq_items WHERE id=?", (item_id,))
    delete_item(row["scenic_id"], f"faq_{item_id}")
    return {"deleted": item_id}


# ─────────────────────── 文本段落 ───────────────────────
class TextIn(BaseModel):
    scenic_id: str = "lingshan"
    title: str = ""
    content: str
    category: str = ""


def _text_doc(title: str, content: str) -> str:
    return f"{title}\n{content}".strip() if title else content


@router.get("/text")
def list_text(scenic_id: str | None = None):
    with get_db() as conn:
        if scenic_id:
            rows = conn.execute("SELECT * FROM text_items WHERE scenic_id=? ORDER BY updated_at DESC", (scenic_id,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM text_items ORDER BY updated_at DESC").fetchall()
    return {"items": [dict(r) for r in rows]}


@router.post("/text")
def create_text(body: TextIn):
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO text_items (scenic_id, title, content, category) VALUES (?,?,?,?)",
            (body.scenic_id, body.title, body.content, body.category),
        )
        new_id = cur.lastrowid
    upsert_item(body.scenic_id, f"text_{new_id}", _text_doc(body.title, body.content),
                {"source": "text", "text_id": new_id, "category": body.category})
    return {"id": new_id, "scenic_id": body.scenic_id, "synced": True}


@router.put("/text/{item_id}")
def update_text(item_id: int, body: TextIn):
    with get_db() as conn:
        old = conn.execute("SELECT scenic_id FROM text_items WHERE id=?", (item_id,)).fetchone()
        if not old:
            raise HTTPException(404, "文本段落不存在")
        conn.execute(
            """UPDATE text_items SET scenic_id=?, title=?, content=?, category=?,
               updated_at=strftime('%Y-%m-%d %H:%M:%S','now','localtime') WHERE id=?""",
            (body.scenic_id, body.title, body.content, body.category, item_id),
        )
    if old["scenic_id"] != body.scenic_id:
        delete_item(old["scenic_id"], f"text_{item_id}")
    upsert_item(body.scenic_id, f"text_{item_id}", _text_doc(body.title, body.content),
                {"source": "text", "text_id": item_id, "category": body.category})
    return {"id": item_id, "synced": True}


@router.delete("/text/{item_id}")
def remove_text(item_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT scenic_id FROM text_items WHERE id=?", (item_id,)).fetchone()
        if not row:
            raise HTTPException(404, "文本段落不存在")
        conn.execute("DELETE FROM text_items WHERE id=?", (item_id,))
    delete_item(row["scenic_id"], f"text_{item_id}")
    return {"deleted": item_id}


# ─────────────────── 上传文档列表（真实记录） ───────────────────
@router.get("/docs")
def list_docs(scenic_id: str | None = None):
    """已上传文档的真实清单（文件名/大小/chunk数/状态/时间）。供前端文档列表，告别假文件名。"""
    with get_db() as conn:
        if scenic_id:
            rows = conn.execute("SELECT * FROM uploaded_docs WHERE scenic_id=? ORDER BY created_at DESC", (scenic_id,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM uploaded_docs ORDER BY created_at DESC").fetchall()
    return {"docs": [dict(r) for r in rows]}


@router.delete("/docs/{doc_id}")
def remove_doc(doc_id: int):
    """从文档列表移除一条登记（不动向量库整库；整库清空仍走 DELETE /kb/{scenic_id}）。"""
    with get_db() as conn:
        row = conn.execute("SELECT id FROM uploaded_docs WHERE id=?", (doc_id,)).fetchone()
        if not row:
            raise HTTPException(404, "文档记录不存在")
        conn.execute("DELETE FROM uploaded_docs WHERE id=?", (doc_id,))
    return {"deleted": doc_id}
