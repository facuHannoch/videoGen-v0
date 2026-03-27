#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, Optional


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
	google_model = google_model_arg or os.getenv("GOOGLE_AI_MODEL") or "gemini-2.5-flash"
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


def extract_typescript_code(text: str) -> str:
	cleaned = text.strip()
	fence_match = re.search(r"```(?:tsx|ts|typescript|javascript|jsx)?\s*([\s\S]*?)\s*```", cleaned, flags=re.IGNORECASE)
	if fence_match:
		cleaned = fence_match.group(1).strip()

	if "export const VideoComposition" not in cleaned and "function VideoComposition" not in cleaned:
		raise ValueError("AI output does not look like a full Composition.tsx file")
	return cleaned


def build_prompt(
	composition_code: str,
	content_json: str,
	resources_json: str,
	xml_script: str,
	context_text: str,
	additional_comments: str,
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

	return (
        f"""You are working on a video project. The resources were already generated, and it's know
        """
		f"{comments_block}"
		"Artifacts:\n"
		f"{context_block}"
		f"<content_json>\n{content_json}\n</content_json>\n\n"
		f"<generated_resources_json>\n{resources_json}\n</generated_resources_json>\n\n"
		f"<script_xml>\n{xml_script}\n</script_xml>\n\n"
		"Current Composition.tsx:\n"
		f"<composition_tsx>\n{composition_code}\n</composition_tsx>"
	)

		# "Update the provided React Remotion Composition file using the provided project artifacts.\n"
		# "Return ONLY the full updated file content for Composition.tsx (no markdown, no explanations).\n"
		# "Do not invent missing files. Keep imports and code style coherent with existing file.\n"
		# "Do not output partial snippets. Output the complete file.\n"
		# "Prefer adapting existing scene structure rather than rewriting everything.\n"
		# "Use resource paths consistent with remotion staticFile usage.\n\n"

def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="AI worker that edits Composition.tsx using generated content/resources artifacts."
	)
	parser.add_argument("--composition", required=True, help="Path to Composition.tsx to edit.")
	parser.add_argument(
		"--content-json",
		required=True,
		help="Path to content JSON (for example 1-raw-content/content.json).",
	)
	parser.add_argument(
		"--resources-json",
		required=True,
		help="Path to generated resources JSON (for example 2-resources/generated.resources.json).",
	)
	parser.add_argument(
		"--script-xml",
		default=None,
		help="Optional path to generated script XML (for example 3-script/script.xml).",
	)
	parser.add_argument(
		"--context",
		default=None,
		help="Optional path to a context/reference text file that will be included in the AI prompt.",
	)
	parser.add_argument(
		"--additional-comments",
		default="",
		help="Additional inline comments/instructions appended to the AI prompt.",
	)
	parser.add_argument(
		"--output",
		default=None,
		help="Optional output path for updated Composition.tsx. If omitted, overwrites --composition.",
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
		help="Optional path to save raw model output before extraction.",
	)
	parser.add_argument(
		"--dry-run",
		action="store_true",
		help="Print the prompt and exit without calling AI.",
	)
	return parser.parse_args()


def main() -> None:
	args = parse_args()
	try:
		load_dotenv(Path(args.env_file))
		provider = resolve_provider(args.provider)
		models = resolve_models(args.google_model, args.openai_model)
		model = models[provider]

		composition_path = Path(args.composition)
		output_path = Path(args.output) if args.output else composition_path
		content_json_path = Path(args.content_json)
		resources_json_path = Path(args.resources_json)
		xml_path = Path(args.script_xml) if args.script_xml else None
		context_path = Path(args.context) if args.context else None

		composition_code = read_required_text(composition_path, "Composition file")
		content_json = read_required_text(content_json_path, "Content JSON")
		resources_json = read_required_text(resources_json_path, "Resources JSON")
		xml_script = read_optional_text(xml_path)
		context_text = read_optional_text(context_path)

		prompt = build_prompt(
			composition_code=composition_code,
			content_json=content_json,
			resources_json=resources_json,
			xml_script=xml_script,
			context_text=context_text,
			additional_comments=args.additional_comments,
		)

		if args.dry_run:
			print(prompt)
			return

		if provider == "google":
			raw = call_google(model=model, prompt=prompt)
		else:
			raw = call_openai(model=model, prompt=prompt)

		if args.raw_output:
			Path(args.raw_output).write_text(raw, encoding="utf-8")

		updated_code = extract_typescript_code(raw)
		output_path.parent.mkdir(parents=True, exist_ok=True)
		output_path.write_text(updated_code + "\n", encoding="utf-8")

		print(
			f"Updated Composition file at {output_path} "
			f"(provider={provider}, model={model})"
		)

	except Exception as error:
		print(f"Error: {error}", file=sys.stderr)
		sys.exit(1)


if __name__ == "__main__":
	main()
