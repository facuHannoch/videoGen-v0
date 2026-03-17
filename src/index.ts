import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";
import { videoStore } from "./storage/videoStore";
import { soundStore } from "./storage/soundStore";

const bootstrap = async () => {
	try {
		await Promise.all([videoStore.initPromise, soundStore.initPromise]);
	} catch (error) {
		console.error("Failed to initialize media stores:", error);
	}

	registerRoot(RemotionRoot);
};

void bootstrap();
