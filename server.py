#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from cli import (
    DONE_FILE,
    NUM_STEPS,
    QUEUE_FILE,
    STEP_FILES,
    STEP_NAMES,
    project_path,
    read_jsonl,
    step_done,
)

_HTML = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>videoGen</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: monospace; display: flex; height: 100vh; background: #1a1a1a; color: #e0e0e0; overflow: hidden; }
#sidebar { width: 280px; border-right: 1px solid #333; display: flex; flex-direction: column; overflow: hidden; }
#items-panel { flex: 0 0 auto; max-height: 40%; overflow-y: auto; border-bottom: 1px solid #444; }
#items-label { padding: 8px 14px; font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #2a2a2a; }
.item { padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #222; font-size: 13px; }
.item:hover { background: #252525; }
.item.active { background: #2d3748; color: #63b3ed; }
.item-sub { font-size: 11px; color: #666; margin-top: 2px; }
#steps-panel { flex: 1; overflow-y: auto; }
#steps-label { padding: 8px 14px; font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #2a2a2a; }
.step { padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #222; font-size: 13px; display: flex; align-items: center; gap: 8px; }
.step:hover { background: #252525; }
.step.active { background: #1e3a28; color: #68d391; }
.badge { font-size: 10px; padding: 1px 6px; border-radius: 3px; background: #2a2a2a; color: #666; }
.badge.done { background: #1a3a26; color: #68d391; }
#main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
#main-header { padding: 10px 16px; border-bottom: 1px solid #333; font-size: 12px; color: #888; flex-shrink: 0; }
#files { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.file-block { display: flex; flex-direction: column; gap: 6px; }
.file-name { font-size: 11px; color: #666; }
textarea { width: 100%; min-height: 320px; background: #111; color: #e0e0e0; border: 1px solid #2a2a2a; padding: 10px; font-family: monospace; font-size: 12px; resize: vertical; line-height: 1.5; }
textarea:focus { outline: none; border-color: #444; }
.save-row { display: flex; align-items: center; gap: 10px; }
.save-btn { padding: 5px 16px; background: #2d6a4f; color: #fff; border: none; cursor: pointer; font-family: monospace; font-size: 12px; }
.save-btn:hover { background: #40916c; }
.saved-msg { font-size: 11px; color: #68d391; opacity: 0; transition: opacity 0.3s; }
.saved-msg.show { opacity: 1; }
.empty { color: #555; padding: 20px; font-size: 13px; }
.not-generated { color: #555; font-style: italic; padding: 10px; background: #111; border: 1px solid #2a2a2a; font-size: 12px; }
</style>
</head>
<body>
<div id="sidebar">
  <div id="items-panel">
    <div id="items-label">Items</div>
    <div id="items"></div>
  </div>
  <div id="steps-panel">
    <div id="steps-label">Steps</div>
    <div id="steps"></div>
  </div>
</div>
<div id="main">
  <div id="main-header">Select an item and step</div>
  <div id="files"></div>
</div>

<script>
let currentItemId = null;

async function loadItems() {
  const r = await fetch('/api/items');
  const items = await r.json();
  const el = document.getElementById('items');
  el.innerHTML = '';
  if (!items.length) {
    el.innerHTML = '<div class="empty">No items found</div>';
    return;
  }
  items.forEach(item => {
    const d = document.createElement('div');
    d.className = 'item';
    d.innerHTML = `<div>[${item.id}] ${item.name}</div><div class="item-sub">${item.lang} &mdash; ${item.source}</div>`;
    d.onclick = () => selectItem(item.id, d);
    el.appendChild(d);
  });
  el.firstChild.click();
}

async function selectItem(id, el) {
  document.querySelectorAll('.item').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  currentItemId = id;
  document.getElementById('files').innerHTML = '';
  document.getElementById('main-header').textContent = 'Select a step';
  await loadSteps(id);
}

async function loadSteps(id) {
  const r = await fetch(`/api/steps?id=${id}`);
  const steps = await r.json();
  const el = document.getElementById('steps');
  el.innerHTML = '';
  steps.forEach(s => {
    const d = document.createElement('div');
    d.className = 'step';
    d.innerHTML = `<span>${s.num}. ${s.name}</span><span class="badge ${s.done ? 'done' : ''}">${s.done ? 'done' : 'pending'}</span>`;
    d.onclick = () => selectStep(s, d);
    el.appendChild(d);
  });
}

async function selectStep(step, el) {
  document.querySelectorAll('.step').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('main-header').textContent = `Step ${step.num} — ${step.name}`;
  const filesEl = document.getElementById('files');
  filesEl.innerHTML = '';

  for (const filePath of step.files) {
    const r = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
    const data = await r.json();
    const block = document.createElement('div');
    block.className = 'file-block';
    block.innerHTML = `<div class="file-name">${filePath}</div>`;

    if (!data.exists) {
      block.innerHTML += `<div class="not-generated">(not generated yet)</div>`;
    } else {
      const ta = document.createElement('textarea');
      ta.value = data.content;
      block.appendChild(ta);

      const row = document.createElement('div');
      row.className = 'save-row';
      const btn = document.createElement('button');
      btn.className = 'save-btn';
      btn.textContent = 'Save';
      const msg = document.createElement('span');
      msg.className = 'saved-msg';
      msg.textContent = 'Saved';
      btn.onclick = async () => {
        await fetch(`/api/file?path=${encodeURIComponent(filePath)}`, {
          method: 'POST', body: ta.value,
        });
        msg.classList.add('show');
        setTimeout(() => msg.classList.remove('show'), 1500);
      };
      row.appendChild(btn);
      row.appendChild(msg);
      block.appendChild(row);
    }
    filesEl.appendChild(block);
  }
}

loadItems();
</script>
</body>
</html>"""


def _make_handler(filter_id: str | None) -> type:
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: Any) -> None:  # noqa: ARG002
            pass  # silence default access log; signature required by BaseHTTPRequestHandler

        def _json(self, data: Any, status: int = 200) -> None:
            body = json.dumps(data, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)

            if parsed.path == "/":
                body = _HTML.encode()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            elif parsed.path == "/api/items":
                queue = [dict(i, source="queue") for i in read_jsonl(QUEUE_FILE)]
                done = [dict(i, source="done") for i in read_jsonl(DONE_FILE)]
                all_items = queue + done
                if filter_id:
                    all_items = [i for i in all_items if i["id"] == filter_id]
                self._json([
                    {"id": i["id"], "name": i["name"], "lang": i["lang"], "source": i["source"]}
                    for i in all_items
                ])

            elif parsed.path == "/api/steps":
                iid = qs.get("id", [None])[0]
                all_items = read_jsonl(QUEUE_FILE) + read_jsonl(DONE_FILE)
                matches = [i for i in all_items if i["id"] == iid]
                if not matches:
                    self._json({"error": "not found"}, 404)
                    return
                item = matches[0]
                pp = project_path(item)
                self._json([
                    {
                        "num": n,
                        "name": STEP_NAMES[n].strip(),
                        "done": step_done(n, pp),
                        "files": [str(pp / f) for f in STEP_FILES[n]],
                    }
                    for n in range(1, NUM_STEPS + 1)
                ])

            elif parsed.path == "/api/file":
                path_str = qs.get("path", [None])[0]
                if not path_str:
                    self._json({"error": "missing path"}, 400)
                    return
                p = Path(path_str)
                if p.exists():
                    self._json({"exists": True, "content": p.read_text(encoding="utf-8")})
                else:
                    self._json({"exists": False, "content": ""})

            else:
                self.send_response(404)
                self.end_headers()

        def do_POST(self) -> None:
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)

            if parsed.path == "/api/file":
                path_str = qs.get("path", [None])[0]
                if not path_str:
                    self._json({"error": "missing path"}, 400)
                    return
                length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(length).decode("utf-8")
                Path(path_str).write_text(body, encoding="utf-8")
                self._json({"ok": True})
            else:
                self.send_response(404)
                self.end_headers()

    return Handler


def cmd_server(args: argparse.Namespace) -> None:
    handler = _make_handler(args.id)
    httpd = HTTPServer(("", args.port), handler)
    print(f"videoGen server →  http://localhost:{args.port}")
    print("Ctrl+C to stop")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print()
