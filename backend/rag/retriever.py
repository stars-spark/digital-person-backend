"""
混合检索器：稠密（BGE-M3/DashScope）+ 稀疏（BM25）→ 融合排序 → BGE Reranker 精排。

延迟优化：
- 云端模式下 retrieve_async() 用 asyncio.gather 让 DashScope embed 和 BM25 并行执行
- BM25 无需 embedding，约 20-50ms，原先等 embed 结束才算，现在节省这段时间
"""

import asyncio
import os
from typing import List

os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
for _var in ("ALL_PROXY", "all_proxy", "HTTPS_PROXY", "https_proxy",
             "HTTP_PROXY", "http_proxy"):
    os.environ.pop(_var, None)

import chromadb
from rank_bm25 import BM25Okapi

from backend.core.config import settings

_reranker = None


def get_reranker():
    global _reranker
    if _reranker is None:
        from huggingface_hub import snapshot_download
        from FlagEmbedding import FlagReranker
        local_path = snapshot_download(
            repo_id=settings.reranker_model,
            ignore_patterns=["*.DS_Store", "imgs/*", "*.h5", "flax_model*",
                             "rust_model*", "tf_model*"],
        )
        _reranker = FlagReranker(local_path, use_fp16=True)
    return _reranker


def get_collection(scenic_id: str) -> chromadb.Collection:
    client = chromadb.PersistentClient(path=str(settings.vector_store_dir))
    return client.get_or_create_collection(
        name=f"scenic_{scenic_id}",
        metadata={"hnsw:space": "cosine"},
    )


def _embed_query_sync(query: str) -> List[float]:
    if settings.deploy_mode == "cloud":
        from backend.rag.embedder_dashscope import embed_texts_cloud
        return embed_texts_cloud([query])[0]
    from backend.rag.embedder import embed_texts
    return embed_texts([query])[0]


def _bm25_search(query: str, all_docs: List[str], top_k: int) -> List[str]:
    tokenized = [list(d) for d in all_docs]
    bm25 = BM25Okapi(tokenized)
    scores = bm25.get_scores(list(query))
    top_k = min(top_k, len(all_docs))
    indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]
    return [all_docs[i] for i in indices]


def _dense_search(query_vec: List[float], collection: chromadb.Collection,
                  dense_k: int) -> List[str]:
    result = collection.query(
        query_embeddings=[query_vec],
        n_results=dense_k,
        include=["documents"],
    )
    return result["documents"][0]


def retrieve(query: str, scenic_id: str) -> List[str]:
    """同步检索（本地模式 + 兜底）。"""
    collection = get_collection(scenic_id)
    total_docs = collection.count()
    if total_docs == 0:
        return []

    query_vec = _embed_query_sync(query)
    dense_k = min(settings.dense_top_k, total_docs)
    dense_docs = _dense_search(query_vec, collection, dense_k)

    all_docs: List[str] = collection.get(include=["documents"])["documents"]
    sparse_docs = _bm25_search(query, all_docs, settings.sparse_top_k)

    candidates = list(dict.fromkeys(dense_docs + sparse_docs))

    if settings.deploy_mode == "cloud":
        return candidates[: settings.rerank_top_k]

    reranker = get_reranker()
    pairs = [[query, doc] for doc in candidates]
    rerank_scores = reranker.compute_score(pairs, normalize=True)
    ranked = sorted(zip(rerank_scores, candidates), key=lambda x: x[0], reverse=True)
    return [doc for _, doc in ranked[: settings.rerank_top_k]]


async def retrieve_async(query: str, scenic_id: str) -> List[str]:
    """
    异步检索（云端模式专用）。

    关键优化：DashScope embed（~400ms 网络IO）和 BM25（~30ms CPU）并行执行，
    BM25 不再等 embed 结束，节省约 30-80ms。
    """
    collection = get_collection(scenic_id)
    total_docs = collection.count()
    if total_docs == 0:
        return []

    # 提前取所有文档（BM25 需要），这一步很快（本地 SQLite）
    all_docs: List[str] = collection.get(include=["documents"])["documents"]

    loop = asyncio.get_event_loop()

    # 并行：embed（网络IO）+ BM25（CPU）
    query_vec, sparse_docs = await asyncio.gather(
        loop.run_in_executor(None, _embed_query_sync, query),
        loop.run_in_executor(None, _bm25_search, query, all_docs, settings.sparse_top_k),
    )

    dense_k = min(settings.dense_top_k, total_docs)
    dense_docs = _dense_search(query_vec, collection, dense_k)

    candidates = list(dict.fromkeys(dense_docs + sparse_docs))
    return candidates[: settings.rerank_top_k]
