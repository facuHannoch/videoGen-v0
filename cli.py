#!/usr/bin/env python3

from __future__ import annotations

import argparse
import cmd as cmd_module
import json
import os
import shlex
import shutil
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable
from dotenv import load_dotenv

VG_ROOT = Path(__file__).parent
QUEUE_FILE = VG_ROOT / "queue.jsonl"
DONE_FILE = VG_ROOT / "done.jsonl"

VIDEO_EDITOR_SRC = VG_ROOT / "remotion-video-editor" / "src"
VIDEO_EDITOR_ASSETS = VG_ROOT / "remotion-video-editor" / "public"


# ── Queue helpers ──────────────────────────────────────────────────────────────

def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    items = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            items.append(json.loads(line))
    return items


def write_jsonl(path: Path, items: list[dict]) -> None:
    path.write_text(
        "".join(json.dumps(i, ensure_ascii=False) + "\n" for i in items),
        encoding="utf-8",
    )


def append_jsonl(path: Path, item: dict) -> None:
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(item, ensure_ascii=False) + "\n")


def remove_from_queue(item_id: str) -> None:
    items = [i for i in read_jsonl(QUEUE_FILE) if i.get("id") != item_id]
    write_jsonl(QUEUE_FILE, items)


def update_in_queue(item_id: str, updates: dict) -> None:
    items = read_jsonl(QUEUE_FILE)
    for i in items:
        if i.get("id") == item_id:
            i.update(updates)
    write_jsonl(QUEUE_FILE, items)


# ── Path helpers ───────────────────────────────────────────────────────────────

def project_path(item: dict) -> Path:
    return VG_ROOT / "_projects" / item["category"] / item["name"] / item["lang"]


def common_path(item: dict) -> Path:
    return VG_ROOT / "_projects" / item["category"] / "_common"


# ── Sentinels ──────────────────────────────────────────────────────────────────

def _sentinel(step: int, pp: Path) -> Path:
    sentinels = {
        1: pp / "1-raw-content" / "content.json",
        2: pp / "2-resources" / "generated.resources.json",
        3: pp / "3-script" / "script.xml",
        4: pp / "4-audios" / "audio.info.json",
        5: pp / "5-videos" / "video.mp4",
        6: pp / "6-artifact" / "video.mp4",
    }
    return sentinels[step]


def step_done(step: int, pp: Path) -> bool:
    return _sentinel(step, pp).exists()


def steps_reached(pp: Path) -> int:
    return max((s for s in range(1, 6) if step_done(s, pp)), default=0)


# ── Step runners ───────────────────────────────────────────────────────────────

def run_step1(item: dict, pp: Path) -> bool:
    common = common_path(item)
    prompt = common / "prompt.txt"
    out = pp / "1-raw-content" / "content.json"
    out.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        sys.executable, str(VG_ROOT / "scriptGen" / "index.py"),
        "--template", str(prompt),
        "-o", str(out),
    ]
    for key, value in item["fields"].items():
        cmd += ["--map", f"{key}={value}"]
    cmd += ["--map", f"TARGET_LANGUAGE={item['lang']}"]
    return _run(cmd)


def run_step2(item: dict, pp: Path) -> bool:
    common = common_path(item)
    context = common / "resourcesGenerationContext.md"
    out = pp / "2-resources" / "generated.resources.json"
    assets_dir = pp / "2-resources" / "assets"
    out.parent.mkdir(parents=True, exist_ok=True)
    assets_dir.mkdir(parents=True, exist_ok=True)

    cmd = [
        sys.executable, str(VG_ROOT / "resourcesGen" / "index.py"),
        "--input", str(pp / "1-raw-content" / "content.json"),
        "--output", str(out),
        "--assets-dir", str(assets_dir),
        "--image-aspect-ratio", "1:1",
    ]
    if context.exists():
        cmd += ["--context", str(context)]
    return _run(cmd)


def run_step3(item: dict, pp: Path) -> bool:
    common = common_path(item)
    reference = common / f"reference-{item['lang']}.xml"
    out = pp / "3-script" / "script.xml"
    out.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        sys.executable, str(VG_ROOT / "audioScriptGen" / "index.py"),
        "--input", str(pp / "1-raw-content" / "content.json"),
        "--output", str(out),
    ]
    if reference.exists():
        cmd += ["--reference", str(reference)]
    return _run(cmd)


