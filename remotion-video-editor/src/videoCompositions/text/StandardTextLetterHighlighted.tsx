import type { CSSProperties } from "react";

interface StandardTextLetterHighlightedProps {
    text?: string;
    highlightedIndex?: number;
    highlightedCharacter?: string;
    normalizeForm?: "NFC" | "NFD" | "NFKC" | "NFKD";
    className?: string;
    style?: CSSProperties;
    highlightedStyle?: CSSProperties;
    highlightedFontSize?: number;
}

const splitGraphemes = (value: string) => {
    const intlWithSegmenter = Intl as typeof Intl & {
        Segmenter?: new (
            locales?: string | string[],
            options?: { granularity?: "grapheme" | "word" | "sentence" }
        ) => { segment: (input: string) => Iterable<{ segment: string }> };
    };

    if (intlWithSegmenter.Segmenter) {
        const segmenter = new intlWithSegmenter.Segmenter(undefined, { granularity: "grapheme" });
        return Array.from(segmenter.segment(value), ({ segment }) => segment);
    }

    return Array.from(value);
};

export const StandardTextLetterHighlighted = ({
    text,
    highlightedIndex,
    highlightedCharacter,
    normalizeForm = "NFC",
    className,
    style,
    highlightedStyle,
    highlightedFontSize = 104,
}: StandardTextLetterHighlightedProps) => {
    const normalizedText = (text ?? "").normalize(normalizeForm);
    const characters = splitGraphemes(normalizedText);
    const highlightedCharacterSequence =
        highlightedCharacter && highlightedCharacter.length > 0
            ? splitGraphemes(highlightedCharacter.normalize(normalizeForm))
            : [];
    const highlightedCharacterIndexes = new Set<number>();

    if (highlightedCharacterSequence.length > 0) {
        for (let i = 0; i <= characters.length - highlightedCharacterSequence.length; i++) {
            const isMatch = highlightedCharacterSequence.every(
                (segment, segmentIndex) => characters[i + segmentIndex] === segment
            );

            if (isMatch) {
                for (let segmentIndex = 0; segmentIndex < highlightedCharacterSequence.length; segmentIndex++) {
                    highlightedCharacterIndexes.add(i + segmentIndex);
                }
            }
        }
    }

    // const volume = interpolate(
    //     0,
    //     [0, fadeDuration],
    //     [0, 0.3],
    //     { extrapolateRight: "clamp" }
    // );

    return (
        <div
            className={className}
            style={{
                backgroundColor: "white",
                color: "black",
                fontSize: 64,
                fontWeight: "bold",
                textAlign: "center",
                padding: "18px 28px",
                borderRadius: 8,
                maxWidth: "100%",
                display: "inline-block",
                boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
                lineHeight: 1.15,
                wordBreak: "break-word",
                ...style,
            }}
        >
            {characters.map((character, index) => {
                const isHighlightedByIndex = highlightedIndex === index;
                const isHighlightedByCharacter = highlightedCharacterIndexes.has(index);
                const isHighlighted = isHighlightedByIndex || isHighlightedByCharacter;

                return (
                    <span
                        key={`${character}-${index}`}
                        style={
                            isHighlighted
                                ? {
                                    color: "#446cef",
                                    fontSize: highlightedFontSize,
                                    ...highlightedStyle,
                                }
                                : undefined
                        }
                    >
                        {character}
                    </span>
                );
            })}
        </div>
    );
};