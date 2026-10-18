// 使い方: node scripts/check-lexicon-compat.mjs [--update]
// lexicons.lock.json: { "<nsid>": { required: string[], properties: Record<string, object> } }
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

// 上限(引き上げは許容、引き下げと新設は違反)と下限(引き下げは許容、引き上げと新設は違反)
const UPPER = ["maxLength", "maxGraphemes", "maximum", "maxSize"]
const LOWER = ["minLength", "minGraphemes", "minimum"]
// 型の同一性を保つ属性
const IDENTITY = ["type", "ref", "format", "refs"]

const clone = (o) => JSON.parse(JSON.stringify(o))

// lexicon の文書の配列から、オブジェクト定義ごとのスナップショットを作る。
// オブジェクト以外の定義(文字列など)は properties の "$value" に入れる
export function snapshotOf(docs) {
  const out = {}
  for (const doc of docs) {
    for (const [name, def] of Object.entries(doc.defs)) {
      const key = name === "main" ? doc.id : `${doc.id}#${name}`
      const obj = def.type === "record" ? def.record : def
      out[key] =
        obj.type === "object"
          ? { required: [...(obj.required ?? [])].sort(), properties: clone(obj.properties ?? {}) }
          : { required: [], properties: { $value: clone(obj) } }
    }
  }
  return out
}

function compareSchema(nsid, path, a, b, out) {
  for (const k of IDENTITY) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return out.push({ nsid, path, kind: "type-changed" })
  }
  for (const k of UPPER) {
    if (b[k] !== undefined && (a[k] === undefined || b[k] < a[k])) out.push({ nsid, path, kind: "constraint-tightened" })
  }
  for (const k of LOWER) {
    if (b[k] !== undefined && (a[k] === undefined || b[k] > a[k])) out.push({ nsid, path, kind: "constraint-tightened" })
  }
  // 値の候補・許可する形式は、減らすと既存の値が受け付けられなくなりうる
  for (const k of ["knownValues", "accept"]) {
    if ((a[k] ?? []).some((v) => !(b[k] ?? []).includes(v))) out.push({ nsid, path, kind: "constraint-tightened" })
  }
  if (a.type === "array" && a.items && b.items) compareSchema(nsid, `${path}[]`, a.items, b.items, out)
  if (a.type === "object") compareObject(nsid, path, a, b, out)
}

function compareObject(nsid, path, a, b, out) {
  const ar = [...(a.required ?? [])].sort()
  const br = [...(b.required ?? [])].sort()
  if (JSON.stringify(ar) !== JSON.stringify(br)) out.push({ nsid, path: path ? `${path}.required` : "required", kind: "required-changed" })
  for (const [name, pa] of Object.entries(a.properties ?? {})) {
    const p = path ? `${path}.${name}` : name
    const pb = b.properties?.[name]
    if (pb === undefined) out.push({ nsid, path: p, kind: "property-removed" })
    else compareSchema(nsid, p, pa, pb, out)
  }
}

// 違反の配列 { nsid, path, kind } を返す。空配列なら互換
export function compareLexicon(published, current) {
  const out = []
  for (const [nsid, a] of Object.entries(published)) {
    const b = current[nsid]
    if (b === undefined) out.push({ nsid, path: "", kind: "property-removed" })
    else compareObject(nsid, "", a, b, out)
  }
  return out
}

function readDocs(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return readDocs(p)
    return p.endsWith(".json") ? [JSON.parse(readFileSync(p, "utf8"))] : []
  })
}

// 終了コードを返す。0=互換／1=違反あり
export function run(root, args, log = console.log) {
  const lockPath = join(root, "lexicons.lock.json")
  const current = snapshotOf(readDocs(join(root, "lexicons")))
  if (args.includes("--update")) {
    writeFileSync(lockPath, JSON.stringify(current, null, 2) + "\n")
    return 0
  }
  // 公開前(スナップショットなし)は空オブジェクトとして互換とみなす
  const published = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, "utf8")) : {}
  const violations = compareLexicon(published, current)
  for (const v of violations) log(`${v.kind}: ${v.nsid} ${v.path}`)
  return violations.length ? 1 : 0
}

if (import.meta.url === `file://${resolve(process.argv[1] ?? "")}`) {
  process.exit(run(resolve(import.meta.dirname, ".."), process.argv.slice(2)))
}