def run_step4(item: dict, pp: Path) -> bool:
    audios_dir = pp / "4-audios" / "audios"
    audio_info = pp / "4-audios" / "audio.info.json"
    audios_prev = pp / "4-audios" / "audios-prev"
    audio_info_prev = pp / "4-audios" / "audio-prev.info.json"
    audios_dir.parent.mkdir(parents=True, exist_ok=True)

    # Back up previous outputs
    if audios_prev.exists():
        shutil.rmtree(audios_prev)
    if audio_info_prev.exists():
        audio_info_prev.unlink()
    if audios_dir.exists():
        audios_dir.rename(audios_prev)
    if audio_info.exists():
        audio_info.rename(audio_info_prev)

    cmd = [
        sys.executable, str(VG_ROOT / "audioGen" / "index.py"),
        "--xml", str(pp / "3-script" / "script.xml"),
        "--output-dir", str(audios_dir),
        "--unify-json",
    ]
    if not _run(cmd):
        return False

    # audioGen places audio.info.json inside audios/, hoist it one level up
    generated_info = audios_dir / "audio.info.json"
    if generated_info.exists():
        generated_info.rename(audio_info)

    return True


def _sync_editor_assets(pp: Path) -> None:
    """Copy this project's generated assets into the shared video editor workspace."""
    audios_dst = VIDEO_EDITOR_ASSETS / "audios"
    if audios_dst.exists():
        shutil.rmtree(audios_dst)
    shutil.copytree(pp / "4-audios" / "audios", audios_dst)

    audio_info_src = pp / "4-audios" / "audio.info.json"
    if audio_info_src.exists():
        shutil.copy2(audio_info_src, VIDEO_EDITOR_ASSETS / "audio.info.json")

    images_src = pp / "2-resources" / "images"
    if images_src.exists():
        images_dst = VIDEO_EDITOR_ASSETS / "images"
        if images_dst.exists():
            shutil.rmtree(images_dst)
        shutil.copytree(images_src, images_dst)

    shutil.copy2(pp / "1-raw-content" / "content.json", VIDEO_EDITOR_SRC / "content.json")

    # Also restore the project's timeline into the editor if it exists
    timeline_sentinel = pp / "5-videos" / "timeline.json"
    if timeline_sentinel.exists():
        shutil.copy2(timeline_sentinel, VIDEO_EDITOR_ASSETS / "timeline.json")


def run_step5(item: dict, pp: Path) -> bool:
    common = common_path(item)
    context = common / "videoMakingContext.md"
    timeline_cache = pp / "5-videos" / "timeline.json"

    _sync_editor_assets(pp)

    # AI worker: re-run if cache missing or audio.info.json is newer than the cached timeline
    audio_info = pp / "4-audios" / "audio.info.json"
    cache_stale = (
        not timeline_cache.exists()
        or (audio_info.exists() and audio_info.stat().st_mtime > timeline_cache.stat().st_mtime)
    )
    if cache_stale:
        cmd = [
            sys.executable, str(VG_ROOT / "videoEditorWorker" / "index.py"),
            "--audio-info", str(pp / "4-audios" / "audio.info.json"),
            "--timeline-output", str(VIDEO_EDITOR_ASSETS / "timeline.json"),
            "--composition", str(VG_ROOT / "remotion-video-editor" / "src" / "WordComposition.tsx"),
            "--content-json", str(pp / "1-raw-content" / "content.json"),
            "--resources-json", str(pp / "2-resources" / "generated.resources.json"),
            "--script-xml", str(pp / "3-script" / "script.xml"),
            "--additional-comments", "USE THE SAME AUDIO NAMES, DO NOT CHANGE THEM EVEN SLIGHTLY. IF THERE ARE INSTRUCTIONS GIVEN IN <context> FOLLOW THEM.",
        ]
        if context.exists():
            cmd += ["--context", str(context)]
        if not _run(cmd):
            return False
        shutil.copy2(VIDEO_EDITOR_ASSETS / "timeline.json", timeline_cache)
    else:
        print("    (AI worker already done, restoring timeline)")
        shutil.copy2(timeline_cache, VIDEO_EDITOR_ASSETS / "timeline.json")

    # Render
    video_out = pp / "5-videos" / "video.mp4"
    remotion_bin = VG_ROOT / "remotion-video-editor" / "node_modules" / ".bin" / "remotionb"
    render_cmd = [str(remotion_bin), "render", "src/index.ts", "video", str(video_out)]
    return _run(render_cmd, cwd=VG_ROOT / "remotion-video-editor")


