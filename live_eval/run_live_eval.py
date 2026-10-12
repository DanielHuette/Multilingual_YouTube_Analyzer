"""Run the analyzer end to end on real YouTube videos and record every answer.

Context: the benchmark notebook measures components one by one; this run drives the shipped
Q&A notebook as a whole (Whisper, chunking, ChromaDB, agent, LLM-as-judge) on real videos, so
the results can be shown answer by answer instead of only as charts. | Input:
Multilingual_YouTube_Analyzer.ipynb, OPENAI_API_KEY, live_eval/videos.json | Output:
live_eval/results.json with ingest figures, word error rate, every question, answer, judge
verdict, latency and cost.

Usage:
    python live_eval/run_live_eval.py --fresh
    python live_eval/run_live_eval.py --questions 8 --output live_eval/results.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import time
import types
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK = ROOT / "Multilingual_YouTube_Analyzer.ipynb"
VIDEOS = Path(__file__).with_name("videos.json")

#: Code cells of the Q&A notebook needed for ingest, agent and judge, in notebook order.
#: Install, debug, smoke-test and UI-launch cells are left out.
PIPELINE_CELLS = (7, 8, 10, 11, 12, 13, 15, 17, 19, 21, 23, 26, 30, 32, 33, 35, 46, 48, 50)

#: Cell 48 starts an evaluation as soon as it runs; only its definitions are needed.
EVAL_CELL, EVAL_CELL_STOP = 48, "# ── Resolve eval video"

#: Cell 35 force-reinstalls yt-dlp from inside the notebook; the run uses the installed one.
YTDLP_CELL = 35
YTDLP_REINSTALL = re.compile(
    r"subprocess\.run\(\s*\[sys\.executable, \"-m\", \"pip\".*?\n\)\n", re.S
)

JUDGE_FIELDS = ("status", "faithfulness_score", "verdict", "explanation", "unsupported_claims")
WER_FIELDS = ("status", "wer_percent", "whisper_length", "reference_length")


def pipeline_source(notebook: Path) -> list[tuple[int, str]]:
    """Return the notebook code the run executes, with the two cell adjustments applied.

    Args:
        notebook: Path of the Q&A notebook.

    Returns:
        (cell index, source) pairs in execution order.
    """
    cells = json.loads(notebook.read_text(encoding="utf-8"))["cells"]
    selected = []
    for index in PIPELINE_CELLS:
        source = "".join(cells[index]["source"])
        if index == EVAL_CELL:
            source = source.split(EVAL_CELL_STOP, 1)[0]
        if index == YTDLP_CELL:
            source = YTDLP_REINSTALL.sub("", source, count=1)
        selected.append((index, source))
    return selected


def load_pipeline(notebook: Path) -> dict[str, Any]:
    """Execute the selected notebook cells in one module namespace, as Jupyter would."""
    module = types.ModuleType("__notebook__")
    sys.modules[module.__name__] = module  # dataclasses look up their defining module
    namespace: dict[str, Any] = module.__dict__
    namespace["display"] = print
    for index, source in pipeline_source(notebook):
        print(f"--- notebook cell {index}", flush=True)
        exec(compile(source, f"{notebook.name}#cell{index}", "exec"), namespace)  # noqa: S102
    return namespace


def ask(
    nb: dict[str, Any], question: str, video_id: str, title: str, thread: str
) -> dict[str, Any]:
    """Ask the agent one question and judge the answer against the YouTube captions."""
    started = time.perf_counter()
    usage = nb["ask_agent_with_usage"](
        question, thread_id=thread, active_video_id=video_id, active_video_title=title
    )
    latency = time.perf_counter() - started
    verdict = nb["judge_agent_answer"](question, usage["answer"], video_id)
    print(f"    {verdict.get('faithfulness_score')}/5 {latency:.1f}s  {question[:70]}", flush=True)
    return {
        "question": question,
        "answer": usage["answer"],
        "latency_sec": round(latency, 2),
        "agent_cost_usd": round(usage["cost_usd"], 6),
        "input_tokens": usage["input_tokens"],
        "output_tokens": usage["output_tokens"],
        "judge": {key: verdict.get(key) for key in JUDGE_FIELDS},
    }


def stage_local_audio(nb: dict[str, Any], video_id: str) -> None:
    """Copy audio fetched beforehand into the notebook's audio cache.

    YouTube refuses downloads from cloud servers ("Sign in to confirm you're not a bot"); the
    notebook's own error message asks for the file in audio_cache. Audio fetched with yt-dlp on
    a home connection is kept in live_eval/audio/ and copied there before ingest.
    """
    source = Path(__file__).with_name("audio") / f"{video_id}.m4a"
    if source.exists():
        target = Path(nb["CONFIG"]["audio_dir"]) / source.name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)


def evaluate_video(nb: dict[str, Any], video: dict[str, Any], questions: int) -> dict[str, Any]:
    """Ingest one video, generate questions from its captions, ask them and the extra ones."""
    stage_local_audio(nb, nb["extract_video_id"](video["url"]))
    ingest = nb["ingest_video"](video["url"], force=True)
    video_id, title = ingest["video_id"], ingest["title"]
    wer = nb["compare_whisper_vs_captions"](video_id)
    generated = nb["_generate_eval_questions"](video_id, title, n=questions)
    thread = f"live-{video_id}"
    asked = [
        {**ask(nb, q["question"], video_id, title, thread), "reference": q.get("reference")}
        for q in generated
    ]
    extra = [
        {**ask(nb, q, video_id, title, f"{thread}-extra"), "reference": None}
        for q in video.get("extra_questions", [])
    ]
    return {
        "url": video["url"],
        "label": video.get("label", ""),
        "ingest": ingest,
        "word_error_rate": {key: wer.get(key) for key in WER_FIELDS},
        "generated_questions": asked,
        "extra_questions": extra,
    }


def parse_arguments(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--questions", type=int, default=8)
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("results.json"))
    parser.add_argument("--fresh", action="store_true", help="delete the local ChromaDB first")
    parser.add_argument(
        "--resume", action="store_true", help="keep the videos of an interrupted run's checkpoint"
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    arguments = parse_arguments(argv)
    output = arguments.output.resolve()
    os.chdir(ROOT)
    if arguments.fresh:
        shutil.rmtree(ROOT / "chroma_db", ignore_errors=True)
    nb = load_pipeline(NOTEBOOK)
    videos = json.loads(VIDEOS.read_text(encoding="utf-8"))
    started = datetime.now(UTC)
    checkpoint = output.with_suffix(".partial.json")
    results: list[dict[str, Any]] = []
    if arguments.resume and checkpoint.exists():
        results = json.loads(checkpoint.read_text(encoding="utf-8"))
    done = {entry["url"] for entry in results}
    for video in videos:
        if video["url"] in done:
            continue
        results.append(evaluate_video(nb, video, arguments.questions))
        checkpoint.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    report = {
        "run_at": started.isoformat(timespec="seconds"),
        "agent_model": nb["CONFIG"]["agent_model"],
        "judge_model": nb["CONFIG"]["helper_model"],
        "embedding_model": nb["CONFIG"]["embedding_model"],
        "whisper_backend": nb["CONFIG"]["whisper_backend"],
        "videos": results,
    }
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    output.with_suffix(".partial.json").unlink(missing_ok=True)
    print(f"{output} written: {len(results)} videos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
