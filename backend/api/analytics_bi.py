"""管理端「传统文旅 BI」分析接口（数据源=赛题行为数据 xlsx + 合成补充数据）。
与会话类 analytics（情感/热点/盲区/预警，数据源 SQLite）互补：本模块挖人口/消费/景点/满意度。
供队友数据大屏 ECharts 直接 fetch（CORS 已全开）。契约见 API_DOC.md「数据大屏 BI」节。
"""
from pathlib import Path
from functools import lru_cache

import numpy as np
import pandas as pd
from fastapi import APIRouter

router = APIRouter(prefix="/analytics/bi", tags=["analytics-bi"])

_ROOT = Path(__file__).resolve().parents[2]
_PKG = _ROOT / "示范景区公开资料包"
_XLSX = _PKG / "景点景区旅游数据行为分析数据.xlsx"
_SYNTH = _PKG / "synthetic_behavior.csv"

# scenic_id → 行为数据里的景点名（与造数脚本/前端 SCENICS 一致）
SCENIC_NAME = {
    "lingshan": "灵山胜境", "nihuawan": "拈花湾", "xihu": "西湖", "huangshan": "黄山",
    "gugong": "故宫", "zhangjiajie": "张家界", "bingmayong": "兵马俑", "mogaoku": "莫高窟",
}
_COLS = ["age", "gender", "attraction_name", "attraction_type", "visit_date",
         "stay_duration", "ticket_cost", "food_cost", "shopping_cost",
         "transport_cost", "entertainment_cost", "total_cost", "group_size", "satisfaction"]


@lru_cache(maxsize=1)
def _data() -> pd.DataFrame:
    """合并真实 xlsx + 合成数据，缓存（首次 ~2-3s）。"""
    frames = []
    if _SYNTH.exists():
        frames.append(pd.read_csv(_SYNTH))
    if _XLSX.exists():
        try:
            frames.append(pd.read_excel(_XLSX, usecols=lambda c: c in _COLS + ["attraction_name"]))
        except Exception:
            pass
    df = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(columns=_COLS)
    for c in ["age", "stay_duration", "ticket_cost", "food_cost", "shopping_cost",
              "transport_cost", "entertainment_cost", "total_cost", "group_size", "satisfaction"]:
        if c in df:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    return df


def _scope(scenic_id: str | None, days: int = 0) -> pd.DataFrame:
    """按景区（+可选近 days 天）切片。days<=0 取全部。日期相对数据集内最新 visit_date。"""
    df = _data()
    if scenic_id and scenic_id != "all":
        name = SCENIC_NAME.get(scenic_id, scenic_id)
        df = df[df["attraction_name"] == name]
    if days and days > 0 and "visit_date" in df.columns and not df.empty:
        dt = pd.to_datetime(df["visit_date"], errors="coerce")
        latest = dt.max()
        if pd.notna(latest):
            df = df[dt >= latest - pd.Timedelta(days=days - 1)]
    return df


@router.get("/overview")
def overview(scenic_id: str = "lingshan", days: int = 0):
    """核心 KPI：游客数 / 客单价 / 总营收 / 平均满意度 / 平均停留 / 人均同行。
    days>0 仅统计近 N 天（1=今日 / 7=本周 / 30=本月，相对数据集最新日期）。"""
    d = _scope(scenic_id, days)
    if d.empty:
        return {"scenic_id": scenic_id, "visitors": 0}
    return {
        "scenic_id": scenic_id,
        "visitors": int(len(d)),
        "avg_spend_per_capita": round(float(d["total_cost"].mean()), 1),    # 客单价
        "total_revenue": round(float(d["total_cost"].sum()), 0),            # 总营收
        "avg_satisfaction": round(float(d["satisfaction"].mean()), 2),
        "avg_stay_hours": round(float(d["stay_duration"].mean()), 1),
        "avg_group_size": round(float(d["group_size"].mean()), 1),
    }