def run_step6(_item: dict, pp: Path) -> bool:
    artifact_dir = pp / "6-artifact"
    artifact_dir.mkdir(exist_ok=True)

    # Video
    shutil.copy2(pp / "5-videos" / "video.mp4", artifact_dir / "video.mp4")

    # Audio manifest (useful for subtitles / captions later)
    audio_info = pp / "4-audios" / "audio.info.json"
    if audio_info.exists():
        shutil.copy2(audio_info, artifact_dir / "audio.info.json")

    # Raw content (description / metadata source)
    content_json = pp / "1-raw-content" / "content.json"
    if content_json.exists():
        shutil.copy2(content_json, artifact_dir / "content.json")

    # Everything generated under 2-resources/assets/ (text files, captions, etc.)
    assets_src = pp / "2-resources" / "assets"
    if assets_src.exists():
        assets_dst = artifact_dir / "assets"
        if assets_dst.exists():
            shutil.rmtree(assets_dst)
        # shutil.copytree(assets_src, assets_dst)
        shutil.copytree(assets_src, assets_dst)
        # Move all files from assets/ into artifact root
        for asset_file in assets_dst.iterdir():
            if asset_file.is_file():
                shutil.move(str(asset_file), str(artifact_dir / asset_file.name))

    # Images
    images_src = pp / "2-resources" / "images"
    if images_src.exists():
        images_dst = artifact_dir / "images"
        if images_dst.exists():
            shutil.rmtree(images_dst)
        shutil.copytree(images_src, images_dst)

    return True


STEPS: dict[int, Callable] = {
    1: run_step1,
    2: run_step2,
    3: run_step3,
    4: run_step4,
    5: run_step5,
    6: run_step6,
}

STEP_NAMES: dict[int, str] = {
    1: "Raw content    (scriptGen)",
    2: "Resources      (resourcesGen)",
    3: "Audio script   (audioScriptGen)",
    4: "Audio          (audioGen)",
    5: "Video          (AI + render)",
    6: "Artifact       (collect)",
}

NUM_STEPS = len(STEPS)

# Files shown per step in the server UI (relative to project path)
STEP_FILES: dict[int, list[str]] = {
    1: ["1-raw-content/content.json"],
    2: ["2-resources/generated.resources.json"],
    3: ["3-script/script.xml"],
    4: ["4-audios/audio.info.json"],
    5: ["5-videos/timeline.json", "5-videos/video.mp4"],
    6: ["6-artifact/video.mp4", "6-artifact/content.json", "6-artifact/audio.info.json"],
}


def _run(cmd: list[Any], cwd: Path = VG_ROOT) -> bool:
    display = " ".join(str(c) for c in cmd)
    print(f"    $ {display}")
    result = subprocess.run(cmd, cwd=cwd)
    return result.returncode == 0


# ── Commands ───────────────────────────────────────────────────────────────────

def cmd_add(args: argparse.Namespace) -> None:
    fields: dict[str, str] = {}
    for f in args.field:
        if "=" not in f:
            print(f"Error: invalid --field '{f}', expected KEY=VALUE", file=sys.stderr)
            sys.exit(1)
        key, value = f.split("=", 1)
        fields[key.strip()] = value

    item = {
        "id": str(uuid.uuid4())[:8],
        "name": args.name,
        "category": args.category,
        "lang": args.lang,
        "fields": fields,
        "added_at": datetime.now(timezone.utc).isoformat(),
    }
    append_jsonl(QUEUE_FILE, item)
    print(f"Added [{item['id']}] {args.name} ({args.lang})  →  queue.jsonl")


def cmd_run(args: argparse.Namespace) -> None:
    # Resolve step range
    if args.step:
        steps = [args.step]
    elif args.from_step:
        steps = list(range(args.from_step, NUM_STEPS + 1))
    else:
        steps = list(range(1, NUM_STEPS + 1))

    # Resolve forced steps
    if args.force:
        forced: set[int] = set(steps)
    elif args.force_step:
        forced = {args.force_step}
    else:
        forced = set()

    # Resolve items to process
    if args.id:
        # Search queue first, then done (re-running a finished item is allowed)
        all_items = read_jsonl(QUEUE_FILE) + read_jsonl(DONE_FILE)
        items = [i for i in all_items if i["id"] == args.id]
        if not items:
            print(f"Error: no item with id '{args.id}'", file=sys.stderr)
            sys.exit(1)
    else:
        items = read_jsonl(QUEUE_FILE)
        if not items:
            print("Queue is empty.")
            return

    # Limit items based on mode
    mode = args.mode or "continuous"
    if mode == "one-time":
        items = items[:1]

    for i, item in enumerate(items):
        _run_item(item, steps, forced, single_step=bool(args.step), partial=bool(args.from_step))
        
        # Handle pause modes between items
        if mode == "on-confirmation" and i < len(items) - 1:
            try:
                input("\nPress Enter to continue to next item, or Ctrl+C to stop...")
            except KeyboardInterrupt:
                print("\nStopped.")
                break


