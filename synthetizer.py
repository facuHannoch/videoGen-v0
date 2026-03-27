import os
import json
import re
from pathlib import Path
from typing import Protocol, Any
from xml.sax.saxutils import escape

import azure.cognitiveservices.speech as speechsdk

from data import RawText, SpeakDocument, SSML_NAMESPACE, TextPiece
from json_manifest import normalize_subtitle


MIN_WORD_DURATION_MS = 120.0


class Synthesizer(Protocol):
    def synthesize(self, piece: TextPiece, output_path: Path) -> None:
        ...


class AzureSynthesizer:
    def __init__(self, speech_key: str, endpoint: str, voice: str, language: str) -> None:
        self.language = language
        self.voice = voice
        self.speech_config = speechsdk.SpeechConfig(
            subscription=speech_key,
            endpoint=endpoint,
        )
        self.speech_config.speech_synthesis_voice_name = voice

    def _wrap_ssml(self, inner: str) -> str:
        return (
            f'<speak version="1.0" xmlns="{SSML_NAMESPACE}" xml:lang="{self.language}">'
            f'<voice name="{self.voice}">{inner}</voice>'
            "</speak>"
        )

    @staticmethod
    def _ticks_to_ms(value: Any) -> float | None:
        if value is None:
            return None
        try:
            return float(value) / 10_000.0
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _is_punctuation(word: str) -> bool:
        return bool(word) and re.fullmatch(r"[\W_]+", word) is not None

    def _normalize_token_timeline(self, timings: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not timings:
            return timings

        normalized = sorted(timings, key=lambda item: item["startMs"])

        for index in range(1, len(normalized)):
            previous = normalized[index - 1]
            current = normalized[index]

            previous_end = float(previous["endMs"])
            current_start = float(current["startMs"])

            if current_start < previous_end:
                current["startMs"] = round(previous_end, 3)

            if float(current["endMs"]) <= float(current["startMs"]):
                current["endMs"] = round(float(current["startMs"]) + MIN_WORD_DURATION_MS, 3)

        return normalized

    def _build_word_timings(
        self,
        boundary_events: list[dict[str, Any]],
        source_text: str | None,
        total_audio_ms: float | None,
    ) -> list[dict[str, Any]]:
        if not boundary_events:
            return []

        events = sorted(boundary_events, key=lambda item: item["startMs"])
        timings: list[dict[str, Any]] = []

        for index, event in enumerate(events):
            start_ms = event["startMs"]
            duration_ms = event.get("durationMs")
            text_offset = event.get("textOffset")
            word_length = event.get("wordLength")
            event_text = event.get("text") or ""

            next_start_ms = events[index + 1]["startMs"] if index + 1 < len(events) else None
            if duration_ms is not None and duration_ms > 0:
                end_ms = start_ms + duration_ms
            elif next_start_ms is not None:
                end_ms = next_start_ms
            else:
                if total_audio_ms is not None and total_audio_ms > start_ms:
                    end_ms = total_audio_ms
                else:
                    end_ms = start_ms + MIN_WORD_DURATION_MS

            if next_start_ms is not None and end_ms > next_start_ms:
                end_ms = next_start_ms

            if end_ms <= start_ms:
                end_ms = start_ms + MIN_WORD_DURATION_MS

            word = event_text.strip()
            char_start: int | None = None
            char_end: int | None = None

            if source_text and isinstance(text_offset, int) and isinstance(word_length, int):
                if 0 <= text_offset <= len(source_text):
                    char_start = text_offset
                    char_end = min(text_offset + max(word_length, 0), len(source_text))
                    span_text = source_text[char_start:char_end]
                    word = span_text if span_text != "" else word

            is_punctuation = bool(event.get("isPunctuation"))
            if not is_punctuation:
                is_punctuation = self._is_punctuation(word)

            timings.append(
                {
                    "tokenIndex": index,
                    "word": word,
                    "startMs": round(start_ms, 3),
                    "endMs": round(end_ms, 3),
                    "charStart": char_start,
                    "charEnd": char_end,
                    "isPunctuation": is_punctuation,
                }
            )

        return self._normalize_token_timeline(timings)

    def _save_word_timing_sidecar(
        self,
        output_path: Path,
        label: str,
        boundary_events: list[dict[str, Any]],
        source_text: str | None,
        total_audio_ms: float | None,
    ) -> None:
        word_timings = self._build_word_timings(
            boundary_events=boundary_events,
            source_text=source_text,
            total_audio_ms=total_audio_ms,
        )
        payload = {
            "id": label,
            "audioFile": output_path.name,
            "subtitle": normalize_subtitle(source_text),
            "wordTimings": word_timings,
        }
        sidecar_path = output_path.with_suffix(".info.json")
        sidecar_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Generated timings [{label}]: {sidecar_path}")

    def _synthesize_with_word_boundaries(
        self,
        *,
        synthesize_call,
        output_path: Path,
        label: str,
        source_text: str | None,
    ):
        output_path.parent.mkdir(parents=True, exist_ok=True)

        audio_config = speechsdk.audio.AudioOutputConfig(filename=str(output_path))
        engine = speechsdk.SpeechSynthesizer(
            speech_config=self.speech_config,
            audio_config=audio_config,
        )

        boundary_events: list[dict[str, Any]] = []

        def _on_word_boundary(evt) -> None:
            boundary_type = str(getattr(evt, "boundary_type", ""))
            is_word = "Word" in boundary_type
            is_punctuation = "Punctuation" in boundary_type

            if boundary_type and not (is_word or is_punctuation):
                return

            start_ms = self._ticks_to_ms(getattr(evt, "audio_offset", None))
            duration_ms = self._ticks_to_ms(getattr(evt, "duration", None))
            text_offset = getattr(evt, "text_offset", None)
            word_length = getattr(evt, "word_length", None)
            text = getattr(evt, "text", None)

            if start_ms is None:
                return

            boundary_events.append(
                {
                    "startMs": start_ms,
                    "durationMs": duration_ms,
                    "textOffset": text_offset,
                    "wordLength": word_length,
                    "text": text,
                    "isPunctuation": is_punctuation,
                }
            )

        engine.synthesis_word_boundary.connect(_on_word_boundary)
        result = synthesize_call(engine)
        total_audio_ms = self._ticks_to_ms(getattr(result, "audio_duration", None))

        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            print(f"Generated [{label}]: {output_path}")
            self._save_word_timing_sidecar(
                output_path=output_path,
                label=label,
                boundary_events=boundary_events,
                source_text=source_text,
                total_audio_ms=total_audio_ms,
            )
            return result

        if result.reason == speechsdk.ResultReason.Canceled:
            details = result.cancellation_details
            print(f"Canceled [{label}]: {details.reason}")
            if details.reason == speechsdk.CancellationReason.Error and details.error_details:
                print(f"Error details: {details.error_details}")
            return result

        print(f"Unexpected result [{label}]: {result.reason}")
        return result

    def synthesize(self, piece: TextPiece, output_path: Path) -> None:
        piece_name = piece.id or f"piece-{piece.index}"
        source_text = piece.plain_text()

        if isinstance(piece.content, RawText):
            self._synthesize_with_word_boundaries(
                synthesize_call=lambda engine: engine.speak_text_async(piece.content.content).get(),
                output_path=output_path,
                label=piece_name,
                source_text=source_text,
            )
            return

        if isinstance(piece.content, SpeakDocument):
            self._synthesize_with_word_boundaries(
                synthesize_call=lambda engine: engine.speak_ssml_async(
                    piece.content.to_ssml(
                        default_language=self.language,
                        default_voice=self.voice,
                    )
                ).get(),
                output_path=output_path,
                label=piece_name,
                source_text=source_text,
            )
            return

        self._synthesize_with_word_boundaries(
            synthesize_call=lambda engine: engine.speak_ssml_async(
                self._wrap_ssml(piece.content.to_inner_ssml())
            ).get(),
            output_path=output_path,
            label=piece_name,
            source_text=source_text,
        )

    def synthesize_ssml_inner(self, inner_ssml: str, output_path: Path, label: str = "unified") -> None:
        self._synthesize_with_word_boundaries(
            synthesize_call=lambda engine: engine.speak_ssml_async(self._wrap_ssml(inner_ssml)).get(),
            output_path=output_path,
            label=label,
            source_text=None,
        )

    def synthesize_ssml_document(
        self,
        ssml_document: str,
        output_path: Path,
        label: str = "unified",
    ) -> None:
        self._synthesize_with_word_boundaries(
            synthesize_call=lambda engine: engine.speak_ssml_async(ssml_document).get(),
            output_path=output_path,
            label=label,
            source_text=None,
        )


def piece_to_ssml_inner(piece: TextPiece) -> str:
    if isinstance(piece.content, RawText):
        return escape(piece.content.content)
    if isinstance(piece.content, SpeakDocument):
        raise ValueError("Project-level <speak> cannot be nested inside wrapped SSML.")
    return piece.content.to_inner_ssml()


def build_azure_synthesizer(voice: str, language: str) -> AzureSynthesizer:
    speech_key = os.getenv("SPEECH_KEY")
    endpoint = os.getenv("ENDPOINT")
    if not speech_key:
        raise ValueError("Missing SPEECH_KEY in environment.")
    if not endpoint:
        raise ValueError("Missing ENDPOINT in environment.")

    return AzureSynthesizer(
        speech_key=speech_key,
        endpoint=endpoint,
        voice=voice,
        language=language,
    )
