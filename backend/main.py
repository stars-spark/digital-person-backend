import os
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
for _var in ("ALL_PROXY", "all_proxy", "HTTPS_PROXY", "https_proxy",
             "HTTP_PROXY", "http_proxy"):
    os.environ.pop(_var, None)

from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from backend.api.chat import router as chat_router
from backend.api.knowledge import router as kb_router
from backend.api.analytics import router as analytics_router
from backend.api.multimodal import router as mm_router
from backend.api.digital_human import router as dh_router
from backend.api.asr import router as asr_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 初始化 SQLite（建表，幂等）
    from backend.db.database import init_db
    init_db()

    from backend.core.config import settings
    if settings.deploy_mode == "local":
        print("预热嵌入模型（BGE-M3）...")
        from backend.rag.embedder import get_embedder
        get_embedder()
        print("预热重排模型（BGE-Reranker）...")
        from backend.rag.retriever import get_reranker
        get_reranker()
        print("本地模型预热完成，服务就绪")
    else:
        print("云端模式（DashScope），服务就绪")
    yield


app = FastAPI(title="景区导览AI数字人", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(mm_router)
app.include_router(kb_router)
app.include_router(analytics_router)
app.include_router(dh_router)
app.include_router(asr_router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/test", include_in_schema=False)
def test_ui():
    """后端托管测试面板，避免 file:// 跨域问题。"""
    p = Path(__file__).resolve().parent.parent / "test_ui.html"
    return FileResponse(p, media_type="text/html")
