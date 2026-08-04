import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(projectRoot, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, "server"), { recursive: true });
await mkdir(join(dist, "static", "css"), { recursive: true });
await mkdir(join(dist, "static", "images"), { recursive: true });
await cp(join(projectRoot, "index.html"), join(dist, "index.html"));
await cp(join(projectRoot, "slamformer-infinity.pdf"), join(dist, "slamformer-infinity.pdf"));
await cp(join(projectRoot, "static", "css", "index.css"), join(dist, "static", "css", "index.css"));
await cp(join(projectRoot, "static", "images", "slamformer-infinity"), join(dist, "static", "images", "slamformer-infinity"), { recursive: true });
await cp(join(projectRoot, "static", "js"), join(dist, "static", "js"), { recursive: true });
await cp(join(projectRoot, "static", "pointcloud"), join(dist, "static", "pointcloud"), { recursive: true });
await cp(join(projectRoot, "static", "vendor"), join(dist, "static", "vendor"), { recursive: true });
await cp(join(projectRoot, "static", "demo"), join(dist, "static", "demo"), { recursive: true });
await cp(join(projectRoot, "static", "SLAMFormer-Infty-demo.mp4"), join(dist, "static", "SLAMFormer-Infty-demo.mp4"));
await writeFile(join(dist, ".nojekyll"), "");

await writeFile(join(dist, "server", "index.js"), `
const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") url.pathname = "/index.html";
    return env.ASSETS.fetch(new Request(url, request));
  }
};

export default worker;
`);

console.log(`Built static Sites artifact in ${dist}`);
