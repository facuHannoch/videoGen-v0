#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, Iterable


SECOND_PASS_INSTRUCTION_TEMPLATE = """
You will receive an AI response between <content> and </content>.

Task:
1) Identify the logical parts contained in the response (for example by headers, separators, numbering, or natural sections).
2) Return ONLY JSON with this exact shape:
{
	"parts": [
		{
			"id": "part-1",
			"title": "detected title or inferred short label",
			"content": "exact copied text for this part",
			"is_prompt": false,
			"prompt_for": "none"
		}
	]
}

Rules:
- Do not add any text outside JSON.
- Use UTF-8 characters exactly as in source.
- Preserve content exactly in each "content" field. Do not rewrite, summarize, normalize, or fix spelling. You can remove things that are just to identify the content. For example, don't put what you identified to be the title within the content.
- Set "is_prompt" to true only when the part is an instruction/prompt intended to be fed into a model/tool.
- Set "prompt_for" to one of: "none", "ai-image", "ai-text", "other".
- If "is_prompt" is false, "prompt_for" must be "none".
- Use "ai-image" specifically for text intended as an image-generation prompt.

<content>
__RAW_RESPONSE__
</content>
""".strip()


def parse_key_value(raw_items: Iterable[str], label: str) -> Dict[str, str]:
	result: Dict[str, str] = {}
	for item in raw_items:
		if "=" not in item:
			raise ValueError(f"Invalid {label}: '{item}'. Expected format key=value")
		key, value = item.split("=", 1)
		key = key.strip()
		if not key:
			raise ValueError(f"Invalid {label}: '{item}'. Key cannot be empty")
		result[key] = value
	return result


def render_template(
	template: str,
	variables: Dict[str, str],
	mapping: Dict[str, str],
	left_delimiter: str,
	right_delimiter: str,
) -> str:
	if left_delimiter and right_delimiter:
		pattern = re.compile(
			re.escape(left_delimiter) + r"\s*([a-zA-Z0-9_.-]+)\s*" + re.escape(right_delimiter)
		)

		def replace_match(match: re.Match[str]) -> str:
			name = match.group(1)
			if name not in variables:
				raise ValueError(
					f"Template variable '{name}' was not provided. "
					f"Use --var {name}=..."
				)
			return variables[name]

		template = pattern.sub(replace_match, template)

	for from_token, to_value in mapping.items():
		template = template.replace(from_token, to_value)

	return template


def build_default_mapping(variables: Dict[str, str]) -> Dict[str, str]:
	mapping: Dict[str, str] = {}
	for key, value in variables.items():
		upper_key = key.upper()
		mapping[upper_key] = value
		mapping[f"/{upper_key}/"] = f"/{value}/"
	return mapping


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


def validate_second_pass_output(payload: Dict[str, Any]) -> Dict[str, Any]:
	if "parts" not in payload or not isinstance(payload["parts"], list):
		raise ValueError("Second pass JSON must contain a 'parts' array")

	for i, part in enumerate(payload["parts"], start=1):
		if not isinstance(part, dict):
			raise ValueError(f"parts[{i}] must be an object")
		for key in ("id", "title", "content"):
			if key not in part or not isinstance(part[key], str):
				raise ValueError(f"parts[{i}].{key} must be a string")

		if "is_prompt" not in part or not isinstance(part["is_prompt"], bool):
			raise ValueError(f"parts[{i}].is_prompt must be a boolean")

		if "prompt_for" not in part or not isinstance(part["prompt_for"], str):
			raise ValueError(f"parts[{i}].prompt_for must be a string")

		allowed_prompt_for = {"none", "ai-image", "ai-text", "other"}
		if part["prompt_for"] not in allowed_prompt_for:
			raise ValueError(
				f"parts[{i}].prompt_for must be one of {sorted(allowed_prompt_for)}"
			)

		if not part["is_prompt"] and part["prompt_for"] != "none":
			raise ValueError(
				f"parts[{i}] has is_prompt=false, so prompt_for must be 'none'"
			)

	return payload


