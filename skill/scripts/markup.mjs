#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

function usage() {
  console.log(`Usage:
  node markup.mjs open --image screenshot.png [--title "UI Review"] [--url https://example.com/]

Environment:
  MARKUP_URL  Default board URL. Falls back to http://127.0.0.1:4173/`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command };
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (!key.startsWith("--")) continue;
    options[key.slice(2)] = rest[index + 1];
    index += 1;
  }
  return options;
}

function mimeType(path) {
  const extension = extname(path).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/png";
}

function openFile(path) {
  const platform = process.platform;
  const command =
    platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", path] : [path];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

const options = parseArgs(process.argv.slice(2));
if (options.command !== "open" || !options.image) {
  usage();
  process.exitCode = 1;
} else {
  const imageBytes = await readFile(options.image);
  const boardUrl = new URL(
    options.url || process.env.MARKUP_URL || "http://127.0.0.1:4173/",
  );
  const token = randomUUID();
  const requestId = randomUUID();
  const boardId = `review-${Date.now().toString(36)}`;
  const image = `data:${mimeType(options.image)};base64,${imageBytes.toString("base64")}`;
  boardUrl.searchParams.set("token", token);

  const payload = {
    boardId,
    title: options.title || basename(options.image),
    images: [{ id: "screen-1", role: "primary", src: image }],
  };
  const launcherPath = join(tmpdir(), `markup-launcher-${requestId}.html`);
  const launcher = `<!doctype html>
<meta charset="utf-8">
<title>Open Markup</title>
<style>
body{font:14px system-ui;margin:40px;color:#171813}button{padding:12px 18px}#error{margin-top:18px;color:#b42318}
</style>
<button id="open">Open Markup review board</button>
<div id="error" hidden>Markup did not confirm the image import. Click the button to retry.</div>
<script>
const target=${JSON.stringify(boardUrl.href)};
const token=${JSON.stringify(token)};
const requestId=${JSON.stringify(requestId)};
const payload=${JSON.stringify(payload)};
let board;
let timer;
function send(){
  if(!board||board.closed){document.querySelector("#error").hidden=false;return;}
  board.postMessage({type:"markup:import",token,requestId,payload},new URL(target).origin);
  clearTimeout(timer);
  timer=setTimeout(()=>document.querySelector("#error").hidden=false,5000);
}
function openBoard(){
  document.querySelector("#error").hidden=true;
  board=window.open(target,"markup-review");
  setTimeout(send,900);
}
window.addEventListener("message",event=>{
  if(event.origin!==new URL(target).origin||event.data?.requestId!==requestId)return;
  if(event.data.type==="markup:ack"&&event.data.ok){
    clearTimeout(timer);
    document.querySelector("#error").hidden=true;
    window.close();
  }else if(event.data.type==="markup:error"){
    clearTimeout(timer);
    document.querySelector("#error").hidden=false;
  }
});
document.querySelector("#open").addEventListener("click",openBoard);
openBoard();
</script>`;

  await writeFile(launcherPath, launcher);
  openFile(launcherPath);
  console.log(`Markup launcher opened for ${options.image}`);
}
