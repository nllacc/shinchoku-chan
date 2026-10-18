import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { D1_SPECS } from "../../src/platform/d1Store"
import { COLLECTIONS, dirAdapter, exportAll, importAll, rowFromDb, upsertSql, verifyAll } from "../../scripts/store-migrate.mjs"

type Rows = Record<string, Record<string, unknown>[]>

// 試験用のメモリ上の保存先（主キーで上書きする）
function memoryBackend(initial: Rows = {}) {
  const data: Record<string, Map<string, Record<string, unknown>>> = {}
  for (const name of Object.keys(COLLECTIONS)) {
    const pk = (COLLECTIONS as any)[name].cols.find((c: string[]) => c[1] === (COLLECTIONS as any)[name].pk)[0]
    data[name] = new Map((initial[name] ?? []).map((r) => [String(r[pk]), r]))
  }
  const pkOf = (name: string) => (COLLECTIONS as any)[name].cols.find((c: string[]) => c[1] === (COLLECTIONS as any)[name].pk)[0] as string
  return {
    data,
    async *scan(name: string) {
      yield [...data[name]!.values()]
    },
    async put(name: string, rows: Record<string, unknown>[]) {
      for (const r of rows) data[name]!.set(String(r[pkOf(name)]), r)
    },
  }
}

const task = (n: number) => ({
  id: `t${n}`, did: "did:plc:a", handle: "a.example.com", taskUri: `at://x/${n}`, taskCid: "c", anchorUri: "a", anchorCid: "b",
  enrollmentUri: "e", enrollmentCid: "f", pds: "https://p", title: "名前's", summary: "概要", goal: "g", metricName: "m", metricUnit: "u",
  scale: 1, startValue: 0, goalValue: 10, durationDays: 3, dailyTarget: 1, windows: [{ startMinute: 480, endMinute: 720 }],
  startedAt: 1, endsAt: 2, evidenceRequired: true, priority: false, status: "active", resultState: "none",
  lastNotifiedDay: null, notifiedWindows: 0, progressIssued: 0, checkedAt: 0,
})
const seed: Rows = {
  botSession: [{ id: 1, accessJwt: "a", refreshJwt: "r", expiresAt: 5 }],
  entitlements: [{ did: "did:plc:a", plan: "pro", flags: "{}", validUntil: null }],
  plans: [{ dayStart: 100, triggers: [{ id: "x", kind: "normal", at: 1 }] }],
  tasks: [task(1), task(2), task(3)],
  openCheckins: [], reports: [], evaluations: [],
}

describe("store-migrate", () => {
  test("対応表は D1 の実装の対応表と一致する", () => {
    for (const [name, spec] of Object.entries(D1_SPECS)) {
      const s = (COLLECTIONS as any)[name]
      expect(s.table).toBe(spec.table)
      expect(s.pk).toBe(spec.pk)
      expect(s.cols).toEqual(spec.cols)
    }
  })

  test("platform/AC-16: 書き出した全行を別の保存先へ取り込むと、件数と各行の内容が一致する", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mig-"))
    const source = memoryBackend(seed)
    expect(await exportAll(source, dir)).toMatchObject({ tasks: 3, plans: 1, openCheckins: 0 })
    const target = memoryBackend()
    expect(await importAll(target, dir)).toMatchObject({ tasks: 3 })
    expect(await verifyAll(source, target)).toEqual({ ok: true, mismatches: [] })
    expect(await verifyAll(dirAdapter(dir), target)).toEqual({ ok: true, mismatches: [] })
    ;(target.data.tasks!.get("t2") as any).title = "改変"
    const bad = await verifyAll(source, target)
    expect(bad.ok).toBe(false)
    expect(bad.mismatches[0]).toMatchObject({ collection: "tasks" })
  })

  test("platform/AC-17: 取り込みを中断して再実行しても、行が重複しない", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mig-"))
    await exportAll(memoryBackend(seed), dir)
    const target = memoryBackend()
    let puts = 0
    const flaky = { put: async (n: string, rows: any[]) => { if (n === "tasks" && puts++ === 0) throw new Error("interrupted"); return target.put(n, rows) } }
    await expect(importAll(flaky, dir)).rejects.toThrow("interrupted")
    await importAll(flaky, dir)
    await importAll(flaky, dir)
    expect(target.data.tasks!.size).toBe(3)
    expect(target.data.plans!.size).toBe(1)
  })

  test("D1 の行との変換と、上書きの SQL", () => {
    const spec = (COLLECTIONS as any).tasks
    const db = { ...Object.fromEntries(spec.cols.map(([, c]: string[]) => [c, null])), id: "t1", windows: '[{"startMinute":1,"endMinute":2}]', evidence_required: 1, priority: 0, title: "x" }
    expect(rowFromDb(spec, db)).toMatchObject({ id: "t1", windows: [{ startMinute: 1, endMinute: 2 }], evidenceRequired: true, priority: false, lastNotifiedDay: null })
    const sql = upsertSql(spec, task(1))
    expect(sql).toContain("ON CONFLICT(id) DO UPDATE SET")
    expect(sql).toContain("'名前''s'")
    expect(sql).toContain("'[{\"startMinute\":480,\"endMinute\":720}]'")
  })

  test("件数が合わない書き出しの取り込みは中止する", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mig-"))
    await exportAll(memoryBackend(seed), dir)
    const { writeFileSync, readFileSync } = await import("node:fs")
    const f = join(dir, "tasks.jsonl")
    writeFileSync(f, readFileSync(f, "utf8").split("\n").slice(0, 3).join("\n") + "\n")
    await expect(importAll(memoryBackend(), dir)).rejects.toThrow("expected 3 rows")
  })
})
