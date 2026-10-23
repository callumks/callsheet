import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const svg = readFileSync(fileURLToPath(new URL("../public/icon.svg", import.meta.url)));
for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-icon.png", 180]]) {
  await sharp(svg).resize(size, size).png().toFile(fileURLToPath(new URL(`../public/${name}`, import.meta.url)));
}
console.log("icons written");
