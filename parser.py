from pathlib import Path
import xml.etree.ElementTree as ET

from data import (
    BreakNode,
    EmphasisNode,
    PhonemeNode,
    ProsodyNode,
    RawText,
    SsmlNodes,
    SsmlText,
    TextNode,
    TextPiece,
    TtsProject,
    apply_piece_defaults,
)

DEFAULT_VOICE = "en-US-Ava:DragonHDLatestNeural"


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


def parse_project(xml_path: Path) -> TtsProject:
    tree = ET.parse(xml_path)
    root = tree.getroot()

    if root.tag != "tts_project":
        raise ValueError("Root element must be <tts_project>.")

    language = root.get("language", "en-US")
    voice = root.get("voice", DEFAULT_VOICE)
    output_dir = root.get("output_dir", "audio")

    pieces: list[TextPiece] = []
    for index, piece_elem in enumerate(root.findall("piece"), start=1):
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

    apply_piece_defaults(pieces)

    return TtsProject(
        language=language,
        voice=voice,
        output_dir=output_dir,
        pieces=pieces,
    )
