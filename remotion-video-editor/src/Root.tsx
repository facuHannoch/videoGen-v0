import "./index.css";
import { Composition } from "remotion";
import { videoStore } from "./state/videoStore";
// import { IPAPhonemeVideoComposition } from "./IPAPhonemeComposition";
import { WordPronunciationV2VideoComposition } from "./WordComposition-v2";

export const RemotionRoot: React.FC = () => {
  const durationInFrames = Math.max(videoStore.getTotalDurationFrames(), 1);

  return (
    <>
      <Composition
        id="video"
        component={WordPronunciationV2VideoComposition}
        durationInFrames={durationInFrames}
        fps={videoStore.getFPS()}
        width={1080}
        height={1920}
      />
    </>
  );
};
