// 使い方: node scripts/check-contrast.mjs  — 基準未満があれば組み合わせと実測値を出力して終了コード 1
import { readFileSync } from "node:fs"
import { join, resolve as pathResolve } from "node:path"
import { resolve, varsOf } from "./css-tokens.mjs"

export const PAIRS = [
  ["--color-text", "--color-surface"],
  ["--color-text", "--color-surface-raised"],
  ["--color-primary-text", "--color-primary"],
  ["--color-danger-text", "--color-danger"],
  ["--color-muted", "--color-surface"],
  ["--color-primary", "--color-surface"],
  ["--color-primary", "--color-surface-raised"],
  ["--color-muted", "--color-surface-raised"],
]
export const MIN_RATIO = 4.5

function hexToRgb(hex) {
  const h = hex.replace("#", "")
  const f = h.length === 3 ? [...h].map((c) => c + c).join("") : h
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16))
}

export function luminance([r, g, b]) {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

export function ratio(fg, bg) {
  const [a, b] = [luminance(hexToRgb(fg)), luminance(hexToRgb(bg))]
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** primitive と semantic の CSS から、明暗の組み合わせのコントラスト比を計算する */
export function checkContrast(primitiveCss, semanticCss, pairs = PAIRS) {
  const prim = varsOf(primitiveCss, ":root")
  const light = { ...prim, ...varsOf(semanticCss, ":root") }
  const dark = { ...light, ...varsOf(semanticCss, ':root[data-theme="dark"]') }
  const out = []
  for (const [theme, vars] of [["light", light], ["dark", dark]]) {
    for (const [fg, bg] of pairs) {
      const r = ratio(resolve(fg, vars), resolve(bg, vars))
      out.push({ theme, fg, bg, ratio: Math.round(r * 100) / 100, ok: r >= MIN_RATIO })
    }
  }
  return out
}

if (import.meta.url === `file://${pathResolve(process.argv[1] ?? "")}`) {
  const dir = join(pathResolve(import.meta.dirname, ".."), "src/web/tokens")
  const res = checkContrast(readFileSync(join(dir, "primitive.css"), "utf8"), readFileSync(join(dir, "semantic.css"), "utf8"))
  const bad = res.filter((r) => !r.ok)
  for (const r of bad) console.error(`${r.theme}: ${r.fg} / ${r.bg} = ${r.ratio} (< ${MIN_RATIO})`)
  process.exit(bad.length ? 1 : 0)
}
