// 使い方: node scripts/check-css-tokens.mjs  — 違反があれば一覧を出力して終了コード 1
import { readFileSync, readdirSync } from "node:fs"
import { join, resolve as pathResolve } from "node:path"
import { parseBlocks, refsOf } from "./css-tokens.mjs"

const COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\(/
const LENGTH = /(?<![\w.-])-?(?:\d*\.)?[1-9]\d*(?:\.\d+)?(?:px|rem|em)\b/

const defined = (css) => new Set(parseBlocks(css).flatMap((b) => Object.keys(b.decls).filter((k) => k.startsWith("--"))))

/** files: { primitive, semantic, component, modules: { <名前>: <css> } } */
export function checkTokenUsage(files) {
  const out = []
  const prim = defined(files.primitive)
  const sem = defined(files.semantic)
  const comp = defined(files.component)

  // 1. 部品の値は、用途の値だけを参照する
  for (const b of parseBlocks(files.component)) {
    for (const [k, v] of Object.entries(b.decls)) {
      if (COLOR.test(v) || LENGTH.test(v)) out.push({ file: "component.css", rule: "literal-in-component", detail: `${k}: ${v}` })
      for (const r of refsOf(v)) if (!sem.has(r)) out.push({ file: "component.css", rule: "component-refs-non-semantic", detail: `${k} → ${r}` })
    }
  }
  // 3. 用途の値は、素の値だけを参照し、部品の値を参照しない
  for (const b of parseBlocks(files.semantic)) {
    for (const [k, v] of Object.entries(b.decls)) {
      for (const r of refsOf(v)) {
        if (comp.has(r)) out.push({ file: "semantic.css", rule: "semantic-refs-component", detail: `${k} → ${r}` })
        else if (!prim.has(r)) out.push({ file: "semantic.css", rule: "semantic-refs-non-primitive", detail: `${k} → ${r}` })
      }
    }
  }
  // 素の値は、ほかの変数を参照しない
  for (const b of parseBlocks(files.primitive)) {
    for (const [k, v] of Object.entries(b.decls)) if (refsOf(v).length) out.push({ file: "primitive.css", rule: "primitive-refs-var", detail: `${k}: ${v}` })
  }
  // 2. 部品のスタイルに、色と 0 以外の長さの直接の値を書かない(@media の条件は対象外)
  for (const [name, css] of Object.entries(files.modules ?? {})) {
    for (const b of parseBlocks(css)) {
      for (const [k, v] of Object.entries(b.decls)) {
        if (COLOR.test(v) || LENGTH.test(v)) out.push({ file: name, rule: "literal-in-module", detail: `${k}: ${v}` })
        for (const r of refsOf(v)) if (!comp.has(r) && !sem.has(r)) out.push({ file: name, rule: "unknown-var", detail: `${k} → ${r}` })
      }
    }
  }
  return out
}

export function loadFiles(root) {
  const tokens = join(root, "src/web/tokens")
  const ui = join(root, "src/web/ui")
  const read = (p) => readFileSync(p, "utf8")
  const modules = {}
  for (const n of readdirSync(ui)) if (n.endsWith(".module.css")) modules[n] = read(join(ui, n))
  return {
    primitive: read(join(tokens, "primitive.css")),
    semantic: read(join(tokens, "semantic.css")),
    component: read(join(tokens, "component.css")),
    modules,
  }
}

if (import.meta.url === `file://${pathResolve(process.argv[1] ?? "")}`) {
  const violations = checkTokenUsage(loadFiles(pathResolve(import.meta.dirname, "..")))
  for (const v of violations) console.error(`${v.file}: ${v.rule}: ${v.detail}`)
  process.exit(violations.length ? 1 : 0)
}
