import argparse
from pathlib import Path

from dotenv import load_dotenv

from data import SSML_NAMESPACE, SpeakDocument
from json_manifest import (
    build_piece_audio_entry,
    build_unified_audio_entry,
    cleanup_sidecar_for_audio,
    normalize_subtitle,
    write_audio_info_json,
)
from parser import parse_project
from synthetizer import build_azure_synthesizer, piece_to_ssml_inner

load_dotenv()

UNIFIED_DEFAULT_FILENAME = "01_unified.wav"
UNIFIED_SEPARATOR_SSML = '<break time="150ms"/>'


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate audio from XML using Azure TTS.")
    parser.add_argument(
        "--xml",
        type=Path,
        default=Path(__file__).parent / "demo.xml",
        help="Path to XML input file.",
    )
    parser.add_argument("--output-dir", type=Path, default=None, help="Output directory.")
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Unified output file path (used with --unify).",
    )
    parser.add_argument(
        "--voice",
        type=str,
        default=None,
        help="Voice override (takes precedence over XML/default).",
    )
    parser.add_argument(
        "--unify",
        action="store_true",
        help="Generate a single unified audio file instead of individual files.",
    )
    parser.add_argument(
        "--unify-json",
        nargs="?",
        const=Path("audio.info.json"),
        default=None,
        type=Path,
        help="Generate one unified JSON manifest with subtitle and wordTimings for all outputs. Optional path (default: <output-dir>/audio.info.json).",
    )
    return parser.parse_args()


def _build_unified_inner_ssml(project_pieces) -> str:
    chunks: list[str] = []
    for index, piece in enumerate(project_pieces):
        chunks.append(piece_to_ssml_inner(piece))
        if index < len(project_pieces) - 1:
            chunks.append(UNIFIED_SEPARATOR_SSML)
    return "".join(chunks)


def _get_project_speak_pieces(project):
    return [piece for piece in project.pieces if isinstance(piece.content, SpeakDocument)]


def _build_unified_speak_document(project_pieces, default_language: str, default_voice: str) -> str:
    chunks: list[str] = []
    for index, piece in enumerate(project_pieces):
        chunks.append(
            piece.content.to_inner_ssml(
                default_language=default_language,
                default_voice=default_voice,
            )
        )
        if index < len(project_pieces) - 1:
            chunks.append(UNIFIED_SEPARATOR_SSML)

    return (
        f'<speak version="1.0" xmlns="{SSML_NAMESPACE}" xml:lang="{default_language}">'
        f'{"".join(chunks)}'
        "</speak>"
    )


def _ensure_wav_extension(path: Path) -> Path:
    if path.suffix:
        return path
    return path.with_suffix(".wav")


def run(
    xml_path: Path,
    output_dir_override: Path | None,
    output_file_override: Path | None,
    voice_override: str | None,
    unify: bool,
    unify_json_output: Path | None,
) -> None:
    project = parse_project(xml_path)
    effective_voice = voice_override if voice_override else project.voice
    synthesizer = build_azure_synthesizer(voice=effective_voice, language=project.language)

    output_dir = output_dir_override if output_dir_override else Path(project.output_dir)
    json_output_path = None
    if unify_json_output is not None:
        json_output_path = (
            unify_json_output
            if unify_json_output.is_absolute()
            else output_dir / unify_json_output
        )

    speak_pieces = _get_project_speak_pieces(project)

    if unify:
        if output_file_override is not None:
            output_file = _ensure_wav_extension(output_file_override)
        else:
            output_dir.mkdir(parents=True, exist_ok=True)
            output_file = output_dir / UNIFIED_DEFAULT_FILENAME

        output_file.parent.mkdir(parents=True, exist_ok=True)
        if speak_pieces:
            synthesizer.synthesize_ssml_document(
                ssml_document=_build_unified_speak_document(
                    project_pieces=speak_pieces,
                    default_language=project.language,
                    default_voice=effective_voice,
                ),
                output_path=output_file,
                label="unified",
            )
        else:
            unified_inner_ssml = _build_unified_inner_ssml(project.pieces)
            synthesizer.synthesize_ssml_inner(
                inner_ssml=unified_inner_ssml,
                output_path=output_file,
                label="unified",
            )

        if json_output_path is not None:
            unified_subtitle = normalize_subtitle(" ".join(piece.plain_text() for piece in project.pieces))
            entry = build_unified_audio_entry(output_file=output_file, subtitle=unified_subtitle)
            write_audio_info_json(audio_entries=[entry], output_path=json_output_path)
            cleanup_sidecar_for_audio(output_file)
        return

    output_dir.mkdir(parents=True, exist_ok=True)
    if output_file_override is not None:
        print("Ignoring --output because --unify is not set.")

    audio_entries = []
    for piece in project.pieces:
        if not piece.filename:
            raise ValueError(f"Filename missing for piece index {piece.index}.")
        piece_output_path = output_dir / piece.filename
        synthesizer.synthesize(piece=piece, output_path=piece_output_path)

        if json_output_path is not None:
            audio_entries.append(build_piece_audio_entry(piece=piece, output_path=piece_output_path))

    if json_output_path is not None:
        write_audio_info_json(audio_entries=audio_entries, output_path=json_output_path)
        for piece in project.pieces:
            if piece.filename:
                cleanup_sidecar_for_audio(output_dir / piece.filename)


if __name__ == "__main__":
    args = parse_args()
    run(
        xml_path=args.xml,
        output_dir_override=args.output_dir,
        output_file_override=args.output,
        voice_override=args.voice,
        unify=args.unify,
        unify_json_output=args.unify_json,
    )
