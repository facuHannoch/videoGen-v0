import argparse
from pathlib import Path

from dotenv import load_dotenv

from parser import parse_project
from synthetizer import build_azure_synthesizer, piece_to_ssml_inner

load_dotenv()

UNIFIED_DEFAULT_FILENAME = "01_unified.wav"
UNIFIED_SEPARATOR_SSML = '<break time="250ms"/>'


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
    return parser.parse_args()


def _build_unified_inner_ssml(project_pieces) -> str:
    chunks: list[str] = []
    for index, piece in enumerate(project_pieces):
        chunks.append(piece_to_ssml_inner(piece))
        if index < len(project_pieces) - 1:
            chunks.append(UNIFIED_SEPARATOR_SSML)
    return "".join(chunks)


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
) -> None:
    project = parse_project(xml_path)
    effective_voice = voice_override if voice_override else project.voice
    synthesizer = build_azure_synthesizer(voice=effective_voice, language=project.language)

    output_dir = output_dir_override if output_dir_override else Path(project.output_dir)

    if unify:
        if output_file_override is not None:
            output_file = _ensure_wav_extension(output_file_override)
        else:
            output_dir.mkdir(parents=True, exist_ok=True)
            output_file = output_dir / UNIFIED_DEFAULT_FILENAME

        output_file.parent.mkdir(parents=True, exist_ok=True)
        unified_inner_ssml = _build_unified_inner_ssml(project.pieces)
        synthesizer.synthesize_ssml_inner(
            inner_ssml=unified_inner_ssml,
            output_path=output_file,
            label="unified",
        )
        return

    output_dir.mkdir(parents=True, exist_ok=True)
    if output_file_override is not None:
        print("Ignoring --output because --unify is not set.")
    for piece in project.pieces:
        if not piece.filename:
            raise ValueError(f"Filename missing for piece index {piece.index}.")
        synthesizer.synthesize(piece=piece, output_path=output_dir / piece.filename)


if __name__ == "__main__":
    args = parse_args()
    run(
        xml_path=args.xml,
        output_dir_override=args.output_dir,
        output_file_override=args.output,
        voice_override=args.voice,
        unify=args.unify,
    )
