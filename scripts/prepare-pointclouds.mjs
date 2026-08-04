import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(projectRoot, "..", "latex", "figs", "pointcloud");
const outputRoot = join(projectRoot, "static", "pointcloud");
const sequences = ["02", "04", "05", "09", "10"];
const models = [
  { name: "vggtlong", maxPoints: 250_000 },
  { name: "slamformer-infinity", maxPoints: 350_000 }
];

const scalarTypes = {
  char: { size: 1, read: "readInt8" },
  uchar: { size: 1, read: "readUInt8" },
  int8: { size: 1, read: "readInt8" },
  uint8: { size: 1, read: "readUInt8" },
  short: { size: 2, read: "readInt16LE" },
  ushort: { size: 2, read: "readUInt16LE" },
  int16: { size: 2, read: "readInt16LE" },
  uint16: { size: 2, read: "readUInt16LE" },
  int: { size: 4, read: "readInt32LE" },
  uint: { size: 4, read: "readUInt32LE" },
  int32: { size: 4, read: "readInt32LE" },
  uint32: { size: 4, read: "readUInt32LE" },
  float: { size: 4, read: "readFloatLE" },
  float32: { size: 4, read: "readFloatLE" },
  double: { size: 8, read: "readDoubleLE" },
  float64: { size: 8, read: "readDoubleLE" }
};

function parseHeader(buffer) {
  const marker = Buffer.from("end_header");
  const markerIndex = buffer.indexOf(marker);
  if (markerIndex < 0) throw new Error("Invalid PLY: missing end_header");

  const lineEnd = buffer.indexOf(0x0a, markerIndex);
  const dataOffset = lineEnd >= 0 ? lineEnd + 1 : markerIndex + marker.length;
  const header = buffer.subarray(0, dataOffset).toString("ascii");

  if (!header.includes("format binary_little_endian 1.0")) {
    throw new Error("Only binary little-endian PLY files are supported");
  }

  const vertexMatch = header.match(/element vertex (\d+)/);
  if (!vertexMatch) throw new Error("Invalid PLY: missing vertex count");

  const vertexBlock = header
    .split(/\r?\n/)
    .slice(header.split(/\r?\n/).findIndex((line) => line.startsWith("element vertex ")) + 1)
    .filter((line) => line.startsWith("property "));

  const properties = [];
  let stride = 0;
  for (const line of vertexBlock) {
    const match = line.match(/^property\s+(\w+)\s+(\w+)$/);
    if (!match) break;
    const [, type, name] = match;
    const scalar = scalarTypes[type];
    if (!scalar) throw new Error(`Unsupported PLY property type: ${type}`);
    properties.push({ name, offset: stride, ...scalar });
    stride += scalar.size;
  }

  return {
    dataOffset,
    vertexCount: Number(vertexMatch[1]),
    properties,
    stride
  };
}

function readProperty(buffer, baseOffset, property) {
  return buffer[property.read](baseOffset + property.offset);
}

async function optimizePointCloud(model, sequence, maxPoints) {
  const sourcePath = join(sourceRoot, model, `${sequence}.ply`);
  const outputPath = join(outputRoot, model, `${sequence}.ply`);
  const source = await readFile(sourcePath);
  const { dataOffset, vertexCount, properties, stride } = parseHeader(source);
  const byName = Object.fromEntries(properties.map((property) => [property.name, property]));
  const required = ["x", "y", "z", "red", "green", "blue"];

  for (const name of required) {
    if (!byName[name]) throw new Error(`${sourcePath} is missing ${name}`);
  }

  const outputCount = Math.min(vertexCount, maxPoints);
  const header = Buffer.from(
    [
      "ply",
      "format binary_little_endian 1.0",
      "comment Web-optimized from the SLAMFormer-Infinity project point cloud",
      `element vertex ${outputCount}`,
      "property float x",
      "property float y",
      "property float z",
      "property uchar red",
      "property uchar green",
      "property uchar blue",
      "end_header",
      ""
    ].join("\n")
  );
  const outputStride = 15;
  const output = Buffer.allocUnsafe(header.length + outputCount * outputStride);
  header.copy(output);

  for (let outputIndex = 0; outputIndex < outputCount; outputIndex += 1) {
    const sourceIndex = Math.min(
      vertexCount - 1,
      Math.floor(((outputIndex + 0.5) * vertexCount) / outputCount)
    );
    const sourceOffset = dataOffset + sourceIndex * stride;
    const outputOffset = header.length + outputIndex * outputStride;

    output.writeFloatLE(readProperty(source, sourceOffset, byName.x), outputOffset);
    output.writeFloatLE(readProperty(source, sourceOffset, byName.y), outputOffset + 4);
    output.writeFloatLE(readProperty(source, sourceOffset, byName.z), outputOffset + 8);
    output.writeUInt8(readProperty(source, sourceOffset, byName.red), outputOffset + 12);
    output.writeUInt8(readProperty(source, sourceOffset, byName.green), outputOffset + 13);
    output.writeUInt8(readProperty(source, sourceOffset, byName.blue), outputOffset + 14);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output);
  console.log(
    `${model}/${sequence}: ${vertexCount.toLocaleString()} → ${outputCount.toLocaleString()} points`
  );
}

for (const model of models) {
  for (const sequence of sequences) {
    await optimizePointCloud(model.name, sequence, model.maxPoints);
  }
}

