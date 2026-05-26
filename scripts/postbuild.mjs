/**
 * Готовит .next/standalone к запуску в проде.
 *
 * Next.js с output: "standalone" собирает минимальный server.js в .next/standalone/,
 * но НЕ копирует туда .next/static и public — их нужно перенести вручную, иначе
 * стандэлон сервер отдаёт 404 на ассеты и стили.
 *
 * Запускается автоматически после `npm run build` через npm-хук postbuild.
 */
import { existsSync, rmSync, cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const standalone = resolve(root, ".next/standalone");

if (!existsSync(standalone)) {
  console.log("[postbuild] .next/standalone не найден — output: 'standalone' не включён, пропускаю");
  process.exit(0);
}

function syncDir(src, dst, label) {
  const srcPath = resolve(root, src);
  const dstPath = resolve(standalone, dst);
  if (!existsSync(srcPath)) {
    console.log(`[postbuild] ${label}: ${src} не существует — пропускаю`);
    return;
  }
  rmSync(dstPath, { recursive: true, force: true });
  mkdirSync(resolve(dstPath, ".."), { recursive: true });
  cpSync(srcPath, dstPath, { recursive: true });
  console.log(`[postbuild] ${label}: ${src} → standalone/${dst}`);
}

syncDir(".next/static", ".next/static", "static");
syncDir("public", "public", "public");

console.log("[postbuild] standalone готов к запуску");