@router.get("/spending")
def spending(scenic_id: str = "lingshan", days: int = 0):
    """消费结构（6 类均值+占比）+ 客单价分布直方。days>0 仅近 N 天。"""
    d = _scope(scenic_id, days)
    if d.empty:
        return {"scenic_id": scenic_id, "structure": [], "histogram": []}
    cats = [("门票", "ticket_cost"), ("餐饮", "food_cost"), ("购物", "shopping_cost"),
            ("交通", "transport_cost"), ("娱乐", "entertainment_cost")]
    means = {label: float(d[col].mean()) for label, col in cats}
    tot = sum(means.values()) or 1
    structure = [{"category": k, "avg": round(v, 1), "ratio": round(v / tot, 3)} for k, v in means.items()]
    bins = [0, 500, 1000, 1500, 2000, 1e9]
    labels = ["<500", "500-1000", "1000-1500", "1500-2000", "2000+"]
    hist = pd.cut(d["total_cost"], bins=bins, labels=labels, right=False).value_counts().sort_index()
    return {
        "scenic_id": scenic_id,
        "avg_total": round(float(d["total_cost"].mean()), 1),
        "structure": structure,
        "histogram": [{"range": str(k), "count": int(v)} for k, v in hist.items()],
    }


@router.get("/demographics")
def demographics(scenic_id: str = "lingshan", days: int = 0):
    """人口画像：年龄段 / 性别 / 同行规模分布。days>0 仅近 N 天。"""
    d = _scope(scenic_id, days)
    if d.empty:
        return {"scenic_id": scenic_id, "age": [], "gender": [], "group_size": []}
    abins = [0, 18, 26, 36, 46, 56, 66, 200]
    alabels = ["<18", "18-25", "26-35", "36-45", "46-55", "56-65", "65+"]
    age = pd.cut(d["age"], bins=abins, labels=alabels, right=False).value_counts().sort_index()
    gender = d["gender"].value_counts()
    grp = d["group_size"].value_counts().sort_index()
    return {
        "scenic_id": scenic_id,
        "age": [{"range": str(k), "count": int(v)} for k, v in age.items()],
        "gender": [{"gender": str(k), "count": int(v)} for k, v in gender.items()],
        "group_size": [{"size": int(k), "count": int(v)} for k, v in grp.items()],
    }


@router.get("/scenics")
def scenics(managed_only: bool = False):
    """可选景区/景点清单（供前端下拉），含样本量。
    默认列出**数据集里所有景点**（赛题 xlsx 全部景区 + 我方 8 个），`managed`=是否本产品接入。
    其余 BI 端点的 `scenic_id` 既接受我方 8 个 id（lingshan…），也直接接受 xlsx 里的景点名
    （如 `同里古镇`），故此处返回的 `scenic_id` 拿去查 overview/spending/demographics 都通。
    `managed_only=true` 时只返回我方 8 个。"""
    d = _data()
    counts = d["attraction_name"].value_counts().to_dict() if not d.empty else {}
    managed_names = set(SCENIC_NAME.values())
    items = [{"scenic_id": sid, "name": name, "samples": int(counts.get(name, 0)), "managed": True}
             for sid, name in SCENIC_NAME.items()]
    if not managed_only:
        # 追加 xlsx 里其余所有景点（非我方 8 个），scenic_id 就用景点名本身
        others = [{"scenic_id": str(name), "name": str(name), "samples": int(cnt), "managed": False}
                  for name, cnt in counts.items()
                  if name not in managed_names and str(name) != "nan"]
        others.sort(key=lambda x: x["samples"], reverse=True)
        items = items + others
    return {"scenics": items, "count": len(items)}


@router.get("/attractions")
def attractions(limit: int = 10, managed_only: bool = False):
    """景点热度排名（访问量）+ 各景点客单价/满意度/停留 + 类型偏好。
    managed_only=True 时仅统计本产品接入的 8 个景区（演示用，名称可辨识）；
    默认 False 为数据集全域视图。"""
    d = _data()
    if managed_only and not d.empty:
        d = d[d["attraction_name"].isin(SCENIC_NAME.values())]
    if d.empty:
        return {"ranking": [], "by_type": []}
    g = d.groupby("attraction_name").agg(
        visitors=("attraction_name", "size"),
        avg_spend=("total_cost", "mean"),
        avg_satisfaction=("satisfaction", "mean"),
        avg_stay=("stay_duration", "mean"),
    ).reset_index().sort_values("visitors", ascending=False)
    ranking = [{"attraction": r["attraction_name"], "visitors": int(r["visitors"]),
                "avg_spend": round(float(r["avg_spend"]), 1),
                "avg_satisfaction": round(float(r["avg_satisfaction"]), 2),
                "avg_stay": round(float(r["avg_stay"]), 1)} for _, r in g.head(limit).iterrows()]
    by_type = d["attraction_type"].value_counts()
    return {
        "ranking": ranking,
        "by_type": [{"type": str(k), "count": int(v)} for k, v in by_type.items() if str(k) != "nan"],
    }
