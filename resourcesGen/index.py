#!/usr/bin/env python3

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


MODEL_ALIAS = {
	"nano-banana": "gemini-2.5-flash-image-preview",
	"nanobanana": "gemini-2.5-flash-image-preview",
}


def normalize_provider(value: str) -> str:
	normalized = value.strip().lower().replace("-", "_")
	if normalized in {"google", "google_ai", "gemini"}:
		return "google"
	if normalized in {"openai", "open_ai"}:
		return "openai"
	if normalized == "auto":
		return "auto"
	raise ValueError(f"Unsupported provider '{value}'. Use google, openai, or auto")


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


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="Generate resources from structured prompt parts JSON using Google AI."
	)
	parser.add_argument(
		"--input",
		default="../scriptGen/res.json",
		help="Input JSON path with a top-level 'parts' array.",
	)
	parser.add_argument(
		"--output",
		"-o",
		default="./generated.resources.json",
		help="Output JSON path for generation results.",
	)
	parser.add_argument(
		"--assets-dir",
		default="./generated-assets",
		help="Directory to save binary outputs (images).",
	)
	parser.add_argument(
		"--env-file",
		default="../.env",
		help="Optional .env file to load API settings from.",
	)
	parser.add_argument(
		"--google-model",
		default=None,
		help="Override Google model (else GOOGLE_AI_MODEL env). Supports alias: nano-banana.",
	)
	parser.add_argument(
		"--openai-model",
		default=None,
		help="Override OpenAI model (else OPENAI_MODEL or OPEN_AI_MODEL env).",
	)
	parser.add_argument(
		"--provider",
		default="auto",
		help="Model provider: google | openai | auto (default: auto).",
	)
	parser.add_argument(
		"--image-aspect-ratio",
		default="9:16",
		help="Aspect ratio for image generation (Google), format W:H (example: 16:9).",
	)
	parser.add_argument(
		"--image-resolution",
		default="1K",
		help="Image resolution for Google image generation: 1K | 2K | 4K (default: 1K).",
	)
	parser.add_argument(
		"--dry-run",
		action="store_true",
		help="Do not call model; only print which parts would be generated.",
	)
	return parser.parse_args()


def load_input_json(path: Path) -> Dict[str, Any]:
	if not path.exists():
		raise FileNotFoundError(f"Input file not found: {path}")
	data = json.loads(path.read_text(encoding="utf-8"))
	if "parts" not in data or not isinstance(data["parts"], list):
		raise ValueError("Input JSON must contain a top-level 'parts' array")
	return data


def resolve_google_model(cli_value: Optional[str]) -> str:
	raw = cli_value or os.getenv("GOOGLE_AI_MODEL") or "gemini-3.1-flash-image-preview"
	alias_key = raw.strip().lower()
	return MODEL_ALIAS.get(alias_key, raw)


def resolve_openai_model(cli_value: Optional[str]) -> str:
	return (
		cli_value
		or os.getenv("OPENAI_MODEL")
		or os.getenv("OPEN_AI_MODEL")
		or "gpt-4.1-mini"
	)


def get_google_api_key() -> str:
	api_key = os.getenv("GOOGLE_AI_API_KEY")
	if not api_key:
		raise ValueError("Missing GOOGLE_AI_API_KEY. Set env var or provide it in --env-file")
	return api_key


def get_openai_api_key() -> str:
	api_key = os.getenv("OPEN_AI_API_KEY") or os.getenv("OPENAI_API_KEY")
	if not api_key:
		raise ValueError("Missing OPEN_AI_API_KEY/OPENAI_API_KEY. Set env var or provide it in --env-file")
	return api_key


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


def clean_filename(value: str) -> str:
	value = value.strip().lower()
	value = re.sub(r"[^a-z0-9._-]+", "-", value)
	value = re.sub(r"-+", "-", value).strip("-")
	return value or "item"


def detect_extension(mime_type: str) -> str:
	mime_map = {
		"image/png": ".png",
		"image/jpeg": ".jpg",
		"image/webp": ".webp",
	}
	return mime_map.get(mime_type, ".bin")


def resolve_image_aspect_ratio(cli_value: Optional[str]) -> Optional[str]:
	raw = cli_value or os.getenv("GOOGLE_IMAGE_ASPECT_RATIO")
	if not raw:
		return None
	value = raw.strip()
	if not re.fullmatch(r"\d+:\d+", value):
		raise ValueError(
			f"Invalid image aspect ratio '{value}'. Expected format W:H, e.g. 16:9"
		)
	return value


def resolve_image_resolution(cli_value: Optional[str]) -> Optional[str]:
	raw = cli_value or os.getenv("GOOGLE_IMAGE_RESOLUTION") or "1K"
	if not raw:
		return None
	value = raw.strip().upper()
	allowed = {"1K", "2K", "4K"}
	if value not in allowed:
		raise ValueError(
			f"Invalid image resolution '{value}'. Expected one of {sorted(allowed)}"
		)
	return value


