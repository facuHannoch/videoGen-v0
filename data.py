import copy
from dataclasses import dataclass
import re
from typing import List, Protocol, Union
import xml.etree.ElementTree as ET

DEFAULT_FILENAME_MAX_LENGTH = 100
FILE_EXTENSION = ".wav"
DEFAULT_SPEAK_VERSION = "1.0"
SSML_NAMESPACE = "http://www.w3.org/2001/10/synthesis"
XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace"

ET.register_namespace("", SSML_NAMESPACE)


class SsmlNode(Protocol):
    def to_ssml(self) -> str:
        ...

    def to_plain_text(self) -> str:
        ...


@dataclass(frozen=True)
class TextNode:
    value: str

    def to_ssml(self) -> str:
        return self.value

    def to_plain_text(self) -> str:
        return self.value


@dataclass(frozen=True)
class BreakNode:
    time: str

    def to_ssml(self) -> str:
        return f'<break time="{self.time}"/>'

    def to_plain_text(self) -> str:
        return " "


@dataclass(frozen=True)
class ProsodyNode:
    value: str
    rate: str | None = None
    pitch: str | None = None
    volume: str | None = None

    def to_ssml(self) -> str:
        attrs: list[str] = []
        if self.rate:
            attrs.append(f'rate="{self.rate}"')
        if self.pitch:
            attrs.append(f'pitch="{self.pitch}"')
        if self.volume:
            attrs.append(f'volume="{self.volume}"')
        attr_block = " ".join(attrs)
        if attr_block:
            return f"<prosody {attr_block}>{self.value}</prosody>"
        return f"<prosody>{self.value}</prosody>"

    def to_plain_text(self) -> str:
        return self.value


@dataclass(frozen=True)
class PhonemeNode:
    text: str
    ph: str
    alphabet: str = "ipa"

    def to_ssml(self) -> str:
        return f'<phoneme alphabet="{self.alphabet}" ph="{self.ph}">{self.text}</phoneme>'

    def to_plain_text(self) -> str:
        return self.text


@dataclass(frozen=True)
class EmphasisNode:
    value: str
    level: str | None = None

    def to_ssml(self) -> str:
        if self.level:
            return f'<emphasis level="{self.level}">{self.value}</emphasis>'
        return f"<emphasis>{self.value}</emphasis>"

    def to_plain_text(self) -> str:
        return self.value


SsmlNodes = Union[TextNode, BreakNode, ProsodyNode, PhonemeNode, EmphasisNode]


@dataclass(frozen=True)
class RawText:
    content: str

    def plain_text(self) -> str:
        return self.content


@dataclass(frozen=True)
class SsmlText:
    nodes: List[SsmlNodes]

    def to_inner_ssml(self) -> str:
        return "".join(node.to_ssml() for node in self.nodes)

    def plain_text(self) -> str:
        return "".join(node.to_plain_text() for node in self.nodes)


TextContent = Union[RawText, SsmlText, "SpeakDocument"]


def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def _namespace_ssml_tree(elem: ET.Element) -> None:
    if isinstance(elem.tag, str) and not elem.tag.startswith("{"):
        elem.tag = f"{{{SSML_NAMESPACE}}}{elem.tag}"

    for child in list(elem):
        _namespace_ssml_tree(child)


def _apply_default_voice(speak_elem: ET.Element, default_voice: str) -> None:
    voice_children = [child for child in list(speak_elem) if _local_name(child.tag) == "voice"]

    if voice_children:
        for voice_elem in voice_children:
            if not voice_elem.get("name"):
                voice_elem.set("name", default_voice)
        return

    voice_elem = ET.Element(f"{{{SSML_NAMESPACE}}}voice")
    voice_elem.set("name", default_voice)
    voice_elem.text = speak_elem.text
    speak_elem.text = None

    existing_children = list(speak_elem)
    for child in existing_children:
        speak_elem.remove(child)
        voice_elem.append(child)

    speak_elem.append(voice_elem)


@dataclass(frozen=True)
class SpeakDocument:
    root: ET.Element

    def plain_text(self) -> str:
        return " ".join("".join(self.root.itertext()).split())

    def to_ssml(
        self,
        default_language: str,
        default_voice: str,
        default_version: str = DEFAULT_SPEAK_VERSION,
    ) -> str:
        speak_elem = copy.deepcopy(self.root)
        _namespace_ssml_tree(speak_elem)

        if _local_name(speak_elem.tag) != "speak":
            raise ValueError("SpeakDocument root must be <speak>.")

        if not speak_elem.get("version"):
            speak_elem.set("version", default_version)

        lang_attr = f"{{{XML_NAMESPACE}}}lang"
        if not speak_elem.get(lang_attr):
            speak_elem.set(lang_attr, default_language)

        _apply_default_voice(speak_elem, default_voice)
        return ET.tostring(speak_elem, encoding="unicode")


@dataclass
class TextPiece:
    index: int
    content: TextContent
    id: str | None = None
    filename: str | None = None

    def plain_text(self) -> str:
        if isinstance(self.content, RawText):
            return self.content.plain_text()
        return self.content.plain_text()


@dataclass
class TtsProject:
    language: str
    voice: str
    output_dir: str
    pieces: List[TextPiece]

    def contains_speak_document(self) -> bool:
        return any(isinstance(piece.content, SpeakDocument) for piece in self.pieces)


def generate_default_id(index: int, content_text: str) -> str:
    normalized = " ".join((content_text or "").split())
    snippet = normalized[:5]
    if not snippet:
        snippet = "item"
    return f"{index:02d}{snippet}"


def generate_default_filename(
    content_text: str,
    fallback_id: str,
    index: int,
    max_length: int = DEFAULT_FILENAME_MAX_LENGTH,
) -> str:
    raw = " ".join((content_text or "").split())
    prefix = f"{index:02d}_"
    suffix = FILE_EXTENSION
    max_base_length = max(1, max_length - len(prefix) - len(suffix))

    if not raw:
        base = fallback_id
        return f"{prefix}{base[:max_base_length]}{suffix}"

    chars: list[str] = []
    for char in raw:
        if char == " ":
            chars.append("_")
        elif char.isalpha():
            chars.append(char.lower())
        else:
            chars.append("-")

    name = "".join(chars)
    name = re.sub(r"_+", "_", name)
    name = re.sub(r"-+", "-", name)
    name = name.strip("_-")
    if not name:
        name = fallback_id
    name = name[:max_base_length]
    return f"{prefix}{name}{suffix}"


def apply_piece_defaults(pieces: List[TextPiece]) -> None:
    for piece in pieces:
        content_text = piece.plain_text()
        default_id = generate_default_id(piece.index, content_text)
        if not piece.id:
            piece.id = default_id
        if not piece.filename:
            piece.filename = generate_default_filename(
                content_text=content_text,
                fallback_id=piece.id,
                index=piece.index,
            )
