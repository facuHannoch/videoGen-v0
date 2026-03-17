import "./index.css";
import { Composition } from "remotion";
import { VideoComposition } from "./Composition";
import { videoStore } from "./storage/videoStore";

export const RemotionRoot: React.FC = () => {
  const durationInFrames = Math.max(videoStore.getTotalDurationFrames(), 1);

  return (
    <>
      <Composition
        id="video"
        component={VideoComposition}
        durationInFrames={durationInFrames}
        fps={videoStore.getFPS()}
        width={1080}
        height={1920}
      />
    </>
  );
};
