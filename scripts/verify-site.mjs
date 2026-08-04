import { existsSync, readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const visibleText = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
const failures = [];

const requiredVisibleText = [
  "SLAMFormer",
  "Infinite SLAM Transformer for Unbounded Frontend and Backend Processing",
  "17 km",
  "Memory conditions",
  "Global PGGO",
  "IIIS, Tsinghua University"
];

const requiredSnippets = [
  'id="demo"',
  'id="idea"',
  'id="method"',
  'id="results"',
  'id="citation"',
  "data-online-demo-carousel",
  "CENTER FOCUS · AUTO PLAY",
  "data-online-demo-prev",
  "data-online-demo-next",
  "./static/SLAMFormer-Infty-demo.mp4",
  "./static/demo/kitti-00.mp4",
  "./static/demo/kitti-01.mp4",
  "./static/demo/kitti-02.mp4",
  "./static/demo/kitti-03.mp4",
  "./static/demo/kitti-04.mp4",
  "./static/demo/kitti-05.mp4",
  "./static/demo/kitti-07.mp4",
  "./static/demo/kitti-09.mp4",
  "./static/demo/kitti-10.mp4",
  "./static/images/slamformer-infinity/demo-long.jpg",
  "./static/images/slamformer-infinity/17km-demo.jpg",
  "./static/images/slamformer-infinity/comparison.jpg",
  "./static/images/slamformer-infinity/pipeline.jpg",
  "./static/images/slamformer-infinity/kitti05.jpg",
  "./static/images/slamformer-infinity/fine.jpg",
  "./static/js/pointcloud-explorer.js",
  "data-model=\"vggtlong\"",
  "data-model=\"slamformer-infinity\"",
  "Route Length",
  "5067 m",
  "394 m",
  "2206 m",
  "1705 m",
  "920 m",
  "26.358 m",
  "23.011 m",
  "1.996 m",
  "1.813 m",
  "0.068 m",
  "0.046 m",
  "data-copy-citation"
];

for (const text of requiredVisibleText) {
  if (!visibleText.includes(text)) {
    failures.push(`Missing visible text: ${text}`);
  }
}

for (const snippet of requiredSnippets) {
  if (!html.includes(snippet)) {
    failures.push(`Missing required content: ${snippet}`);
  }
}

const sequenceTabs = html.match(/data-sequence-tab=/g) ?? [];
const sequencePanels = html.match(/data-sequence-panel=/g) ?? [];
if (sequenceTabs.length !== 5) {
  failures.push(`Expected 5 sequence tabs, found ${sequenceTabs.length}`);
}
if (sequencePanels.length !== 5) {
  failures.push(`Expected 5 sequence panels, found ${sequencePanels.length}`);
}

for (const model of ["vggtlong", "slamformer-infinity"]) {
  for (const sequence of ["02", "04", "05", "09", "10"]) {
    const pointCloud = `static/pointcloud/${model}/${sequence}.ply`;
    if (!existsSync(pointCloud)) {
      failures.push(`Point cloud asset does not exist: ${pointCloud}`);
    }
  }
}

for (const vendorAsset of [
  "static/vendor/three.module.js",
  "static/vendor/three.core.js",
  "static/vendor/addons/controls/OrbitControls.js",
  "static/vendor/addons/loaders/PLYLoader.js"
]) {
  if (!existsSync(vendorAsset)) {
    failures.push(`Viewer dependency does not exist: ${vendorAsset}`);
  }
}

for (const sequence of [
  "00", "01", "02", "03", "04", "05", "07", "09", "10",
  "11", "12", "15", "17", "18", "19", "20", "21"
]) {
  const demo = `static/demo/kitti-${sequence}.mp4`;
  if (!existsSync(demo)) {
    failures.push(`Online demo asset does not exist: ${demo}`);
  }
}

const forbiddenSnippets = [
  "OMG",
  "Omni-Modal",
  "Unitree",
  "Motion Generation",
  "OMG-DiT"
];

for (const snippet of forbiddenSnippets) {
  if (html.includes(snippet)) {
    failures.push(`Template content remains: ${snippet}`);
  }
}

const references = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
for (const reference of references) {
  if (/^(https?:|mailto:|#)/.test(reference)) continue;
  const path = reference.replace(/^\.\//, "").split("#")[0].split("?")[0];
  if (path && !existsSync(path)) {
    failures.push(`Referenced asset does not exist: ${reference}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("SLAMFormer-Infinity site verification passed.");
