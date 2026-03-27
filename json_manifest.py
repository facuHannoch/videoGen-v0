import json
from pathlib import Path
from typing import Any

from data import TextPiece


def normalize_subtitle(text: str | None) -> str:
    if not text:
        return ""
    return " ".join(text.split())


def _load_word_timings_from_sidecar(audio_output_path: Path) -> list[dict[str, Any]]:
    sidecar_path = audio_output_path.with_suffix(".info.json")
    if not sidecar_path.exists():
        return []

    try:
        payload = json.loads(sidecar_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []

    word_timings = payload.get("wordTimings")
    if isinstance(word_timings, list):
        return word_timings
    return []


def build_piece_audio_entry(piece: TextPiece, output_path: Path) -> dict[str, Any]:
    if not piece.filename:
        raise ValueError(f"Filename missing for piece index {piece.index}.")

    return {
        "id": piece.filename,
        "subtitle": normalize_subtitle(piece.plain_text()),
        "wordTimings": _load_word_timings_from_sidecar(output_path),
    }


def build_unified_audio_entry(output_file: Path, subtitle: str) -> dict[str, Any]:
    return {
        "id": output_file.name,
        "subtitle": normalize_subtitle(subtitle),
        "wordTimings": _load_word_timings_from_sidecar(output_file),
    }


def write_audio_info_json(audio_entries: list[dict[str, Any]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"audios": audio_entries}
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Generated unified JSON: {output_path}")


def cleanup_sidecar_for_audio(audio_output_path: Path) -> None:
    sidecar_path = audio_output_path.with_suffix(".info.json")
    if sidecar_path.exists():
        sidecar_path.unlink()
        print(f"Removed sidecar JSON: {sidecar_path}")
