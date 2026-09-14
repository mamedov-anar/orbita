import { access, cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const output = path.resolve("docs");
const exported = path.resolve("dist/client");
const basePath = process.env.PAGES_BASE_PATH ?? "/orbita";
if (!/^\/(?:[a-zA-Z0-9_.-]+\/?)*$/.test(basePath) || basePath.includes("..")) {
  throw new Error("PAGES_BASE_PATH must be a safe repository URL path");
}
await access(path.join(exported, "index.html"));
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(exported, output, { recursive: true });
// Vinext puts assets under assetPrefix; Pages adds the repository prefix itself.
const prefixDirectory = basePath.replace(/^\/+|\/+$/g, "");
if (prefixDirectory) {
  const prefixedAssets = path.join(output, prefixDirectory);
  await access(path.join(prefixedAssets, "_next"));
  await cp(prefixedAssets, output, { recursive: true });
  await rm(prefixedAssets, { recursive: true, force: true });
}
await writeFile(path.join(output, ".nojekyll"), "");
console.log("GitHub Pages files are ready in docs/");