def extract_response_text(response: Any) -> str:
	text = getattr(response, "text", None)
	if isinstance(text, str) and text.strip():
		return text

	chunks: List[str] = []
	for candidate in getattr(response, "candidates", []) or []:
		content = getattr(candidate, "content", None)
		for part in getattr(content, "parts", []) or []:
			part_text = getattr(part, "text", None)
			if isinstance(part_text, str) and part_text.strip():
				chunks.append(part_text)
	return "\n".join(chunks).strip()


def save_response_images(response: Any, assets_dir: Path, prefix: str) -> List[Dict[str, Any]]:
	assets_dir.mkdir(parents=True, exist_ok=True)
	saved: List[Dict[str, Any]] = []
	image_index = 1

	for candidate in getattr(response, "candidates", []) or []:
		content = getattr(candidate, "content", None)
		for part in getattr(content, "parts", []) or []:
			inline_data = getattr(part, "inline_data", None)
			if not inline_data:
				continue
			image_bytes = getattr(inline_data, "data", None)
			mime_type = getattr(inline_data, "mime_type", None) or "application/octet-stream"
			if not image_bytes:
				continue

			ext = detect_extension(mime_type)
			file_name = f"{prefix}-{image_index}{ext}"
			file_path = assets_dir / file_name
			file_path.write_bytes(image_bytes)

			saved.append(
				{
					"path": str(file_path),
					"mime_type": mime_type,
					"size_bytes": len(image_bytes),
				}
			)
			image_index += 1

	return saved


def generate_with_google(
	client: Any,
	model: str,
	prompt: str,
	prompt_for: str,
	assets_dir: Path,
	asset_prefix: str,
	image_aspect_ratio: Optional[str],
	image_resolution: Optional[str],
) -> Dict[str, Any]:
	response = None
	resolution_applied = False
	resolution_fallback_note: Optional[str] = None
	if prompt_for == "ai-image" and (image_aspect_ratio or image_resolution):
		from google.genai import types as genai_types

		image_config_kwargs: Dict[str, Any] = {}
		if image_aspect_ratio:
			image_config_kwargs["aspect_ratio"] = image_aspect_ratio
		if image_resolution:
			image_config_kwargs["resolution"] = image_resolution

		try:
			image_config = genai_types.ImageConfig(**image_config_kwargs)
			generation_config = genai_types.GenerateContentConfig(image_config=image_config)
			response = client.models.generate_content(
				model=model,
				contents=prompt,
				config=generation_config,
			)
			resolution_applied = image_resolution is not None
		except Exception:
			fallback_kwargs: Dict[str, Any] = {}
			if image_aspect_ratio:
				fallback_kwargs["aspect_ratio"] = image_aspect_ratio

			if fallback_kwargs:
				image_config = genai_types.ImageConfig(**fallback_kwargs)
				generation_config = genai_types.GenerateContentConfig(image_config=image_config)
				response = client.models.generate_content(
					model=model,
					contents=prompt,
					config=generation_config,
				)
			else:
				response = client.models.generate_content(model=model, contents=prompt)

			if image_resolution:
				resolution_fallback_note = (
					"Requested image_resolution was not supported by current google-genai SDK; "
					"generation continued without resolution."
				)
	else:
		response = client.models.generate_content(model=model, contents=prompt)

	text = extract_response_text(response)

	result: Dict[str, Any] = {
		"model": model,
		"prompt_for": prompt_for,
		"text": text,
	}

	if prompt_for == "ai-image" and image_aspect_ratio:
		result["image_aspect_ratio"] = image_aspect_ratio
	if prompt_for == "ai-image" and image_resolution and resolution_applied:
		result["image_resolution"] = image_resolution
	if prompt_for == "ai-image" and resolution_fallback_note:
		result["image_resolution_note"] = resolution_fallback_note

	if prompt_for == "ai-image":
		images = save_response_images(response, assets_dir=assets_dir, prefix=asset_prefix)
		result["images"] = images

	return result


def generate_with_openai(
	client: Any,
	model: str,
	prompt: str,
	prompt_for: str,
	assets_dir: Path,
	asset_prefix: str,
) -> Dict[str, Any]:
	result: Dict[str, Any] = {
		"model": model,
		"prompt_for": prompt_for,
	}

	if prompt_for == "ai-image":
		response = client.images.generate(model=model, prompt=prompt, size="1024x1024")
		assets_dir.mkdir(parents=True, exist_ok=True)
		images: List[Dict[str, Any]] = []

		for idx, item in enumerate(getattr(response, "data", []) or [], start=1):
			b64_json = getattr(item, "b64_json", None)
			url = getattr(item, "url", None)
			if b64_json:
				image_bytes = base64.b64decode(b64_json)
				file_path = assets_dir / f"{asset_prefix}-{idx}.png"
				file_path.write_bytes(image_bytes)
				images.append(
					{
						"path": str(file_path),
						"mime_type": "image/png",
						"size_bytes": len(image_bytes),
					}
				)
			elif url:
				images.append({"url": url})

		result["images"] = images
		return result

	try:
		response = client.responses.create(
			model=model,
			input=[{"role": "user", "content": prompt}],
			temperature=0.2,
		)
		text = getattr(response, "output_text", None)
		if not text:
			text = ""
	except Exception:
		chat = client.chat.completions.create(
			model=model,
			messages=[{"role": "user", "content": prompt}],
			temperature=0.2,
		)
		text = chat.choices[0].message.content or ""

	result["text"] = text
	return result


