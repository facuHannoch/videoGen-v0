#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
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


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="Generate a TTS script.xml from JSON using AI and an optional reference XML file."
	)
	parser.add_argument(
		"--input",
		required=True,
		help="Input JSON file path (for example: ../scriptGen/res.json)",
	)
	parser.add_argument(
		"--output",
		"-o",
		default="./script.xml",
		help="Output XML path (default: ./script.xml)",
	)
	parser.add_argument(
		"--reference",
		default="./reference.xml",
		help="Optional XML style reference file (default: ./reference.xml)",
	)
	parser.add_argument(
		"--env-file",
		default="../.env",
		help="Optional .env file to load API settings from (default: ../.env)",
	)
	parser.add_argument(
		"--provider",
		default="auto",
		help="AI provider: google | openai | auto (default: auto)",
	)
	parser.add_argument(
		"--google-model",
		default=None,
		help="Google model override (default from GOOGLE_AI_MODEL env)",
	)
	parser.add_argument(
		"--openai-model",
		default=None,
		help="OpenAI model override (default from OPENAI_MODEL/OPEN_AI_MODEL env)",
	)
	parser.add_argument(
		"--raw-output",
		default=None,
		help="Optional file to save raw AI response before XML extraction",
	)
	parser.add_argument(
		"--dry-run",
		action="store_true",
		help="Print prompt sent to the model instead of calling the API",
	)
	return parser.parse_args()


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
	google_model = google_model_arg or os.getenv("GOOGLE_AI_MODEL") or "gemini-3.1-flash-lite-preview"
	openai_model = (
		openai_model_arg
		or os.getenv("OPENAI_MODEL")
		or os.getenv("OPEN_AI_MODEL")
		or "gpt-5.4-mini"
	)
	return {"google": google_model, "openai": openai_model}


def read_json(path: Path) -> Dict[str, Any]:
	if not path.exists():
		raise FileNotFoundError(f"Input JSON not found: {path}")
	return json.loads(path.read_text(encoding="utf-8"))


def read_reference_xml(path: Path) -> str:
	if not path.exists():
		return ""
	return path.read_text(encoding="utf-8")


def build_generation_prompt(input_json: Dict[str, Any], reference_xml: str) -> str:
	json_payload = json.dumps(input_json, ensure_ascii=False, indent=2)
	additional_instructions = ""
	reference_block = (
		f"Reference XML style:\n<reference_xml>\n{reference_xml}\n</reference_xml>"
		if reference_xml.strip()
		else "No reference XML provided."
	)
	

	return (
        f"""
        Generate a valid XML docment for a TTS script.
        Return ONLY XML.
		Perform a data-to-template mapping based on the following rules:
        - Strict Structure: Keep the reference.xml structure exactly as it is (tags, order, and number of <piece> elements). Do not delete or add any XML tags.
        - Constraint: If an input_json field does not explicitly map to one of the sections in the reference.xml, ignore it. Do not attempt to add extra <piece> blocks to accommodate remaining JSON data."

		There will also be comments sometimes, read them as they could provide valuable information, but don't put them in the final script. These notes override what is being said here.

        {additional_instructions}

        ---
        reference.xml:

        {reference_block}
        ---

        ---
        INPUT JSON:

        <input_json>
        {json_payload}
        </input_json>
        """ )

        # You will be provided a reference.xml file. Use it aas a template and only swap the textual content where appropriate. Keep the structural tags and progression intact, unless explicitly instructed otherwise below.

		#    Use this as a hard reference as per how to instruct the new xml. Your job is not to create a new script, but to adapt this script to the information you are given. If there is a piece of information that does not fit, you omit it, do not change the script to make it fit, unless explicitly told below.
        # You don't need to put every part of the json payload. ONLY ADD WHAT IS RELEVANT.
		# DO NOT CHANGE THE SCRIPT. You just modify it to fit existing data. Don't remove any line, and don't add any line unless explicitly instructed so.

# 	"Generate a valid XML document for a TTS script.\n"
# 	"Return ONLY XML, no markdown, no explanations.\n\n"
# 	"Output requirements:\n"
# 	"- Root tag must be <tts_project>.\n"
# 	"- Must contain one or more <piece> elements.\n"
# 	"- Use <raw_text> and/or <ssml_text> inside <piece>.\n"
# 	"- Reuse and adapt content from the input JSON parts.\n"
# 	"- Keep output concise and production-ready for TTS generation.\n"
# 	"- Follow reference style if provided, but adapt to input content.\n\n"
# 	f"{reference_block}\n\n"
# 	"Input JSON:\n"
# 	f"<input_json>\n{json_payload}\n</input_json>"
# )


def extract_xml(text: str) -> str:
	cleaned = text.strip()

	fence_match = re.search(r"```(?:xml)?\s*(<.*?>[\s\S]*?)\s*```", cleaned, flags=re.IGNORECASE)
	if fence_match:
		cleaned = fence_match.group(1).strip()

	start = cleaned.find("<tts_project")
	end_tag = "</tts_project>"
	end = cleaned.rfind(end_tag)
	if start != -1 and end != -1:
		return cleaned[start : end + len(end_tag)].strip()

	if cleaned.startswith("<"):
		return cleaned

	raise ValueError("Could not extract XML from model response")


def validate_xml(xml_text: str) -> None:
	root = ET.fromstring(xml_text)
	if root.tag != "tts_project":
		raise ValueError("Generated XML root tag must be <tts_project>")
	# if not root.findall("piece"):
	# 	raise ValueError("Generated XML must include at least one <piece>")


def call_google(model: str, prompt: str) -> str:
	api_key = os.getenv("GOOGLE_AI_API_KEY")
	if not api_key:
		raise ValueError("Missing GOOGLE_AI_API_KEY")

	try:
		from google import genai
	except ImportError as error:
		raise RuntimeError(
			"Missing dependency 'google-genai'. Install with: pip install google-genai"
		) from error

	client = genai.Client(api_key=api_key)
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

	try:
		from openai import OpenAI
	except ImportError as error:
		raise RuntimeError(
			"Missing dependency 'openai'. Install with: pip install openai"
		) from error

	base_url = os.getenv("OPENAI_BASE_URL") or os.getenv("OPEN_AI_BASE_URL")
	client = OpenAI(api_key=api_key, base_url=base_url)

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


def main() -> None:
	args = parse_args()

	try:
		load_dotenv(Path(args.env_file))

		input_path = Path(args.input)
		output_path = Path(args.output)
		reference_path = Path(args.reference)

		provider = resolve_provider(args.provider)
		models = resolve_models(args.google_model, args.openai_model)
		model = models[provider]

		input_json = read_json(input_path)
		reference_xml = read_reference_xml(reference_path)
		prompt = build_generation_prompt(input_json=input_json, reference_xml=reference_xml)

		if args.dry_run:
			print(prompt)
			return

		if provider == "google":
			raw_response = call_google(model=model, prompt=prompt)
		else:
			raw_response = call_openai(model=model, prompt=prompt)

		if args.raw_output:
			Path(args.raw_output).write_text(raw_response, encoding="utf-8")

		xml_text = extract_xml(raw_response)
		validate_xml(xml_text)

		output_path.parent.mkdir(parents=True, exist_ok=True)
		output_path.write_text(xml_text + "\n", encoding="utf-8")
		print(f"Wrote XML to {output_path} (provider={provider}, model={model})")

	except Exception as error:
		print(f"Error: {error}", file=sys.stderr)
		sys.exit(1)


if __name__ == "__main__":
	main()
