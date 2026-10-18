// 使い方: node scripts/check-ui-usage.mjs  — 画面が基底部品を介さず素の要素を使っていれば一覧を出して終了コード 1
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"

// 基底部品が受け持つ要素。画面では直接使わず、src/web/ui の部品を使う
const BANNED_TAGS = ["a", "button", "input", "select", "textarea", "table", "dialog", "dl", "img", "figure", "header", "nav"]
const TAG = new RegExp(`<(${BANNED_TAGS.join("|")})(?=[\\s>/])`, "g")

const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })

/** files: { <パス>: <ソース> }。src/web/ui 配下は基底部品の実装なので対象外 */
export function checkUiUsage(files) {
  const out = []
  for (const [path, src] of Object.entries(files)) {
    if (!path.endsWith(".tsx") || path.includes("/ui/") || path.startsWith("ui/")) continue
    const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
    for (const m of code.matchAll(TAG)) out.push({ file: path, rule: "raw-element", detail: `<${m[1]}>` })
  }
  return out
}

export function loadSources(root) {
  const base = join(root, "src/web")
  return Object.fromEntries(walk(base).filter((p) => p.endsWith(".tsx")).map((p) => [relative(base, p), readFileSync(p, "utf8")]))
}

if (import.meta.url === `file://${resolve(process.argv[1] ?? "")}`) {
  const v = checkUiUsage(loadSources(resolve(import.meta.dirname, "..")))
  for (const x of v) console.error(`${x.file}: ${x.rule}: ${x.detail}`)
  process.exit(v.length ? 1 : 0)
}
