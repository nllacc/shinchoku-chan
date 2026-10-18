// 保存先の間でデータを移行する運用スクリプト（運用者の端末で実行する。Worker には含めない）
//   node scripts/store-migrate.mjs export --from d1:<データベース名>[:local] --dir dump
//   node scripts/store-migrate.mjs import --to d1:<データベース名>[:local] --dir dump
//   node scripts/store-migrate.mjs verify --from d1:<名前> --to d1:<名前>
// 行の書式は JSON Lines（1 行目に { format, collection, count }）で、キー名は DataStore の行の型と同じ
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

// 項目の型: s 文字列、n 数値、b 真偽（0 と 1）、j JSON の文字列
const S = "s", N = "n", B = "b", J = "j"
export const COLLECTIONS = {
  botSession: { table: "bot_session", pk: "id", cols: [["id", "id", N], ["accessJwt", "access_jwt", S], ["refreshJwt", "refresh_jwt", S], ["expiresAt", "expires_at", N]] },
  entitlements: { table: "entitlements", pk: "did", cols: [["did", "did", S], ["plan", "plan", S], ["flags", "flags", S], ["validUntil", "valid_until", N]] },
  plans: { table: "plans", pk: "day_start", cols: [["dayStart", "day_start", N], ["triggers", "triggers", J]] },
  tasks: {
    table: "tasks", pk: "id",
    cols: [
      ["id", "id", S], ["did", "did", S], ["handle", "handle", S], ["taskUri", "task_uri", S], ["taskCid", "task_cid", S],
      ["anchorUri", "anchor_uri", S], ["anchorCid", "anchor_cid", S], ["enrollmentUri", "enrollment_uri", S],
      ["enrollmentCid", "enrollment_cid", S], ["pds", "pds", S], ["title", "title", S], ["summary", "summary", S], ["goal", "goal", S],
      ["metricName", "metric_name", S], ["metricUnit", "metric_unit", S], ["scale", "scale", N], ["startValue", "start_value", N],
      ["goalValue", "goal_value", N], ["durationDays", "duration_days", N], ["dailyTarget", "daily_target", N], ["windows", "windows", J],
      ["startedAt", "started_at", N], ["endsAt", "ends_at", N], ["evidenceRequired", "evidence_required", B], ["priority", "priority", B],
      ["status", "status", S], ["resultState", "result_state", S], ["lastNotifiedDay", "last_notified_day", N],
      ["notifiedWindows", "notified_windows", N], ["progressIssued", "progress_issued", N], ["checkedAt", "checked_at", N],
    ],
  },
  openCheckins: {
    table: "open_checkins", pk: "id",
    cols: [["id", "id", S], ["taskId", "task_id", S], ["did", "did", S], ["kind", "kind", S], ["seq", "seq", N], ["checkinUri", "checkin_uri", S], ["checkinCid", "checkin_cid", S], ["replyUri", "reply_uri", S], ["issuedAt", "issued_at", N], ["expiresAt", "expires_at", N]],
  },
  reports: {
    table: "reports", pk: "checkin_id",
    cols: [["checkinId", "checkin_id", S], ["taskId", "task_id", S], ["kind", "kind", S], ["receiptUri", "receipt_uri", S], ["receiptCid", "receipt_cid", S], ["recordUri", "record_uri", S], ["recordCid", "record_cid", S], ["value", "value", N], ["receivedAt", "received_at", N], ["note", "note", S], ["revoked", "revoked", S], ["checkedAt", "checked_at", N]],
  },
  evaluations: {
    table: "evaluations", pk: "task_id",
    cols: [["taskId", "task_id", S], ["handle", "handle", S], ["summary", "summary", S], ["durationDays", "duration_days", N], ["scoreHundredths", "score_hundredths", N], ["finalRatePermille", "final_rate_permille", N], ["missingCount", "missing_count", N], ["algorithm", "algorithm", S], ["evaluationUri", "evaluation_uri", S], ["finalizedAt", "finalized_at", N], ["stale", "stale", B], ["visible", "visible", B]],
  },
}
const NAMES = Object.keys(COLLECTIONS)
const FORMAT = 1
const PAGE = 500
const CHUNK = 100

/** D1 の行（列名はスネークケース）を、DataStore の行の型へ変換する */
export function rowFromDb(spec, db) {
  return Object.fromEntries(
    spec.cols.map(([f, c, k]) => {
      const v = db[c]
      if (v === null || v === undefined) return [f, null]
      return [f, k === B ? v === 1 : k === J ? JSON.parse(v) : v]
    }),
  )
}

const literal = (v, k) => {
  if (v === null || v === undefined) return "NULL"
  if (k === B) return v ? "1" : "0"
  if (k === J) return `'${JSON.stringify(v).replaceAll("'", "''")}'`
  if (k === N) return String(Number(v))
  return `'${String(v).replaceAll("'", "''")}'`
}

/** 行を主キーで上書きする SQL（何度実行しても結果が同じ） */
export function upsertSql(spec, row) {
  const names = spec.cols.map(([, c]) => c)
  const values = spec.cols.map(([f, , k]) => literal(row[f], k))
  const update = names.filter((c) => c !== spec.pk).map((c) => `${c} = excluded.${c}`).join(", ")
  return `INSERT INTO ${spec.table} (${names.join(", ")}) VALUES (${values.join(", ")}) ON CONFLICT(${spec.pk}) DO UPDATE SET ${update};`
}

