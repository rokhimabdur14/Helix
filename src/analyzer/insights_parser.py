"""
HELIX — Insights Parser
Baca CSV Instagram insights → structured JSON + auto-compute derived metrics.
"""

import csv
import json
import sys
from datetime import datetime
from pathlib import Path
from statistics import mean, median

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"


def parse_number(val: str) -> int:
    """Convert string number to int, handle empty/invalid."""
    val = (val or "").strip()
    if not val:
        return 0
    try:
        return int(val)
    except ValueError:
        return 0


def compute_engagement_rate(row: dict) -> float:
    """Engagement rate = (likes + comments + saves + shares) / reach * 100."""
    engagements = row["likes"] + row["comments"] + row["saves"] + row["shares"]
    if row["reach"] == 0:
        return 0.0
    return round((engagements / row["reach"]) * 100, 2)


def enrich_post(row: dict) -> dict:
    """Add derived fields: engagement_rate, day_of_week."""
    # Parse numeric fields
    for field in ["reach", "impressions", "likes", "comments", "saves",
                  "shares", "profile_visits", "follows"]:
        row[field] = parse_number(row.get(field, ""))

    # Parse hashtags into list
    hashtags_str = row.get("hashtags", "").strip()
    row["hashtags"] = [h.strip() for h in hashtags_str.split() if h.startswith("#")]

    # Derived: engagement rate
    row["engagement_rate"] = compute_engagement_rate(row)

    # Derived: day of week
    try:
        date_obj = datetime.strptime(row["date"], "%Y-%m-%d")
        row["day_of_week"] = date_obj.strftime("%A")
    except (ValueError, KeyError):
        row["day_of_week"] = ""

    return row


def parse_csv(csv_path: Path) -> list[dict]:
    """Parse insights CSV into list of enriched post dicts."""
    posts = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            posts.append(enrich_post(row))
    return posts


def compute_aggregates(posts: list[dict]) -> dict:
    """Compute summary statistics across all posts."""
    if not posts:
        return {}

    # Basic totals
    total_reach = sum(p["reach"] for p in posts)
    total_follows = sum(p["follows"] for p in posts)
    engagement_rates = [p["engagement_rate"] for p in posts]

    # By type
    by_type = {}
    for p in posts:
        t = p["type"]
        by_type.setdefault(t, []).append(p)

    type_stats = {}
    for t, ps in by_type.items():
        type_stats[t] = {
            "count": len(ps),
            "avg_reach": round(mean(p["reach"] for p in ps), 0),
            "avg_engagement_rate": round(mean(p["engagement_rate"] for p in ps), 2),
            "total_follows": sum(p["follows"] for p in ps),
        }

    # By content pillar
    by_pillar = {}
    for p in posts:
        pl = p["content_pillar"]
        by_pillar.setdefault(pl, []).append(p)

    pillar_stats = {}
    for pl, ps in by_pillar.items():
        pillar_stats[pl] = {
            "count": len(ps),
            "avg_reach": round(mean(p["reach"] for p in ps), 0),
            "avg_engagement_rate": round(mean(p["engagement_rate"] for p in ps), 2),
            "total_follows": sum(p["follows"] for p in ps),
        }

    # Top 5 posts by engagement rate
    top_posts = sorted(posts, key=lambda p: p["engagement_rate"], reverse=True)[:5]

    # Best posting time analysis (hour buckets)
    by_hour = {}
    for p in posts:
        try:
            hour = int(p["posted_time"].split(":")[0])
            bucket = f"{hour:02d}:00"
            by_hour.setdefault(bucket, []).append(p["engagement_rate"])
        except (ValueError, IndexError):
            pass

    hour_stats = {
        h: round(mean(rates), 2)
        for h, rates in by_hour.items()
    }

    return {
        "post_count": len(posts),
        "total_reach": total_reach,
        "total_follows": total_follows,
        "avg_reach": round(mean(p["reach"] for p in posts), 0),
        "avg_engagement_rate": round(mean(engagement_rates), 2),
        "median_engagement_rate": round(median(engagement_rates), 2),
        "by_type": type_stats,
        "by_content_pillar": pillar_stats,
        "top_5_posts": [
            {
                "post_id": p["post_id"],
                "date": p["date"],
                "type": p["type"],
                "content_pillar": p["content_pillar"],
                "engagement_rate": p["engagement_rate"],
                "reach": p["reach"],
                "caption_preview": p["caption"][:80] + "..." if len(p["caption"]) > 80 else p["caption"],
            }
            for p in top_posts
        ],
        "engagement_by_hour": dict(sorted(hour_stats.items())),
    }


def process_brand_insights(brand_id: str) -> dict:
    """Parse brand CSV, compute aggregates, save JSON."""
    csv_path = DATA_DIR / f"{brand_id}_insights.csv"
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    print(f"\nProcessing: {csv_path.name}")
    posts = parse_csv(csv_path)
    aggregates = compute_aggregates(posts)

    result = {
        "brand_id": brand_id,
        "processed_at": datetime.now().isoformat(),
        "posts": posts,
        "aggregates": aggregates,
    }

    output_path = DATA_DIR / f"{brand_id}_insights.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    return result


def print_summary(data: dict):
    """Print human-readable summary."""
    agg = data["aggregates"]
    print(f"\n{'='*50}")
    print(f"INSIGHTS SUMMARY — {data['brand_id']}")
    print(f"{'='*50}")
    print(f"Total post:          {agg['post_count']}")
    print(f"Total reach:         {agg['total_reach']:,}")
    print(f"Total follows:       {agg['total_follows']}")
    print(f"Avg reach/post:      {agg['avg_reach']:,.0f}")
    print(f"Avg engagement rate: {agg['avg_engagement_rate']}%")
    print(f"Median ER:           {agg['median_engagement_rate']}%")

    print(f"\n--- By Type ---")
    for t, s in agg["by_type"].items():
        print(f"  {t:12s}: {s['count']} posts, avg ER {s['avg_engagement_rate']}%, +{s['total_follows']} follows")

    print(f"\n--- By Content Pillar ---")
    for pl, s in sorted(agg["by_content_pillar"].items(), key=lambda x: -x[1]["avg_engagement_rate"]):
        print(f"  {pl[:35]:35s}: {s['count']} posts, avg ER {s['avg_engagement_rate']}%, +{s['total_follows']} follows")

    print(f"\n--- Top 5 Posts (by engagement rate) ---")
    for i, p in enumerate(agg["top_5_posts"], 1):
        print(f"  {i}. [{p['type']:8s}] ER {p['engagement_rate']}% — {p['content_pillar']}")
        print(f"     \"{p['caption_preview']}\"")

    print(f"\n--- Engagement by Hour ---")
    for hour, er in agg["engagement_by_hour"].items():
        print(f"  {hour}: {er}%")


if __name__ == "__main__":
    brand_id = sys.argv[1] if len(sys.argv) > 1 else "fotofusi"
    result = process_brand_insights(brand_id)
    print_summary(result)
    print(f"\nSaved: {DATA_DIR / f'{brand_id}_insights.json'}")
