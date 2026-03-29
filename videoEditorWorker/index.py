#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional


TIMELINE_PROMPT_TEMPLATE = """You are building a timeline.json for a Remotion video project.

The timeline is an ordered list of items that play sequentially. Each item is one of:
- audio clip:  {{"type": "audio", "audioId": "<filename>"}}
- gap:         {{"type": "gap", "durationSeconds": <number>}}
- sfx:         {{"type": "sfx", "soundId": "<filename>", "durationSeconds": <number>, "volume": <0-1>}}

You may optionally add an "id" string field to any item for reference.

The output must be valid JSON with this exact shape:
{{
  "fps": 30,
  "items": [ ... ]
}}

Rules:
- Only use audioIds that exist in the provided audio manifest.
- Do not invent audio files.
- Only include gaps when instructed or necessary to comply with timing instructions.
- Return ONLY the JSON, no markdown fences, no explanations.

Available audio clips (from audio.info.json):
<audio_manifest>
{audio_manifest}
</audio_manifest>
{context_block}
{comments_block}
"""

TIMELINE_SCHEMA_EXAMPLE = """Timeline item types:
- {\"type\": \"audio\", \"audioId\": \"<id from audio manifest>\"}
- {\"type\": \"gap\", \"durationSeconds\": 1.5}
- {\"type\": \"sfx\", \"soundId\": \"<filename>\", \"durationSeconds\": 1, \"volume\": 0.6}
"""


def load_dotenv(env_file: Path) -> None:
	if not env_file.exists():
		return
	for line in env_file.read_text(encoding="utf-8").splitlines():
		line = line.strip()
		if not line or line.startswith("#") or "=" not in line:
			continue
		key, value = line.split("=", 1)
		key = key.strip()
		value = value.strip().strip('"').strip("'")
		if key and key not in os.environ:
			os.environ[key] = value


def normalize_provider(value: str) -> str:
	normalized = value.strip().lower().replace("-", "_")
	if normalized in {"google", "google_ai", "gemini"}:
		return "google"
	if normalized in {"openai", "open_ai"}:
		return "openai"
	if normalized == "auto":
		return "auto"
	raise ValueError(f"Unsupported provider '{value}'. Use google, openai, or auto")


def resolve_provider(provider_arg: str) -> str:
	requested = normalize_provider(provider_arg)
	if requested != "auto":
		return requested
	env_provider = normalize_provider(os.getenv("AI_MODEL_PROVIDER", "auto"))
	if env_provider != "auto":
		return env_provider
	if os.getenv("GOOGLE_AI_API_KEY"):
		return "google"
	if os.getenv("OPEN_AI_API_KEY") or os.getenv("OPENAI_API_KEY"):
		return "openai"
	return "google"


def resolve_models(google_model_arg: Optional[str], openai_model_arg: Optional[str]) -> Dict[str, str]:
	google_model = google_model_arg or os.getenv("GOOGLE_AI_MODEL") or "gemini-3.1-flash-image-preview"
	openai_model = (
		openai_model_arg
		or os.getenv("OPENAI_MODEL")
		or os.getenv("OPEN_AI_MODEL")
		or "gpt-4.1-mini"
	)
	return {"google": google_model, "openai": openai_model}


def read_optional_text(path: Optional[Path]) -> str:
	if not path:
		return ""
	if not path.exists():
		return ""
	return path.read_text(encoding="utf-8")


def read_required_text(path: Path, label: str) -> str:
	if not path.exists():
		raise FileNotFoundError(f"{label} not found: {path}")
	return path.read_text(encoding="utf-8")


def get_google_client(api_key: str):
	try:
		from google import genai
	except ImportError as error:
		raise RuntimeError(
			"Missing dependency 'google-genai'. Install with: pip install google-genai"
		) from error
	return genai.Client(api_key=api_key)


def get_openai_client(api_key: str):
	try:
		from openai import OpenAI
	except ImportError as error:
		raise RuntimeError(
			"Missing dependency 'openai'. Install with: pip install openai"
		) from error
	base_url = os.getenv("OPENAI_BASE_URL") or os.getenv("OPEN_AI_BASE_URL")
	return OpenAI(api_key=api_key, base_url=base_url)


def call_google(model: str, prompt: str) -> str:
	api_key = os.getenv("GOOGLE_AI_API_KEY")
	if not api_key:
		raise ValueError("Missing GOOGLE_AI_API_KEY")
	client = get_google_client(api_key)
	response = client.models.generate_content(model=model, contents=prompt)
	text = getattr(response, "text", None)
	if isinstance(text, str) and text.strip():
		return text

	chunks = []
	for candidate in getattr(response, "candidates", []) or []:
		content = getattr(candidate, "content", None)
		for part in getattr(content, "parts", []) or []:
			part_text = getattr(part, "text", None)
			if isinstance(part_text, str) and part_text.strip():
				chunks.append(part_text)
	if not chunks:
		raise RuntimeError("Google model returned empty response")
	return "\n".join(chunks)