def generate_for_part(
	part: Dict[str, Any],
	client: Any,
	provider: str,
	model: str,
	assets_dir: Path,
	image_aspect_ratio: Optional[str],
	image_resolution: Optional[str],
	dry_run: bool,
) -> Dict[str, Any]:
	part_id = str(part.get("id", "part"))
	title = str(part.get("title", "untitled"))
	prompt = str(part.get("content", ""))
	prompt_for = str(part.get("prompt_for", "other"))

	asset_prefix = clean_filename(f"{part_id}-{title}")

	if dry_run:
		dry_result = {
			"status": "dry-run",
			"id": part_id,
			"title": title,
			"prompt_for": prompt_for,
			"provider": provider,
			"would_generate": True,
		}
		if prompt_for == "ai-image" and image_aspect_ratio:
			dry_result["image_aspect_ratio"] = image_aspect_ratio
		if prompt_for == "ai-image" and image_resolution:
			dry_result["image_resolution"] = image_resolution
		return dry_result

	if provider == "google":
		gen_result = generate_with_google(
			client=client,
			model=model,
			prompt=prompt,
			prompt_for=prompt_for,
			assets_dir=assets_dir,
			asset_prefix=asset_prefix,
			image_aspect_ratio=image_aspect_ratio,
			image_resolution=image_resolution,
		)
	else:
		gen_result = generate_with_openai(
			client=client,
			model=model,
			prompt=prompt,
			prompt_for=prompt_for,
			assets_dir=assets_dir,
			asset_prefix=asset_prefix,
		)
		if prompt_for == "ai-image" and image_aspect_ratio:
			gen_result["note"] = "image_aspect_ratio is currently applied only for provider=google"
		if prompt_for == "ai-image" and image_resolution:
			gen_result["note_resolution"] = "image_resolution is currently applied only for provider=google"

	return {
		"status": "generated",
		"id": part_id,
		"title": title,
		"prompt_for": prompt_for,
		"provider": provider,
		"generation": gen_result,
	}


def main() -> None:
	args = parse_args()

	try:
		load_dotenv(Path(args.env_file))
		input_path = Path(args.input)
		output_path = Path(args.output)
		assets_dir = Path(args.assets_dir)

		payload = load_input_json(input_path)
		parts = payload.get("parts", [])

		provider_arg = normalize_provider(args.provider)
		env_provider = normalize_provider(os.getenv("AI_MODEL_PROVIDER", "auto"))
		provider = env_provider if provider_arg == "auto" else provider_arg
		if provider == "auto":
			provider = "google"

		google_model = resolve_google_model(args.google_model)
		openai_model = resolve_openai_model(args.openai_model)
		selected_model = google_model if provider == "google" else openai_model
		image_aspect_ratio = resolve_image_aspect_ratio(args.image_aspect_ratio)
		image_resolution = resolve_image_resolution(args.image_resolution)

		client = None
		if not args.dry_run:
			if provider == "google":
				api_key = get_google_api_key()
				client = get_google_client(api_key)
			else:
				api_key = get_openai_api_key()
				client = get_openai_client(api_key)

		results: List[Dict[str, Any]] = []
		for part in parts:
			if not isinstance(part, dict):
				continue

			is_prompt = bool(part.get("is_prompt", False))
			if not is_prompt:
				results.append(
					{
						"status": "skipped",
						"reason": "is_prompt=false",
						"id": str(part.get("id", "part")),
						"title": str(part.get("title", "untitled")),
					}
				)
				continue

			assert client is not None or args.dry_run
			results.append(
				generate_for_part(
					part=part,
					client=client,
					provider=provider,
					model=selected_model,
					assets_dir=assets_dir,
					image_aspect_ratio=image_aspect_ratio,
					image_resolution=image_resolution,
					dry_run=args.dry_run,
				)
			)

		output_payload = {
			"input": str(input_path),
			"model_provider": provider,
			"model": selected_model,
			"image_aspect_ratio": image_aspect_ratio,
			"image_resolution": image_resolution,
			"total_parts": len(parts),
			"generated_parts": len([r for r in results if r.get("status") in {"generated", "dry-run"}]),
			"results": results,
		}

		output_path.parent.mkdir(parents=True, exist_ok=True)
		output_path.write_text(json.dumps(output_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
		print(f"Wrote resource generation result to {output_path}")

	except Exception as error:
		print(f"Error: {error}", file=sys.stderr)
		sys.exit(1)


if __name__ == "__main__":
	main()
