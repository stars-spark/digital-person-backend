"""客流热度感知：基于真实游客行为数据（14 万行）+ 时段模型，给导游做「错峰/淡旺季」建议。

数据真实部分（来自 示范景区公开资料包/景点景区旅游数据行为分析数据.xlsx）：
  - 各景点访问量 → 热门度基线（灵山胜境/灵山大佛/拈花湾/西湖 均在数据中）
  - visit_date 月份分布 → 真实季节性（旺季 7-9 月）
  - satisfaction / stay_duration → 满意度、平均停留
模型部分（原始数据无小时维度，明确标注为估计）：
  - 时段拥挤曲线 hour_factor(now) → 模拟"今日此刻"的拥挤程度

当前拥挤度 = 热门度基线 × 当月季节因子 × 当前时段因子 → 分档（空闲/适中/较多/繁忙）。
导游据此给「错峰」建议，体现真实导游的「随机应变」职责。
"""
from __future__ import annotations

import datetime as dt
from functools import lru_cache
from pathlib import Path

import pandas as pd

_DATA = Path(__file__).resolve().parents[2] / "示范景区公开资料包" / "景点景区旅游数据行为分析数据.xlsx"

# scenic_id → 数据中的 attraction_name（一个景区可能对应多条）。黄山/故宫不在数据中。
SCENIC_ATTRACTIONS: dict[str, list[str]] = {
    "lingshan": ["灵山胜境", "灵山大佛"],
    "nihuawan": ["禅意小镇·拈花湾"],
    "xihu": ["西湖风景名胜区"],
}

# 景区典型时段拥挤曲线（相对系数 0~1）。原始数据无小时，这是经验模型估计。
_HOUR_CURVE = {
    6: 0.10, 7: 0.20, 8: 0.40, 9: 0.65, 10: 0.88, 11: 1.00, 12: 0.92,
    13: 0.88, 14: 0.98, 15: 0.90, 16: 0.72, 17: 0.52, 18: 0.34, 19: 0.20,
}
# 拥挤度 = 季节因子 × 时段因子（两者都有现实意义；不乘全局热门度，
# 因为本数据是区域级、灵山等占比小，乘了会被压成恒"空闲"）。热门度仅用于排序/展示。
_LEVELS = [(0.40, "空闲"), (0.80, "适中"), (1.30, "较多"), (99, "繁忙")]


def _hour_factor(hour: int) -> float:
    if hour in _HOUR_CURVE:
        return _HOUR_CURVE[hour]
    return 0.10 if hour < 6 or hour > 19 else 0.5


def _level(index: float) -> str:
    for thr, name in _LEVELS:
        if index < thr:
            return name
    return "繁忙"


@lru_cache(maxsize=1)
def _stats() -> dict:
    """读一次 xlsx，缓存：每景点的访问量/满意度/停留/月度分布。"""
    df = pd.read_excel(_DATA)
    g = df.groupby("attraction_name")
    pop = g.size()
    pop_norm = (pop / pop.max()).round(3)
    sat = g["satisfaction"].mean().round(2)
    stay = g["stay_duration"].mean().round(1)
    # 每景点的月度访问量（用于真实季节因子）
    monthly = (
        df.assign(m=df["visit_date"].dt.month)
        .groupby(["attraction_name", "m"]).size()
    )
    return {
        "pop": pop.to_dict(),
        "pop_norm": pop_norm.to_dict(),
        "sat": sat.to_dict(),
        "stay": stay.to_dict(),
        "monthly": monthly,
    }


def _month_factor(attraction: str, month: int) -> float:
    """当月访问量相对该景点月均的倍数（真实季节性）。>1 旺季，<1 淡季。"""
    st = _stats()
    try:
        ms = st["monthly"].loc[attraction]
    except KeyError:
        return 1.0
    mean = ms.mean()
    if mean <= 0:
        return 1.0
    return round(float(ms.get(month, mean)) / float(mean), 2)


def attraction_crowd(attraction: str, when: dt.datetime | None = None) -> dict | None:
    """单个景点的当前拥挤度（含真实热门度/满意度 + 模型化的时段估计）。"""
    st = _stats()
    if attraction not in st["pop_norm"]:
        return None
    when = when or dt.datetime.now()
    mf = _month_factor(attraction, when.month)
    hf = _hour_factor(when.hour)
    index = round(mf * hf, 3)                         # 季节(真实) × 时段(模型)
    return {
        "attraction": attraction,
        "crowd_index": index,
        "crowd_level": _level(index),
        "popularity": st["pop_norm"][attraction],   # 真实热门度 0~1（仅排序/展示）
        "satisfaction": st["sat"].get(attraction),  # 真实平均满意度
        "avg_stay_h": st["stay"].get(attraction),   # 真实平均停留(小时)
        "month_factor": mf,                          # 真实季节因子
        "hour_factor": hf,                           # 模型时段因子
    }


def scenic_crowd(scenic_id: str, when: dt.datetime | None = None) -> dict:
    """某景区的客流概览：各（数据中可对应的）景点拥挤度 + 季节/错峰提示。"""
    when = when or dt.datetime.now()
    attrs = SCENIC_ATTRACTIONS.get(scenic_id, [])
    items = [c for a in attrs if (c := attraction_crowd(a, when))]
    items.sort(key=lambda x: x["crowd_index"], reverse=True)

    # 旺季提示（真实月度）
    in_peak = any(it["month_factor"] >= 1.1 for it in items)
    off_peak = items and all(it["month_factor"] <= 0.9 for it in items)
    season = "旅游旺季" if in_peak else ("旅游淡季" if off_peak else "平季")
    # 今日错峰时段（模型）：曲线低谷
    quiet_hours = "清晨 8 点前或傍晚 17 点后"

    return {
        "scenic_id": scenic_id,
        "as_of": when.strftime("%Y-%m-%d %H:%M"),
        "has_data": bool(items),
        "season": season,
        "quiet_hours": quiet_hours,
        "attractions": items,
        "note": "热门度/满意度/季节性来自真实游客行为数据；当前时段拥挤度为模型估计（原始数据无小时维度）。",
    }


def crowd_brief(scenic_id: str, when: dt.datetime | None = None) -> str:
    """给导游 prompt 注入的一句话客流上下文。无数据时返回空串。"""
    c = scenic_crowd(scenic_id, when)
    if not c["has_data"]:
        return ""
    top = c["attractions"][0]
    parts = [f"【实时客流参考】当前{c['as_of']}，属{c['season']}。"]
    levels = "；".join(f"{it['attraction']}{it['crowd_level']}" for it in c["attractions"])
    parts.append(f"客流：{levels}。")
    if top["crowd_level"] in ("较多", "繁忙"):
        parts.append(f"{top['attraction']}此刻人较多，可建议游客错峰（{c['quiet_hours']}人少），或先逛相对清静处。")
    return "".join(parts)
