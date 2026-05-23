from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    # DashScope (通义千问)
    dashscope_api_key: str = ""
    llm_model: str = "qwen-max-latest"
    vl_model: str = "qwen-vl-max-latest"

    # 部署模式：local（本地GPU）或 cloud（阿里云，用DashScope Embedding）
    deploy_mode: str = "local"

    # 本地模型（deploy_mode=local 时使用）
    embedding_model: str = "BAAI/bge-m3"
    reranker_model: str = "BAAI/bge-reranker-v2-m3"

    # RAG 参数
    chunk_size: int = 512
    chunk_overlap: int = 128
    dense_top_k: int = 10
    sparse_top_k: int = 10
    rerank_top_k: int = 4

    # 路径
    vector_store_dir: Path = BASE_DIR / "vector_store"
    knowledge_base_dir: Path = BASE_DIR / "knowledge_base"

    class Config:
        env_file = BASE_DIR / ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
