// CSS のカスタムプロパティの解析(check-css-tokens と check-contrast が共有する)

/** ブロックを { selector, media, decls } の配列に平坦化する */
export function parseBlocks(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const blocks = []
  const stack = []
  let buf = ""
  for (const ch of text) {
    if (ch === "{") {
      stack.push(buf.trim())
      buf = ""
    } else if (ch === "}") {
      const selector = stack.pop() ?? ""
      if (!selector.startsWith("@")) {
        const media = stack.filter((s) => s.startsWith("@media")).join(" ")
        const decls = {}
        for (const d of buf.split(";")) {
          const i = d.indexOf(":")
          if (i > 0) decls[d.slice(0, i).trim()] = d.slice(i + 1).trim()
        }
        blocks.push({ selector, media, decls })
      }
      buf = ""
    } else buf += ch
  }
  return blocks
}

/** 指定のセレクタ(と media)のブロックの宣言を、ほかのブロックを上書きしながら束ねる */
export function varsOf(css, selector, { media = "" } = {}) {
  const out = {}
  for (const b of parseBlocks(css)) if (b.selector === selector && b.media === media) Object.assign(out, b.decls)
  return out
}

export const refsOf = (value) => [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1])

/** 変数を最終値まで解決する。見つからなければ例外 */
export function resolve(name, vars, seen = new Set()) {
  if (seen.has(name)) throw new Error(`循環参照: ${name}`)
  const v = vars[name]
  if (v === undefined) throw new Error(`未定義の変数: ${name}`)
  const m = /^var\(\s*(--[\w-]+)\s*\)$/.exec(v)
  return m ? resolve(m[1], vars, new Set([...seen, name])) : v
}
