import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

// Rasterize the licensed, recoloured SVG with the existing browser test tooling.
// This script is asset maintenance only; the production app has no renderer dependency.
const svg = await readFile("public/favicon-3bld.svg", "utf8");
const browser = await chromium.launch(
  process.platform === "win32" ? { channel: "msedge" } : {},
);
const page = await browser.newPage({ deviceScaleFactor: 1 });
try {
  for (const [size, file] of [
    [16, "favicon-16.png"],
    [32, "favicon-32.png"],
    [180, "apple-touch-icon.png"],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>${svg}`,
    );
    await page.screenshot({ path: `public/${file}`, animations: "disabled" });
  }
} finally {
  await browser.close();
}
const images = await Promise.all(
  [16, 32].map((size) => readFile(`public/favicon-${size}.png`)),
);
const header = Buffer.alloc(6 + images.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((image, i) => {
  const entry = 6 + i * 16;
  header[entry] = header[entry + 1] = [16, 32][i];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile("public/favicon.ico", Buffer.concat([header, ...images]));
console.log(
  "Generated 16px/32px PNG, 180px touch icon and ICO from the unchanged standard 3BLD paths.",
);
