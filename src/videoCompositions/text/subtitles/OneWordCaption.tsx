import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { WordTiming } from "../../../state/videoStore";

interface OneWordCaptionProps {
    wordTimings: WordTiming[];
}

const findActiveWord = (wordTimings: WordTiming[], currentMs: number): string => {
    if (wordTimings.length === 0) {
        return "";
    }

    const active = wordTimings.find(
        (timing) => timing.startMs <= currentMs && currentMs < timing.endMs
    );

    if (active && !active.isPunctuation) {
        return active.word;
    }

    const latestCompleted = [...wordTimings]
        .filter((timing) => timing.endMs <= currentMs && !timing.isPunctuation)
        .sort((a, b) => b.endMs - a.endMs)[0];

    return latestCompleted?.word ?? "";
};

export const OneWordCaption = ({ wordTimings }: OneWordCaptionProps) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const TIMING_OFFSET_MS = 0;
    const currentMs = (frame / fps) * 1000 + TIMING_OFFSET_MS;

    const currentWord = findActiveWord(wordTimings, currentMs);

    // Find the current word's timing info
    const activeWordTiming = wordTimings.find(
        (timing) => timing.startMs <= currentMs && currentMs < timing.endMs
    );

    // Animation durations (in ms)
    const FADE_IN_DURATION = 80;
    const FADE_OUT_DURATION = 100;
    const SCALE_DURATION = 100;

    // Calculate animations based on word timing
    let opacity = 0;
    let scale = 1;

    if (activeWordTiming && !activeWordTiming.isPunctuation) {
        const timeSinceStart = currentMs - activeWordTiming.startMs;
        const timeUntilEnd = activeWordTiming.endMs - currentMs;

        // Fade in at start
        opacity = interpolate(
            timeSinceStart,
            [0, FADE_IN_DURATION],
            [0, 1],
            { extrapolateRight: "clamp" }
        );

        // Only fade out in the last portion of the word
        if (timeUntilEnd < FADE_OUT_DURATION) {
            opacity *= interpolate(
                timeUntilEnd,
                [0, FADE_OUT_DURATION],
                [0, 1],
                { extrapolateRight: "clamp" }
            );
        }

        // Subtle scale in
        scale = interpolate(
            timeSinceStart,
            [0, SCALE_DURATION],
            [0.95, 1],
            { extrapolateRight: "clamp" }
        );
    }

    return (
        <div
            style={{
                position: "absolute",
                bottom: 300,
                width: "100%",
                textAlign: "center",
                color: "#F0F0F0",
                fontSize: 72,
                fontWeight: "bold",
                textTransform: "none",
                opacity,
                transform: `scale(${scale})`,
            }}
        >
            {currentWord}
        </div>
    );
};
