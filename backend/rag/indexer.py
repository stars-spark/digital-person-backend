"""
知识库入库：把文档分块、向量化、存入对应景区的 ChromaDB collection。
"""

from pathlib import Path
from typing import List
import uuid
import chromadb

from backend.rag.loader import load_docx_as_chunks
from backend.rag.retriever import get_collection
from backend.core.config import settings


def _embed(texts):
    if settings.deploy_mode == "cloud":
        from backend.rag.embedder_dashscope import embed_texts_cloud
        return embed_texts_cloud(texts)
    from backend.rag.embedder import embed_texts
    return embed_texts(texts)


def index_documents(file_paths: List[Path], scenic_id: str) -> int:
    """
    将文档列表入库到指定景区的 collection。
    返回本次入库的 chunk 总数。
    """
    collection = get_collection(scenic_id)

    all_chunks: List[dict] = []
    for path in file_paths:
        if path.suffix.lower() == ".docx":
            chunks = load_docx_as_chunks(
                path,
                chunk_size=settings.chunk_size,
                overlap=settings.chunk_overlap,
            )
            all_chunks.extend(chunks)

    if not all_chunks:
        return 0

    texts = [c["text"] for c in all_chunks]
    embeddings = _embed(texts)

    collection.add(
        ids=[str(uuid.uuid4()) for _ in texts],
        documents=texts,
        embeddings=embeddings,
        metadatas=[{"source": c["source"]} for c in all_chunks],
    )
    return len(texts)


def clear_scenic(scenic_id: str) -> None:
    """清空某景区的知识库（重新上传时先清空）。"""
    client = chromadb.PersistentClient(path=str(settings.vector_store_dir))
    try:
        client.delete_collection(f"scenic_{scenic_id}")
    except Exception:
        pass
