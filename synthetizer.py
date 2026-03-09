import os
from pathlib import Path
from typing import Protocol
from xml.sax.saxutils import escape

import azure.cognitiveservices.speech as speechsdk

from data import RawText, TextPiece


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
            f'<speak version="1.0" xml:lang="{self.language}">'
            f'<voice name="{self.voice}">{inner}</voice>'
            "</speak>"
        )

    def synthesize(self, piece: TextPiece, output_path: Path) -> None:
        output_path.parent.mkdir(parents=True, exist_ok=True)

        audio_config = speechsdk.audio.AudioOutputConfig(filename=str(output_path))
        engine = speechsdk.SpeechSynthesizer(
            speech_config=self.speech_config,
            audio_config=audio_config,
        )

        if isinstance(piece.content, RawText):
            result = engine.speak_text_async(piece.content.content).get()
        else:
            result = engine.speak_ssml_async(
                self._wrap_ssml(piece.content.to_inner_ssml())
            ).get()

        piece_name = piece.id or f"piece-{piece.index}"
        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            print(f"Generated [{piece_name}]: {output_path}")
            return

        if result.reason == speechsdk.ResultReason.Canceled:
            details = result.cancellation_details
            print(f"Canceled [{piece_name}]: {details.reason}")
            if details.reason == speechsdk.CancellationReason.Error and details.error_details:
                print(f"Error details: {details.error_details}")
            return

        print(f"Unexpected result [{piece_name}]: {result.reason}")

    def synthesize_ssml_inner(self, inner_ssml: str, output_path: Path, label: str = "unified") -> None:
        output_path.parent.mkdir(parents=True, exist_ok=True)

        audio_config = speechsdk.audio.AudioOutputConfig(filename=str(output_path))
        engine = speechsdk.SpeechSynthesizer(
            speech_config=self.speech_config,
            audio_config=audio_config,
        )
        result = engine.speak_ssml_async(self._wrap_ssml(inner_ssml)).get()

        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            print(f"Generated [{label}]: {output_path}")
            return

        if result.reason == speechsdk.ResultReason.Canceled:
            details = result.cancellation_details
            print(f"Canceled [{label}]: {details.reason}")
            if details.reason == speechsdk.CancellationReason.Error and details.error_details:
                print(f"Error details: {details.error_details}")
            return

        print(f"Unexpected result [{label}]: {result.reason}")


def piece_to_ssml_inner(piece: TextPiece) -> str:
    if isinstance(piece.content, RawText):
        return escape(piece.content.content)
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