def call_openai(
	model: str,
	api_key: str,
	base_url: str | None,
	user_prompt: str,
	system_prompt: str | None = None,
) -> str:
	try:
		from openai import OpenAI
	except ImportError as error:
		raise RuntimeError(
			"Missing dependency 'openai'. Install with: pip install openai"
		) from error

	client = OpenAI(api_key=api_key, base_url=base_url)

	try:
		input_messages = []
		if system_prompt:
			input_messages.append({"role": "system", "content": system_prompt})
		input_messages.append({"role": "user", "content": user_prompt})

		response = client.responses.create(model=model, input=input_messages, temperature=0.2)
		output_text = getattr(response, "output_text", None)
		if output_text:
			return output_text
	except Exception:
		pass

	messages = []
	if system_prompt:
		messages.append({"role": "system", "content": system_prompt})
	messages.append({"role": "user", "content": user_prompt})

	response = client.chat.completions.create(
		model=model,
		temperature=0.2,
		messages=messages,
	)
	content = response.choices[0].message.content
	if not content:
		raise RuntimeError("AI model returned empty response")
	return content


def load_template(path: str) -> str:
	return Path(path).read_text(encoding="utf-8")


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="Generate structured phoneme resources from a text prompt using AI."
	)
	parser.add_argument(
		"--template",
		default="prompt.txt",
		help="Path to prompt template file (default: prompt.txt)",
	)
	parser.add_argument(
		"--var",
		action="append",
		default=[],
		help="Template variable replacement, supports {{name}} placeholders. Example: --var phoneme=g",
	)
	parser.add_argument(
		"--map",
		action="append",
		default=[],
		help="Direct text replacement mapping. Example: --map PHONEME_HERE=g",
	)
	parser.add_argument(
		"--left-delimiter",
		default="{{",
		help="Left delimiter for variables (default: {{)",
	)
	parser.add_argument(
		"--right-delimiter",
		default="}}",
		help="Right delimiter for variables (default: }})",
	)
	parser.add_argument(
		"--model",
		default=os.getenv("OPENAI_MODEL", "gpt-5.4"),
		help="Model name for both passes (default: OPENAI_MODEL env or gpt-5.4)",
	)
	parser.add_argument(
		"--pass2-model",
		default=os.getenv("OPENAI_PASS2_MODEL"),
		help="Optional model for pass 2 (JSON structuring). Defaults to --model.",
	)
	parser.add_argument(
		"--api-key",
		default=os.getenv("OPENAI_API_KEY"),
		help="API key (default: OPENAI_API_KEY env)",
	)
	parser.add_argument(
		"--base-url",
		default=os.getenv("OPENAI_BASE_URL"),
		help="Optional custom API base URL (for Azure/OpenAI-compatible endpoints)",
	)
	parser.add_argument(
		"--dry-run",
		action="store_true",
		help="Only render and print pass-1 prompt after replacements, do not call model",
	)
	parser.add_argument(
		"--raw-output",
		default=None,
		help="Optional file path to save raw pass-1 model output.",
	)
	parser.add_argument(
		"-o",
		"--output",
		default=None,
		help="Optional pass-2 JSON output file path. If omitted, prints JSON to stdout.",
	)
	return parser.parse_args()


def main() -> None:
	args = parse_args()

	try:
		variables = parse_key_value(args.var, "--var")
		direct_mapping = parse_key_value(args.map, "--map")

		template = load_template(args.template)

		mapping = build_default_mapping(variables)
		mapping.update(direct_mapping)

		rendered_prompt = render_template(
			template=template,
			variables=variables,
			mapping=mapping,
			left_delimiter=args.left_delimiter,
			right_delimiter=args.right_delimiter,
		)

		if args.dry_run:
			print(rendered_prompt)
			return

		if not args.api_key:
			raise ValueError("Missing API key. Provide --api-key or set OPENAI_API_KEY")

		pass1_raw_response = call_openai(
			model=args.model,
			api_key=args.api_key,
			base_url=args.base_url,
			user_prompt=rendered_prompt,
			system_prompt=None,
		)

		if args.raw_output:
			Path(args.raw_output).write_text(pass1_raw_response, encoding="utf-8")

		pass2_prompt = SECOND_PASS_INSTRUCTION_TEMPLATE.replace("__RAW_RESPONSE__", pass1_raw_response)
		pass2_model = args.pass2_model or args.model
		pass2_response = call_openai(
			model=pass2_model,
			api_key=args.api_key,
			base_url=args.base_url,
			user_prompt=pass2_prompt,
			system_prompt=None,
		)

		parsed = extract_json(pass2_response)
		validated = validate_second_pass_output(parsed)

		output_json = json.dumps(validated, ensure_ascii=False, indent=2)
		if args.output:
			Path(args.output).write_text(output_json + "\n", encoding="utf-8")
			print(f"Wrote JSON to {args.output}")
		else:
			print(output_json)

	except Exception as error:
		print(f"Error: {error}", file=sys.stderr)
		sys.exit(1)


if __name__ == "__main__":
	main()
