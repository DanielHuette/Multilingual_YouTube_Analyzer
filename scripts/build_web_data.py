"""Build the data files of the project page from the measurement files.

Context: the page in web/ shows the live run and the benchmarks; this script is the only way
those figures get there, so every number on the page traces back to a file in the repository.
| Input: live_eval/results.json, benchmark_imports_for_QandA_notebook/all_benchmarks.json
| Output: web/data/live_eval.json, web/data/benchmarks.json

Usage:
    python scripts/build_web_data.py            # write both files
    python scripts/build_web_data.py --check    # exit 1 if the files on disk are out of date
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
LIVE_SOURCE = ROOT / "live_eval" / "results.json"
BENCH_SOURCE = ROOT / "benchmark_imports_for_QandA_notebook" / "all_benchmarks.json"
OUTPUT_DIR = ROOT / "web" / "data"

#: The benchmark notebook asks the ten questions of the 17-minute video in benchmarks 4, 5 and 7
#: (REFERENCE_VIDEO_LABEL in benchmark.ipynb); only this video's matrix rows answer them.
REFERENCE_VIDEO = "medium_video"
VIDEO_LABELS = ("short_video", "medium_video", "long_video")

Json = dict[str, Any]


def _question(entry: Json, kind: str) -> Json:
    judge = entry.get("judge") or {}
    return {
        "kind": kind,
        "question": entry["question"],
        "answer": entry["answer"],
        "reference": entry.get("reference"),
        "score": judge.get("faithfulness_score"),
        "verdict": judge.get("verdict"),
        "explanation": judge.get("explanation"),
        "latency": round(entry["latency_sec"], 2),
        "cost": entry["agent_cost_usd"],
    }


def _video(entry: Json) -> Json:
    ingest = entry["ingest"]
    wer = entry.get("word_error_rate") or {}
    questions = [_question(q, "generated") for q in entry["generated_questions"]]
    questions += [_question(q, "extra") for q in entry["extra_questions"]]
    return {
        "id": ingest["video_id"],
        "url": entry["url"],
        "label": entry["label"],
        "title": ingest["title"],
        "channel": ingest["channel"],
        "duration": ingest["duration_sec"],
        "language": ingest["language"],
        "chunks": ingest["num_chunks"],
        "whisper_cost": round(ingest["whisper_cost_usd"], 4),
        "whisper_sec": round(ingest["whisper_time_sec"], 1),
        "embedding_cost": ingest["embedding_cost_usd"],
        "ingest_sec": round(ingest["total_ingestion_sec"], 1),
        "wer": wer.get("wer_percent"),
        "questions": questions,
    }


def build_live(source: Json) -> Json:
    """Reduce the live run to what the page shows.

    Args:
        source: Parsed live_eval/results.json.

    Returns:
        Run settings and one entry per video with every question, answer and verdict.
    """
    return {
        "run_at": source["run_at"],
        "agent_model": source["agent_model"],
        "judge_model": source["judge_model"],
        "embedding_model": source["embedding_model"],
        "whisper": "whisper-1 (API)" if source["whisper_backend"] == "api" else source["whisper_backend"],
        "videos": [_video(entry) for entry in source["videos"]],
    }


def _matrix_video(row: Json, whisper_rows: list[Json]) -> str:
    """Return the video a matrix row belongs to; the notebook keys it by its error rate only."""
    size = re.sub(r"^local: ", "", row["whisper_model"])
    name = "whisper-1 (API)" if size.startswith("api") else f"whisper-{size}"
    for candidate in whisper_rows:
        if candidate["model"] == name and candidate["wer_percent"] == row["whisper_wer_percent"]:
            return str(candidate["video_label"])
    raise ValueError(f"no benchmark 1 row matches matrix row {row['whisper_model']} / {row['whisper_wer_percent']}")


def _matrix(source: Json) -> Json:
    whisper_rows = source["benchmark1_whisper_sizes"]
    keep = (
        "whisper_model",
        "whisper_wer_percent",
        "llm_model",
        "llm_avg_score",
        "llm_avg_latency_sec",
        "combo_total_cost_usd",
    )
    rows = [
        {**{k: r[k] for k in keep}, "video_label": _matrix_video(r, whisper_rows)}
        for r in source["benchmark7_full_matrix"]
    ]
    others = [r["llm_avg_score"] for r in rows if r["video_label"] != REFERENCE_VIDEO]
    return {
        "reference_video": REFERENCE_VIDEO,
        "rows": [r for r in rows if r["video_label"] == REFERENCE_VIDEO],
        "total": len(rows),
        "other_score_min": min(others),
        "other_score_max": max(others),
    }


def build_benchmarks(source: Json) -> Json:
    """Pick the benchmark rows the page charts.

    Args:
        source: Parsed all_benchmarks.json written by benchmark.ipynb.

    Returns:
        One list per benchmark plus the sizes of the chunk grid and the full matrix.
    """
    whisper_keys = ("model", "video_label", "wer_percent", "total_time_sec", "cost_usd", "video_duration_sec")
    bitrate_keys = ("model", "bitrate_kbps", "model_size", "wer_percent", "detected_language", "audio_size_kb")
    chunks = source["chunk_recommendations"]["api"]
    return {
        "whisper": [{k: r[k] for k in whisper_keys} for r in source["benchmark1_whisper_sizes"]],
        "bitrate": [{k: r[k] for k in bitrate_keys} for r in source["benchmark2_bitrates"]],
        "embeddings": source["benchmark3_embeddings"],
        "llms": source["benchmark4_llms"],
        "rag": source["benchmark5_rag_vs_norag"],
        "chunks": {label: chunks[label] for label in VIDEO_LABELS},
        "chunk_grid_size": len(source["benchmark6_chunk_grid"]),
        "matrix_size": len(source["benchmark7_full_matrix"]),
        "matrix": _matrix(source),
    }


def _render(data: Json) -> str:
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="fail if the page data is out of date")
    args = parser.parse_args()
    outputs = {
        OUTPUT_DIR / "live_eval.json": _render(build_live(json.loads(LIVE_SOURCE.read_text(encoding="utf-8")))),
        OUTPUT_DIR / "benchmarks.json": _render(build_benchmarks(json.loads(BENCH_SOURCE.read_text(encoding="utf-8")))),
    }
    stale = [path for path, text in outputs.items() if not path.exists() or path.read_text(encoding="utf-8") != text]
    if args.check:
        for path in stale:
            print(f"out of date: {path.relative_to(ROOT)}")
        return 1 if stale else 0
    for path, text in outputs.items():
        temporary = path.with_suffix(".tmp")
        temporary.write_text(text, encoding="utf-8")
        temporary.replace(path)
        print(f"wrote {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