const canonical = (row) => JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a], [b]) => (a < b ? -1 : 1))))
const hash = (row) => createHash("sha256").update(canonical(row)).digest("hex")

async function collect(adapter, name) {
  const rows = []
  for await (const batch of adapter.scan(name)) rows.push(...batch)
  return rows
}

/** 集合ごとに <dir>/<集合>.jsonl を書き出す */
export async function exportAll(source, dir) {
  mkdirSync(dir, { recursive: true })
  const counts = {}
  for (const name of NAMES) {
    const rows = await collect(source, name)
    const lines = [JSON.stringify({ format: FORMAT, collection: name, count: rows.length }), ...rows.map((r) => JSON.stringify(r))]
    writeFileSync(join(dir, `${name}.jsonl`), lines.join("\n") + "\n")
    counts[name] = rows.length
  }
  return counts
}

/** 行を put で取り込む。何度実行しても結果が同じ */
export async function importAll(target, dir) {
  const counts = {}
  for (const name of NAMES) {
    const [head, ...lines] = readFileSync(join(dir, `${name}.jsonl`), "utf8").split("\n").filter(Boolean)
    const header = JSON.parse(head)
    if (header.format !== FORMAT || header.collection !== name) throw new Error(`${name}: unexpected header ${head}`)
    const rows = lines.map((l) => JSON.parse(l))
    if (rows.length !== header.count) throw new Error(`${name}: expected ${header.count} rows but found ${rows.length}`)
    for (let i = 0; i < rows.length; i += CHUNK) await target.put(name, rows.slice(i, i + CHUNK))
    counts[name] = rows.length
  }
  return counts
}

/** 件数と、各行の JSON の正規形のハッシュを比べる */
export async function verifyAll(source, target) {
  const mismatches = []
  for (const name of NAMES) {
    const a = await collect(source, name)
    const b = await collect(target, name)
    if (a.length !== b.length) mismatches.push({ collection: name, reason: `count ${a.length} != ${b.length}` })
    const set = new Set(b.map(hash))
    const missing = a.filter((r) => !set.has(hash(r))).length
    if (missing > 0) mismatches.push({ collection: name, reason: `${missing} rows differ or are missing` })
  }
  return { ok: mismatches.length === 0, mismatches }
}

// ---- アダプタ ----

/** JSON Lines のディレクトリ（読み出し専用） */
export function dirAdapter(dir) {
  return {
    async *scan(name) {
      const [, ...lines] = readFileSync(join(dir, `${name}.jsonl`), "utf8").split("\n").filter(Boolean)
      yield lines.map((l) => JSON.parse(l))
    },
  }
}

function wrangler(args) {
  const r = spawnSync("npx", ["wrangler", ...args], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
  if (r.status !== 0) throw new Error(`wrangler failed: ${r.stderr || r.stdout}`)
  return r.stdout
}

/** wrangler 経由で D1 を読み書きする。名前の末尾に :local を付けるとローカルのデータベース */
export function d1Adapter(spec) {
  const [database, mode] = spec.split(":")
  const where = mode === "local" ? "--local" : "--remote"
  return {
    async *scan(name) {
      const c = COLLECTIONS[name]
      for (let offset = 0; ; offset += PAGE) {
        const out = wrangler(["d1", "execute", database, where, "--json", "--command", `SELECT * FROM ${c.table} ORDER BY ${c.pk} LIMIT ${PAGE} OFFSET ${offset}`])
        const rows = JSON.parse(out)[0].results.map((r) => rowFromDb(c, r))
        if (rows.length > 0) yield rows
        if (rows.length < PAGE) return
      }
    },
    async put(name, rows) {
      const dir = mkdtempSync(join(tmpdir(), "store-migrate-"))
      try {
        const file = join(dir, "put.sql")
        writeFileSync(file, rows.map((r) => upsertSql(COLLECTIONS[name], r)).join("\n"))
        wrangler(["d1", "execute", database, where, "--file", file])
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    },
  }
}

export function adapterFor(spec) {
  const [kind, ...rest] = spec.split(":")
  const arg = rest.join(":")
  if (kind === "d1") return d1Adapter(arg)
  if (kind === "dir") return dirAdapter(arg)
  throw new Error(`unknown store: ${spec}`)
}

async function main(argv) {
  const [command, ...rest] = argv
  const opt = (name) => {
    const i = rest.indexOf(`--${name}`)
    return i >= 0 ? rest[i + 1] : undefined
  }
  if (command === "export") {
    console.log(await exportAll(adapterFor(opt("from")), opt("dir")))
  } else if (command === "import") {
    console.log(await importAll(adapterFor(opt("to")), opt("dir")))
  } else if (command === "verify") {
    const r = await verifyAll(adapterFor(opt("from")), adapterFor(opt("to")))
    console.log(r.ok ? "一致しました" : JSON.stringify(r.mismatches, null, 2))
    if (!r.ok) process.exitCode = 1
  } else {
    console.error("usage: store-migrate.mjs export|import|verify (--from <store>) (--to <store>) (--dir <dir>)")
    process.exitCode = 2
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main(process.argv.slice(2))