def call_openai(model: str, prompt: str) -> str:
	api_key = os.getenv("OPEN_AI_API_KEY") or os.getenv("OPENAI_API_KEY")
	if not api_key:
		raise ValueError("Missing OPEN_AI_API_KEY or OPENAI_API_KEY")
	client = get_openai_client(api_key)

	try:
		response = client.responses.create(
			model=model,
			input=[{"role": "user", "content": prompt}],
			temperature=0.2,
		)
		output_text = getattr(response, "output_text", None)
		if output_text:
			return output_text
	except Exception:
		pass

	chat = client.chat.completions.create(
		model=model,
		messages=[{"role": "user", "content": prompt}],
		temperature=0.2,
	)
	content = chat.choices[0].message.content
	if not content:
		raise RuntimeError("OpenAI model returned empty response")
	return content


def call_ai(provider: str, model: str, prompt: str) -> str:
	if provider == "google":
		return call_google(model=model, prompt=prompt)
	return call_openai(model=model, prompt=prompt)


def extract_json(text: str) -> Dict[str, Any]:
	cleaned = text.strip()
	try:
		return json.loads(cleaned)
	except json.JSONDecodeError:
		pass

	fence_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", cleaned, flags=re.DOTALL)
	if fence_match:
		return json.loads(fence_match.group(1))

	first_curly = cleaned.find("{")
	last_curly = cleaned.rfind("}")
	if first_curly != -1 and last_curly != -1 and last_curly > first_curly:
		return json.loads(cleaned[first_curly : last_curly + 1])

	raise ValueError("Model did not return valid JSON")


def extract_typescript_code(text: str) -> str:
	cleaned = text.strip()
	fence_match = re.search(r"```(?:tsx|ts|typescript|javascript|jsx)?\s*([\s\S]*?)\s*```", cleaned, flags=re.IGNORECASE)
	if fence_match:
		cleaned = fence_match.group(1).strip()

	if "export const VideoComposition" not in cleaned and "function VideoComposition" not in cleaned:
		raise ValueError("AI output does not look like a full Composition.tsx file")
	return cleaned


def build_audio_manifest_summary(audio_info_json: str) -> str:
	"""Return a compact list of audio IDs + subtitles for the timeline prompt."""
	try:
		data = json.loads(audio_info_json)
		audios: List[Dict[str, Any]] = data.get("audios", [])
		lines = []
		for audio in audios:
			aid = audio.get("id", "")
			subtitle = audio.get("subtitle", "")
			lines.append(f'- "{aid}" → {subtitle}')
		return "\n".join(lines)
	except Exception:
		return audio_info_json


def build_timeline_prompt(
	audio_manifest_summary: str,
	context_text: str,
	additional_comments: str,
) -> str:
	context_block = (
		f"<context>\n{context_text}\n</context>\n"
		if context_text.strip()
		else ""
	)
	comments_block = (
		f"<additional_comments>\n{additional_comments}\n</additional_comments>\n"
		if additional_comments.strip()
		else ""
	)
	return TIMELINE_PROMPT_TEMPLATE.format(
		audio_manifest=audio_manifest_summary,
		context_block=context_block,
		comments_block=comments_block,
	)


def build_composition_prompt(
	composition_code: str,
	content_json: str,
	resources_json: str,
	xml_script: str,
	context_text: str,
	additional_comments: str,
	timeline_json: str,
) -> str:
	context_block = (
		f"<context>\n{context_text}\n</context>\n\n"
		if context_text.strip()
		else ""
	)
	comments_block = (
		f"<additional_comments>\n{additional_comments}\n</additional_comments>\n\n"
		if additional_comments.strip()
		else ""
	)
	timeline_block = (
		f"<timeline_json>\n{timeline_json}\n</timeline_json>\n\n"
		if timeline_json.strip()
		else ""
	)

	return (
		f"You are working on a video project. The resources were already generated.\n\n"
		f"{comments_block}"
		"Artifacts:\n"
		f"{context_block}"
		f"<content_json>\n{content_json}\n</content_json>\n\n"
		f"<generated_resources_json>\n{resources_json}\n</generated_resources_json>\n\n"
		f"<script_xml>\n{xml_script}\n</script_xml>\n\n"
		f"{timeline_block}"
		"Current Composition.tsx:\n"
		f"<composition_tsx>\n{composition_code}\n</composition_tsx>"
	)


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="AI worker that generates timeline.json and/or edits Composition.tsx using project artifacts."
	)

	# Timeline args
	parser.add_argument(
		"--audio-info",
		default=None,
		help="Path to audio.info.json (required for timeline generation).",
	)
	parser.add_argument(
		"--timeline-output",
		default=None,
		help="Output path for generated timeline.json.",
	)

	# Composition args
	parser.add_argument(
		"--composition",
		default=None,
		help="Path to Composition.tsx to edit.",
	)
	parser.add_argument(
		"--content-json",
		default=None,
		help="Path to content JSON (for example 1-raw-content/content.json).",
	)
	parser.add_argument(
		"--resources-json",
		default=None,
		help="Path to generated resources JSON (for example 2-resources/generated.resources.json).",
	)
	parser.add_argument(
		"--script-xml",
		default=None,
		help="Optional path to generated script XML (for example 3-script/script.xml).",
	)
	parser.add_argument(
		"--output",
		default=None,
		help="Output path for updated Composition.tsx. If omitted, overwrites --composition.",
	)

	# Shared args
	parser.add_argument(
		"--context",
		default=None,
		help="Optional path to a context/reference text file included in AI prompts.",
	)
	parser.add_argument(
		"--additional-comments",
		default="",
		help="Additional inline instructions appended to AI prompts.",
	)
	parser.add_argument(
		"--provider",
		default="auto",
		help="AI provider: google | openai | auto (default: auto).",
	)
	parser.add_argument("--google-model", default=None, help="Optional Google model override.")
	parser.add_argument("--openai-model", default=None, help="Optional OpenAI model override.")
	parser.add_argument("--env-file", default="../.env", help="Optional .env file path.")
	parser.add_argument(
		"--raw-output",
		default=None,
		help="Optional path to save raw model output (appended per step if both run).",
	)
	parser.add_argument(
		"--dry-run",
		action="store_true",
		help="Print prompts and exit without calling AI.",
	)
	return parser.parse_args()


