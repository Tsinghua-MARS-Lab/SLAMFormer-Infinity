import { createReadStream, existsSync, statSync, watch } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.cwd());
const portArg = process.argv.find((arg) => arg.startsWith("--port="));
const port = Number(portArg?.split("=")[1] || process.env.PORT || 8765);
const clients = new Set();

const mime = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".ply": "application/octet-stream",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

const reloadSnippet = `
<script>
  (function () {
    var source = new EventSource("/__live_reload");
    var ready = false;
    source.onmessage = function () {
      if (ready) window.location.reload();
      ready = true;
    };
  })();
</script>`;

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const candidate = normalize(decoded === "/" ? "/index.html" : decoded);
  const fullPath = resolve(join(root, candidate));
  return fullPath.startsWith(root) ? fullPath : null;
}

async function sendHtml(res, filePath) {
  const html = await readFile(filePath, "utf8");
  const body = html.includes("</body>")
    ? html.replace("</body>", `${reloadSnippet}\n</body>`)
    : `${html}${reloadSnippet}`;
  res.writeHead(200, { "Content-Type": mime[".html"] });
  res.end(body);
}

const server = createServer(async (req, res) => {
  if (req.url === "/__live_reload") {
    res.writeHead(200, {
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream"
    });
    res.write("data: connected\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  const filePath = safePath(req.url || "/");
  if (!filePath || !existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const stats = statSync(filePath);
  if (stats.isDirectory()) {
    res.writeHead(302, { Location: "/" });
    res.end();
    return;
  }

  const extension = extname(filePath);
  if (extension === ".html") {
    await sendHtml(res, filePath);
    return;
  }

  if (extension === ".mp4" && req.headers.range) {
    const match = req.headers.range.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Math.min(Number(match[2]), stats.size - 1) : stats.size - 1;

      res.writeHead(206, {
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${stats.size}`,
        "Content-Type": mime[extension]
      });
      createReadStream(filePath, { start, end }).pipe(res);
      return;
    }
  }

  res.writeHead(200, {
    "Accept-Ranges": extension === ".mp4" ? "bytes" : "none",
    "Content-Length": stats.size,
    "Content-Type": mime[extension] || "application/octet-stream"
  });
  createReadStream(filePath).pipe(res);
});

function reloadClients() {
  for (const client of clients) {
    client.write("data: reload\n\n");
  }
}

watch(join(root, "index.html"), reloadClients);
watch(join(root, "static/css/index.css"), reloadClients);

server.listen(port, "127.0.0.1", () => {
  console.log(`SLAMFormer-Infinity dev server: http://127.0.0.1:${port}/`);
});