def _run_item(
    item: dict,
    steps: list[int],
    forced: set[int],
    single_step: bool,
    partial: bool,
) -> None:
    pp = project_path(item)
    for d in ["1-raw-content", "2-resources", "3-script", "4-audios", "5-videos", "6-artifact"]:
        (pp / d).mkdir(parents=True, exist_ok=True)

    print(f"\n{'─' * 52}")
    print(f"  [{item['id']}] {item['name']}  lang:{item['lang']}  cat:{item['category']}")
    print(f"{'─' * 52}")

    last_ok = 0
    for step in steps:
        already_done = step_done(step, pp)
        if already_done and step not in forced:
            if step == 5:
                # Assets must always be synced to the editor even when AI worker is skipped
                print(f"  step 5  {STEP_NAMES[5]}  →  skip AI (already done), syncing assets")
                _sync_editor_assets(pp)
            else:
                print(f"  step {step}  {STEP_NAMES[step]}  →  skip (already done)")
            last_ok = step
            continue

        label = "force" if already_done else "run"
        print(f"\n  step {step}  {STEP_NAMES[step]}  [{label}]")
        ok = STEPS[step](item, pp)
        if ok:
            print(f"  step {step}  done ✓")
            last_ok = step
        else:
            print(f"  step {step}  FAILED", file=sys.stderr)
            update_in_queue(item["id"], {"step_reached": last_ok})
            return

    # If a full run completed all steps, graduate to done.jsonl
    is_full_run = not single_step and not partial
    if is_full_run and last_ok == NUM_STEPS:
        item["completed_at"] = datetime.now(timezone.utc).isoformat()
        item["step_reached"] = NUM_STEPS
        remove_from_queue(item["id"])
        append_jsonl(DONE_FILE, item)
        print(f"\n  Graduated to done.jsonl")
    elif last_ok > 0:
        update_in_queue(item["id"], {"step_reached": last_ok})


def cmd_status(args: argparse.Namespace) -> None:
    queue = read_jsonl(QUEUE_FILE)
    done = read_jsonl(DONE_FILE)

    print(f"\nQueue  ({len(queue)} item{'s' if len(queue) != 1 else ''})")
    print("─" * 52)
    if not queue:
        print("  (empty)")
    for item in queue:
        pp = project_path(item)
        reached = steps_reached(pp)
        bar = "".join("█" if i <= reached else "░" for i in range(1, NUM_STEPS + 1))
        print(f"  [{item['id']}]  {item['name']:<20} {item['lang']}  {bar} {reached}/{NUM_STEPS}")

    print(f"\nDone   ({len(done)} item{'s' if len(done) != 1 else ''})")
    print("─" * 52)
    if not done:
        print("  (empty)")
    for item in done:
        date = item.get("completed_at", "?")[:10]
        print(f"  [{item['id']}]  {item['name']:<20} {item['lang']}  completed {date}")

    print()


def cmd_deliver(args: argparse.Namespace) -> None:
    all_items = read_jsonl(QUEUE_FILE) + read_jsonl(DONE_FILE)
    matches = [i for i in all_items if i["id"] == args.id]
    if not matches:
        print(f"Error: no item with id '{args.id}'", file=sys.stderr)
        sys.exit(1)
    item = matches[0]
    pp = project_path(item)
    artifact_dir = pp / "6-artifact"

    if not artifact_dir.exists():
        print("Error: artifact directory missing — run step 6 first", file=sys.stderr)
        sys.exit(1)

    if args.via == "tailscale":
        dest = args.to
        cmd = ["scp", "-r", str(artifact_dir) + "/", dest]
        print(f"  Sending via Tailscale/scp → {dest}")
        if not _run(cmd):
            sys.exit(1)
    else:
        print(f"Error: unknown transport '{args.via}'. Supported: tailscale", file=sys.stderr)
        sys.exit(1)

    print("  Delivered.")


# ── Argument parsing ───────────────────────────────────────────────────────────