def validate_args(args: argparse.Namespace) -> None:
	want_timeline = bool(args.timeline_output)
	want_composition = bool(args.composition)

	if not want_timeline and not want_composition:
		raise ValueError(
			"Nothing to do. Provide --timeline-output and/or --composition."
		)
	if want_timeline and not args.audio_info:
		raise ValueError("--audio-info is required when --timeline-output is set.")
	if want_composition:
		if not args.content_json:
			raise ValueError("--content-json is required when --composition is set.")
		if not args.resources_json:
			raise ValueError("--resources-json is required when --composition is set.")


def main() -> None:
	args = parse_args()
	try:
		load_dotenv(Path(args.env_file))
		validate_args(args)

		provider = resolve_provider(args.provider)
		models = resolve_models(args.google_model, args.openai_model)
		model = models[provider]

		context_path = Path(args.context) if args.context else None
		context_text = read_optional_text(context_path)

		want_timeline = bool(args.timeline_output)
		want_composition = bool(args.composition)

		# ── Step 1: generate timeline.json ──────────────────────────────────
		timeline_json_text = ""
		if want_timeline:
			audio_info_text = read_required_text(Path(args.audio_info), "audio.info.json")
			manifest_summary = build_audio_manifest_summary(audio_info_text)
			timeline_prompt = build_timeline_prompt(
				audio_manifest_summary=manifest_summary,
				context_text=context_text,
				additional_comments=args.additional_comments,
			)

			if args.dry_run:
				print("=== TIMELINE PROMPT ===")
				print(timeline_prompt)
			else:
				raw_timeline = call_ai(provider, model, timeline_prompt)
				if args.raw_output:
					Path(args.raw_output).write_text(raw_timeline, encoding="utf-8")

				timeline_data = extract_json(raw_timeline)
				timeline_json_text = json.dumps(timeline_data, ensure_ascii=False, indent=2)
				timeline_out = Path(args.timeline_output)
				timeline_out.parent.mkdir(parents=True, exist_ok=True)
				timeline_out.write_text(timeline_json_text + "\n", encoding="utf-8")
				print(f"Wrote timeline.json to {timeline_out} (provider={provider}, model={model})")

		# ── Step 2: edit Composition.tsx ─────────────────────────────────────
		if want_composition:
			composition_path = Path(args.composition)
			output_path = Path(args.output) if args.output else composition_path
			xml_path = Path(args.script_xml) if args.script_xml else None

			composition_code = read_required_text(composition_path, "Composition file")
			content_json = read_required_text(Path(args.content_json), "Content JSON")
			resources_json = read_required_text(Path(args.resources_json), "Resources JSON")
			xml_script = read_optional_text(xml_path)

			composition_prompt = build_composition_prompt(
				composition_code=composition_code,
				content_json=content_json,
				resources_json=resources_json,
				xml_script=xml_script,
				context_text=context_text,
				additional_comments=args.additional_comments,
				timeline_json=timeline_json_text,
			)

			if args.dry_run:
				print("\n=== COMPOSITION PROMPT ===")
				print(composition_prompt)
			else:
				raw_composition = call_ai(provider, model, composition_prompt)
				if args.raw_output:
					raw_out = Path(args.raw_output)
					existing = raw_out.read_text(encoding="utf-8") if raw_out.exists() else ""
					raw_out.write_text(
						existing + ("\n\n--- COMPOSITION ---\n" if existing else "") + raw_composition,
						encoding="utf-8",
					)

				updated_code = extract_typescript_code(raw_composition)
				output_path.parent.mkdir(parents=True, exist_ok=True)
				output_path.write_text(updated_code + "\n", encoding="utf-8")
				print(f"Updated Composition.tsx at {output_path} (provider={provider}, model={model})")

		if args.dry_run:
			print("\n[dry-run] No AI calls made.")

	except Exception as error:
		print(f"Error: {error}", file=sys.stderr)
		sys.exit(1)


if __name__ == "__main__":
	main()
