from copy import deepcopy
from pathlib import Path
import xml.etree.ElementTree as ET

from data import (
    BreakNode,
    EmphasisNode,
    PhonemeNode,
    ProsodyNode,
    RawText,
    SpeakDocument,
    SsmlNodes,
    SsmlText,
    TextNode,
    TextPiece,
    TtsProject,
    apply_piece_defaults,
)

DEFAULT_VOICE = "en-US-Ava:DragonHDLatestNeural"


def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def _parse_ssml_text_node(ssml_elem: ET.Element) -> SsmlText:
    nodes: list[SsmlNodes] = []

    if ssml_elem.text and ssml_elem.text.strip():
        nodes.append(TextNode(ssml_elem.text))

    for child in ssml_elem:
        if child.tag == "break":
            time = child.get("time")
            if not time:
                raise ValueError("Missing 'time' attribute in <break>.")
            nodes.append(BreakNode(time=time))
        elif child.tag == "prosody":
            nodes.append(
                ProsodyNode(
                    value=(child.text or ""),
                    rate=child.get("rate"),
                    pitch=child.get("pitch"),
                    volume=child.get("volume"),
                )
            )
        elif child.tag == "phoneme":
            ph = child.get("ph")
            if not ph:
                raise ValueError("Missing 'ph' attribute in <phoneme>.")
            nodes.append(
                PhonemeNode(
                    text=(child.text or ""),
                    ph=ph,
                    alphabet=child.get("alphabet", "ipa"),
                )
            )
        elif child.tag == "emphasis":
            nodes.append(
                EmphasisNode(
                    value=(child.text or ""),
                    level=child.get("level"),
                )
            )
        elif child.tag == "text":
            nodes.append(TextNode(child.text or ""))
        else:
            raise ValueError(f"Unsupported tag <{child.tag}> inside <ssml_text>.")

        if child.tail:
            nodes.append(TextNode(child.tail))

    return SsmlText(nodes=nodes)


def _split_compound_speak(speak_elem: ET.Element) -> list[ET.Element]:
    if not any(_local_name(child.tag) == "speak" for child in list(speak_elem)):
        return [speak_elem]

    speak_parts: list[ET.Element] = []
    pending_children: list[ET.Element] = []
    leading_text = speak_elem.text if speak_elem.text and speak_elem.text.strip() else None

    def _flush_pending() -> None:
        nonlocal pending_children, leading_text
        if not pending_children:
            return

        part = ET.Element(speak_elem.tag, dict(speak_elem.attrib))
        if leading_text:
            part.text = leading_text
            leading_text = None

        for child in pending_children:
            part.append(deepcopy(child))

        speak_parts.append(part)
        pending_children = []

    for child in list(speak_elem):
        if _local_name(child.tag) == "speak":
            _flush_pending()
            continue
        pending_children.append(child)

    _flush_pending()
    return speak_parts or [speak_elem]


def parse_project(xml_path: Path) -> TtsProject:
    tree = ET.parse(xml_path)
    root = tree.getroot()

    if root.tag != "tts_project":
        raise ValueError("Root element must be <tts_project>.")

    language = root.get("language", "en-US")
    voice = root.get("voice", DEFAULT_VOICE)
    output_dir = root.get("output_dir", "audio")

    project_children = list(root)
    speak_elems = [child for child in project_children if _local_name(child.tag) == "speak"]
    piece_elems = [child for child in project_children if _local_name(child.tag) == "piece"]

    if piece_elems and speak_elems:
        raise ValueError("Use either project-level <speak> elements or <piece> elements, not both.")

    pieces: list[TextPiece] = []
    if speak_elems:
        expanded_speak_elems: list[ET.Element] = []
        for speak_elem in speak_elems:
            expanded_speak_elems.extend(_split_compound_speak(speak_elem))

        for index, speak_elem in enumerate(expanded_speak_elems, start=1):
            pieces.append(
                TextPiece(
                    index=index,
                    content=SpeakDocument(root=speak_elem),
                )
            )
        apply_piece_defaults(pieces)
        return TtsProject(
            language=language,
            voice=voice,
            output_dir=output_dir,
            pieces=pieces,
        )

    for index, piece_elem in enumerate(piece_elems, start=1):
        raw_elem = piece_elem.find("raw_text")
        ssml_elem = piece_elem.find("ssml_text")

        if raw_elem is not None and ssml_elem is not None:
            raise ValueError(f"Piece at position {index} has both raw_text and ssml_text.")
        if raw_elem is None and ssml_elem is None:
            raise ValueError(f"Piece at position {index} must define raw_text or ssml_text.")

        if raw_elem is not None:
            content = RawText(content=(raw_elem.text or "").strip())
        else:
            content = _parse_ssml_text_node(ssml_elem)  # type: ignore[arg-type]

        pieces.append(
            TextPiece(
                index=index,
                id=piece_elem.get("id"),
                filename=piece_elem.get("filename"),
                content=content,
            )
        )

    if not pieces:
        raise ValueError("Project must define at least one <piece> or one project-level <speak>.")

    apply_piece_defaults(pieces)

    return TtsProject(
        language=language,
        voice=voice,
        output_dir=output_dir,
        pieces=pieces,
    )
