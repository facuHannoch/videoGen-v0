import argparse
from pathlib import Path

from dotenv import load_dotenv

from parser import parse_project
from synthetizer import build_azure_synthesizer

load_dotenv()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate audio from XML using Azure TTS.")
    parser.add_argument(
        "--xml",
        type=Path,
        default=Path(__file__).parent / "demo.xml",
        help="Path to XML input file.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output directory (relative to current working directory if relative).",
    )
    parser.add_argument(
        "--voice",
        type=str,
        default=None,
        help="Voice override (takes precedence over XML/default).",
    )
    return parser.parse_args()


def run(xml_path: Path, output_override: Path | None, voice_override: str | None) -> None:
    project = parse_project(xml_path)
    effective_voice = voice_override if voice_override else project.voice
    output_dir = output_override if output_override else Path(project.output_dir)

    output_dir.mkdir(parents=True, exist_ok=True)
    synthesizer = build_azure_synthesizer(voice=effective_voice, language=project.language)

    for piece in project.pieces:
        if not piece.filename:
            raise ValueError(f"Filename missing for piece index {piece.index}.")
        synthesizer.synthesize(piece=piece, output_path=output_dir / piece.filename)


if __name__ == "__main__":
    args = parse_args()
    run(xml_path=args.xml, output_override=args.output, voice_override=args.voice)