def _build_parser(prog: str = "cli.py") -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog=prog, description="videoGen pipeline CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    # add
    p_add = sub.add_parser("add", help="Add an item to the queue")
    p_add.add_argument("--name", required=True,
                       help="Slug used as the project folder name (e.g. bottle)")
    p_add.add_argument("--category", required=True,
                       help="Project category (e.g. ipa_coach-word_pronunciation)")
    p_add.add_argument("--lang", default="en",
                       help="Language code (default: en)")
    p_add.add_argument("-f", "--field", action="append", default=[], metavar="KEY=VALUE",
                       help="Field mapping passed to pipeline steps; repeatable")

    # run
    p_run = sub.add_parser("run", help="Run the pipeline for queued items")
    p_run.add_argument("--id", default=None,
                       help="Run a specific item by id (otherwise runs entire queue)")
    p_run.add_argument("--mode", default="one-time", 
                       choices=["continuous", "on-confirmation", "one-time"],
                       help="Queue processing mode: one-time (first item only), on-confirmation (pause between items), continuous (all items)")


    step_group = p_run.add_mutually_exclusive_group()
    step_group.add_argument("--step", type=int, choices=range(1, NUM_STEPS + 1), metavar="N",
                            help=f"Run only step N (1–{NUM_STEPS})")
    step_group.add_argument("--from-step", type=int, choices=range(1, NUM_STEPS + 1), metavar="N",
                            dest="from_step", help=f"Run from step N through {NUM_STEPS}")

    force_group = p_run.add_mutually_exclusive_group()
    force_group.add_argument("--force", action="store_true",
                             help="Force re-run all steps in scope")
    force_group.add_argument("--force-step", type=int, choices=range(1, NUM_STEPS + 1), metavar="N",
                             dest="force_step",
                             help="Force re-run only step N (others still respect idempotency)")

    # status
    sub.add_parser("status", help="Show queue and done items with step progress")

    # repl
    sub.add_parser("repl", help="Start interactive shell")

    # deliver
    p_deliver = sub.add_parser("deliver", help="Send artifact to a destination")
    p_deliver.add_argument("--id", required=True, help="Item id to deliver")
    p_deliver.add_argument("--via", required=True, choices=["tailscale"],
                           help="Transport to use (tailscale)")
    p_deliver.add_argument("--to", required=True, metavar="DEST",
                           help="Destination (e.g. my-mac:/Videos/ for tailscale)")

    # server
    p_server = sub.add_parser("server", help="Start the web UI")
    p_server.add_argument("--port", type=int, default=8000, help="Port to listen on (default: 8000)")
    p_server.add_argument("--id", default=None, help="Show only a specific item by id")

    return parser


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    return _build_parser().parse_args(argv)


# ── REPL ───────────────────────────────────────────────────────────────────────

DISPATCH: dict[str, Callable] = {
    "add": cmd_add,
    "run": cmd_run,
    "status": cmd_status,
}


class VideoGenShell(cmd_module.Cmd):
    intro = "\nvideoGen shell  (type help for commands, exit to quit)\n"
    prompt = "vg> "

    def _dispatch(self, command: str, line: str) -> None:
        try:
            argv = shlex.split(f"{command} {line}")
        except ValueError as e:
            print(f"Parse error: {e}")
            return
        try:
            args = _build_parser(prog="").parse_args(argv)
        except SystemExit:
            return  # argparse already printed the error / help
        DISPATCH[command](args)

    def do_add(self, line: str) -> None:
        """add --name NAME --category CAT [--lang LANG] [-f KEY=VALUE ...]"""
        self._dispatch("add", line)

    def do_run(self, line: str) -> None:
        """run [--id ID] [--step N | --from-step N] [--force | --force-step N]"""
        self._dispatch("run", line)

    def do_status(self, line: str) -> None:
        """status  —  show queue and done items"""
        self._dispatch("status", line)

    def do_exit(self, _line: str) -> bool:
        """exit  —  quit the shell"""
        return True

    def do_quit(self, line: str) -> bool:
        """quit  —  quit the shell"""
        return self.do_exit(line)

    def do_EOF(self, line: str) -> bool:  # noqa: ARG002
        print()
        return True

    def emptyline(self) -> None:
        pass  # don't repeat the last command on empty input

    def default(self, line: str) -> None:
        print(f"Unknown command: {line.split()[0]}  (type help for commands)")


def cmd_repl(_args: argparse.Namespace) -> None:
    try:
        VideoGenShell().cmdloop()
    except KeyboardInterrupt:
        print()


# ── Entry point ────────────────────────────────────────────────────────────────

def main() -> None:
    load_dotenv(VG_ROOT / ".env")
    args = parse_args()
    if args.command == "server":
        from server import cmd_server
        cmd_server(args)
        return
    {
        "add": cmd_add,
        "run": cmd_run,
        "status": cmd_status,
        "repl": cmd_repl,
        "deliver": cmd_deliver,
    }[args.command](args)


if __name__ == "__main__":
    main()
