import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEYFRAMES_FILE = path.resolve(__dirname, "../src/screen-keyframes.json");
const PORT = 3001;

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/delete-keyframe") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { screenId, frame } = JSON.parse(body);
        const data = JSON.parse(fs.readFileSync(KEYFRAMES_FILE, "utf8"));

        if (data.screens[screenId]) {
          data.screens[screenId] = data.screens[screenId].filter((k) => k.frame !== frame);
          fs.writeFileSync(KEYFRAMES_FILE, JSON.stringify(data, null, 2));
          console.log(`[keyframe] deleted screenId="${screenId}" frame=${frame}`);
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        console.error("[keyframe] delete error:", e.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === "POST" && req.url === "/keyframe") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { screenId, frame, absoluteFrame, corners } = JSON.parse(body);
        const data = JSON.parse(fs.readFileSync(KEYFRAMES_FILE, "utf8"));

        if (!data.screens[screenId]) data.screens[screenId] = [];
        const kfs = data.screens[screenId];
        const idx = kfs.findIndex((k) => k.frame === frame);
        const entry = { frame, ...(absoluteFrame !== undefined ? { absoluteFrame } : {}), corners };

        if (idx >= 0) {
          kfs[idx] = entry;
        } else {
          kfs.push(entry);
          kfs.sort((a, b) => a.frame - b.frame);
        }

        fs.writeFileSync(KEYFRAMES_FILE, JSON.stringify(data, null, 2));
        console.log(`[keyframe] saved screenId="${screenId}" frame=${frame} absoluteFrame=${absoluteFrame ?? "n/a"}`);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        console.error("[keyframe] error:", e.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => console.log(`Keyframe server running on http://localhost:${PORT}`));
