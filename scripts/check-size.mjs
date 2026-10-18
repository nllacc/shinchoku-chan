// 使い方: node scripts/check-size.mjs  — ビルド後に実行する。上限を超えれば終了コード 1
import { readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { gzipSync } from "node:zlib"
import { build } from "vite"

export const LIMITS = { css: 20 * 1024, script: 30 * 1024, firstLoad: 120 * 1024 }

/** dist/web の CSS を全部 gzip した合計と、基底部品のスクリプト(React を除く)を gzip した合計 */
export async function measureSizes(root) {
  const assets = join(root, "dist/web/assets")
  const css = readdirSync(assets)
    .filter((n) => n.endsWith(".css"))
    .reduce((sum, n) => sum + gzipSync(readFileSync(join(assets, n))).length, 0)

  const out = await build({
    configFile: false,
    root,
    logLevel: "silent",
    plugins: [(await import("@vitejs/plugin-react")).default()],
    build: {
      write: false,
      minify: true,
      lib: { entry: join(root, "src/web/ui/index.ts"), formats: ["es"], fileName: "ui" },
      rollupOptions: { external: ["react", "react-dom", "react/jsx-runtime", "react-dom/client"] },
    },
  })
  const outputs = (Array.isArray(out) ? out : [out]).flatMap((o) => o.output)
  const script = outputs
    .filter((o) => o.type === "chunk")
    .reduce((sum, o) => sum + gzipSync(o.code).length, 0)
  return { css, script }
}

/** dist/web/index.html が初回表示で読み込むスクリプト(script と modulepreload)を gzip した合計 */
export function measureFirstLoad(root) {
  const dist = join(root, "dist/web")
  const html = readFileSync(join(dist, "index.html"), "utf8")
  const srcs = [...html.matchAll(/<(?:script[^>]*\bsrc|link[^>]*rel="modulepreload"[^>]*\bhref)="([^"]+)"/g)].map((m) => m[1])
  return srcs.reduce((sum, src) => sum + gzipSync(readFileSync(join(dist, src.replace(/^\//, "")))).length, 0)
}

if (import.meta.url === `file://${resolve(process.argv[1] ?? "")}`) {
  const { css, script } = await measureSizes(resolve(import.meta.dirname, ".."))
  const firstLoad = measureFirstLoad(resolve(import.meta.dirname, ".."))
  console.log(`css: ${css}B (上限 ${LIMITS.css}B) / script: ${script}B (上限 ${LIMITS.script}B) / 初回表示: ${firstLoad}B (上限 ${LIMITS.firstLoad}B)`)
  process.exit(css > LIMITS.css || script > LIMITS.script || firstLoad > LIMITS.firstLoad ? 1 : 0)
}
