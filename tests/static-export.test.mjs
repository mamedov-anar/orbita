import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve("docs");
const basePath = process.env.PAGES_BASE_PATH ?? "/orbita";
const html = await readFile(path.join(root, "index.html"), "utf8");

test("exports the finished Russian page and all eight planet controls", () => {
  assert.match(html, /<html lang="ru"/);
  assert.match(html, /<title>ОРБИТА — Солнечная система сейчас<\/title>/);
  assert.match(html, /<canvas[^>]*tabindex="0"/);
  assert.match(html, /aria-label="Дата и время модели в UTC"/);
  const rail = html.match(/<nav\b[^>]*aria-label="Выбор планеты"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(rail);
  assert.equal((rail.match(/<button\b/g) ?? []).length, 8);
  assert.equal((rail.match(/aria-pressed="true"/g) ?? []).length, 1);
});

test("every page asset resolves inside the GitHub Pages repository path", async () => {
  const references = new Set([
    ...[...html.matchAll(/(?:src|href)="(\/[^"?#]+)"/g)].map(match => match[1]),
    ...[...html.matchAll(/url\((\/[^)]+)\)/g)].map(match => match[1]),
  ]);
  assert.ok(references.size > 10);
  await Promise.all([...references].map(async url => {
    assert.ok(url.startsWith(`${basePath}/`), `Unscoped URL: ${url}`);
    await access(path.join(root, url.slice(basePath.length)));
  }));
  await access(path.join(root, ".nojekyll"));
  assert.ok(!(await readdir(root)).includes("server"), "Server output must not be published");
});

test("ships all nine original textures and a working attribution return link", async () => {
  for (const id of ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "moon"]) {
    const [source, published] = await Promise.all([
      readFile(`public/textures/${id}.jpg`),
      readFile(path.join(root, `textures/${id}.jpg`)),
    ]);
    assert.ok(source.equals(published), `${id} texture differs from its source`);
    assert.ok(published.length > 10_000);
  }
  const credits = await readFile(path.join(root, "textures/credits.html"), "utf8");
  assert.match(credits, /href="\.\.\/"/);
  assert.match(credits, /creativecommons.org\/licenses\/by\/4.0\//);
});
