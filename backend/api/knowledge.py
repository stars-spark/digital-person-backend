import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
import chromadb

from backend.rag.indexer import index_documents, clear_scenic
from backend.core.config import settings

router = APIRouter(prefix="/kb", tags=["knowledge-base"])


@router.post("/upload")
async def upload_documents(
    scenic_id: str = Form(...),
    files: list[UploadFile] = File(...),
    replace: bool = Form(False),
):
    """上传文档并入库。replace=True 时先清空该景区知识库。"""
    save_dir = settings.knowledge_base_dir / scenic_id
    save_dir.mkdir(parents=True, exist_ok=True)

    if replace:
        clear_scenic(scenic_id)

    saved_paths: list[Path] = []
    for file in files:
        dest = save_dir / file.filename
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)
        saved_paths.append(dest)

    count = index_documents(saved_paths, scenic_id)
    return {"scenic_id": scenic_id, "files": len(saved_paths), "chunks_indexed": count}


@router.get("/list")
async def list_knowledge_bases():
    """查询所有景区知识库的 chunk 数量。"""
    client = chromadb.PersistentClient(path=str(settings.vector_store_dir))
    result = {}
    for col in client.list_collections():
        scenic_id = col.name.removeprefix("scenic_")
        result[scenic_id] = col.count()
    return result


@router.delete("/{scenic_id}")
async def delete_knowledge_base(scenic_id: str):
    clear_scenic(scenic_id)
    return {"deleted": scenic_id}
