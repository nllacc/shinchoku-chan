// 使い方: node scripts/rename-namespace.mjs <旧接頭辞> <新接頭辞>
import { existsSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync, mkdirSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

const NSID_RULE = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+){2,}$/

function walkJson(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walkJson(p) : p.endsWith(".json") ? [p] : []
  })
}

// 空になった親ディレクトリを root の手前まで削除する
function pruneEmpty(dir, stop) {
  while (dir !== stop && existsSync(dir) && readdirSync(dir).length === 0) {
    rmSync(dir, { recursive: true })
    dir = dirname(dir)
  }
}

export function renameNamespace(root, from, to) {
  if (!NSID_RULE.test(to)) throw new Error(`invalid-prefix: ${to}`)
  if (from === to) return
  // 公開後（スナップショットが空でない）は変更不可
  const lockPath = join(root, "lexicons.lock.json")
  if (existsSync(lockPath) && Object.keys(JSON.parse(readFileSync(lockPath, "utf8"))).length > 0) {
    throw new Error("published: 公開後は接頭辞を変更できない")
  }
  const lexDir = join(root, "lexicons")
  const fromDir = join(lexDir, ...from.split("."))
  const toDir = join(lexDir, ...to.split("."))
  // 各 JSON の id と ref 内の接頭辞を置換する
  for (const f of walkJson(fromDir)) {
    const text = readFileSync(f, "utf8")
    writeFileSync(f, text.split(`"${from}.`).join(`"${to}.`))
  }
  // ディレクトリを移動する
  mkdirSync(dirname(toDir), { recursive: true })
  renameSync(fromDir, toDir)
  pruneEmpty(dirname(fromDir), lexDir)
  // registry.ts の import パスと nsid.ts の接頭辞を書き換える
  const registry = join(lexDir, "registry.ts")
  writeFileSync(registry, readFileSync(registry, "utf8").split(`/${from.split(".").join("/")}/`).join(`/${to.split(".").join("/")}/`))
  const nsid = join(root, "src", "lexicon", "nsid.ts")
  writeFileSync(nsid, readFileSync(nsid, "utf8").replace(`NSID_PREFIX = "${from}"`, `NSID_PREFIX = "${to}"`))
}

if (import.meta.url === `file://${resolve(process.argv[1] ?? "")}`) {
  const [from, to] = process.argv.slice(2)
  if (!from || !to) {
    console.error("使い方: node scripts/rename-namespace.mjs <旧接頭辞> <新接頭辞>")
    process.exit(2)
  }
  try {
    renameNamespace(resolve(import.meta.dirname, ".."), from, to)
  } catch (e) {
    console.error(String(e.message))
    process.exit(1)
  }
}
