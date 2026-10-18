import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, test } from "vitest"
import { createD1Store } from "../../src/platform/d1Store"
import { createMemoryStore } from "../../src/platform/memoryStore"
import type {
  DataStore,
  EvaluationRow,
  OpenCheckinRow,
  PlanRow,
  ReportRow,
  TaskRow,
} from "../../src/platform/store"
import { JST_OFFSET_MS, slotToWindow } from "../../src/platform/time"

const task = (n: number, over: Partial<TaskRow> = {}): TaskRow => ({
  id: `task${String(n).padStart(4, "0")}`,
  did: `did:plc:user${n % 5}`,
  handle: `user${n}.bsky.social`,
  taskUri: `at://did:plc:user${n % 5}/com.example.shinchoku.task/${n}`,
  taskCid: `bafytask${n}`,
  anchorUri: `at://did:plc:user${n % 5}/app.bsky.feed.post/${n}`,
  anchorCid: `bafyanchor${n}`,
  enrollmentUri: `at://did:plc:bot/com.example.shinchoku.bot.enrollment/task${n}`,
  enrollmentCid: `bafyenroll${n}`,
  pds: "https://pds.example",
  title: `作業${n}`,
  summary: `概要${n}`,
  goal: `ゴール${n}`,
  metricName: "距離",
  metricUnit: "km",
  scale: 1,
  startValue: 0,
  goalValue: 100,
  durationDays: 3,
  dailyTarget: 1,
  windows: [slotToWindow("morning")],
  startedAt: 1_000_000 + n,
  endsAt: 9_000_000 + n,
  evidenceRequired: false,
  priority: false,
  status: "active",
  resultState: "none",
  lastNotifiedDay: null,
  notifiedWindows: 0,
  progressIssued: 0,
  checkedAt: 0,
  ...over,
})
const open = (n: number, over: Partial<OpenCheckinRow> = {}): OpenCheckinRow => ({
  id: `chk${n}`, taskId: "task0001", did: "did:plc:user1", kind: "progress", seq: n,
  checkinUri: `at://did:plc:bot/c/${n}`, checkinCid: `bafychk${n}`, replyUri: null,
  issuedAt: 1000 * n, expiresAt: 1000 * n + 500, ...over,
})
const report = (n: number, over: Partial<ReportRow> = {}): ReportRow => ({
  checkinId: `chk${n}`, taskId: "task0001", kind: "progress",
  receiptUri: `at://did:plc:bot/r/${n}`, receiptCid: `bafyr${n}`,
  recordUri: `at://did:plc:user1/p/${n}`, recordCid: `bafyp${n}`,
  value: n, receivedAt: 100 * n, note: null, revoked: null, checkedAt: 0, ...over,
})
const evaluation = (n: number, over: Partial<EvaluationRow> = {}): EvaluationRow => ({
  taskId: `task${String(n).padStart(4, "0")}`, handle: `user${n}.bsky.social`, summary: `概要${n}`, durationDays: 3,
  scoreHundredths: 5000, finalRatePermille: 800, missingCount: 0, algorithm: "v1",
  evaluationUri: `at://did:plc:bot/e/${n}`, finalizedAt: 1000 + n, stale: false, visible: true, ...over,
})

// D1 への呼び出し（run・all・first・raw・batch）を数える
function countingDb(db: D1Database) {
  const counter = { calls: 0 }
  const wrapStatement = (st: D1PreparedStatement): D1PreparedStatement =>
    new Proxy(st, {
      get(target, prop) {
        const v = Reflect.get(target, prop) as unknown
        if (prop === "bind") return (...a: unknown[]) => wrapStatement(target.bind(...a))
        if (["run", "all", "first", "raw"].includes(String(prop)))
          return (...a: unknown[]) => (counter.calls++, (v as (...x: unknown[]) => unknown).apply(target, a))
        return v
      },
    })
  const proxy = new Proxy(db, {
    get(target, prop) {
      if (prop === "prepare") return (sql: string) => wrapStatement(target.prepare(sql))
      if (prop === "batch")
        return (st: D1PreparedStatement[]) => (counter.calls++, target.batch(st.map((s) => (s as unknown as { __t?: D1PreparedStatement }).__t ?? s)))
      return Reflect.get(target, prop)
    },
  })
  return { db: proxy, counter }
}

const impls: [string, () => DataStore][] = [
  ["memory", () => createMemoryStore()],
  ["d1", () => createD1Store(env.DB)],
]

const TABLES = ["bot_session", "entitlements", "plans", "tasks", "open_checkins", "reports", "evaluations"]
// D1 は試験の間でデータが残るため、各試験の前に全表を空にする
const resetD1 = () => env.DB.batch(TABLES.map((t) => env.DB.prepare(`DELETE FROM ${t}`)))

describe.each(impls)("platform/AC-11: 保存先の契約（%s）", (_name, make) => {
  beforeEach(resetD1)

  test("botSession と entitlements は保存して読める", async () => {
    const s = make()
    expect(await s.botSession.get()).toBeNull()
    await s.botSession.put({ accessJwt: "a", refreshJwt: "r", expiresAt: 5 })
    await s.botSession.put({ accessJwt: "a2", refreshJwt: "r2", expiresAt: 6 })
    expect(await s.botSession.get()).toEqual({ accessJwt: "a2", refreshJwt: "r2", expiresAt: 6 })
    await s.entitlements.put({ did: "did:plc:x", plan: "pro", flags: "{}", validUntil: null })
    expect(await s.entitlements.get("did:plc:x")).toEqual({ did: "did:plc:x", plan: "pro", flags: "{}", validUntil: null })
    expect(await s.entitlements.get("did:plc:none")).toBeNull()
  })

  test("plans.putIfAbsent は先に保存された計画を返す", async () => {
    const s = make()
    const a: PlanRow = { dayStart: 100, triggers: [{ id: "a", kind: "normal", at: 1, slot: "morning", k: 2, users: 3 }] }
    const b: PlanRow = { dayStart: 100, triggers: [{ id: "b", kind: "priority", at: 2, taskId: "t", window: 0 }] }
    expect(await s.plans.putIfAbsent(a)).toEqual(a)
    expect(await s.plans.putIfAbsent(b)).toEqual(a)
    expect(await s.plans.get(100)).toEqual(a)
    expect(await s.plans.get(101)).toBeNull()
  })

  test("tasks: put は上書き、getMany は ids の順で欠落を除く、getByTaskUri", async () => {
    const s = make()
    await s.tasks.putMany([task(1), task(2), task(3)])
    await s.tasks.put(task(2, { title: "更新" }))
    expect((await s.tasks.get("task0002"))?.title).toBe("更新")
    expect((await s.tasks.getMany(["task0003", "none", "task0001"])).map((t) => t.id)).toEqual(["task0003", "task0001"])
    expect((await s.tasks.getByTaskUri(task(1).taskUri))?.id).toBe("task0001")
    expect(await s.tasks.getByTaskUri("at://none")).toBeNull()
    expect(await s.tasks.get("none")).toBeNull()
    expect(await s.tasks.get("task0001")).toEqual(task(1))
  })

  test("tasks.getMany は 100 個を超える ids も扱える", async () => {
    const s = make()
    const rows = Array.from({ length: 250 }, (_, i) => task(i))
    await s.tasks.putMany(rows)
    const got = await s.tasks.getMany(rows.map((r) => r.id))
    expect(got.map((t) => t.id)).toEqual(rows.map((r) => r.id))
  })

  test("tasks.patch は指定した項目だけを更新し、存在しない主キーでは何もしない", async () => {
    const s = make()
    await s.tasks.put(task(1))
    await s.tasks.patch("task0001", { lastNotifiedDay: 7, notifiedWindows: 3, progressIssued: 2 })
    const t = await s.tasks.get("task0001")
    expect(t).toMatchObject({ lastNotifiedDay: 7, notifiedWindows: 3, progressIssued: 2, status: "active" })
    await s.tasks.patch("none", { status: "ended" })
    expect(await s.tasks.get("none")).toBeNull()
  })

  test("tasks.countActive と countActiveBySlot", async () => {
    const s = make()
    const evening = [slotToWindow("evening")]
    await s.tasks.putMany([
      task(1, { did: "did:plc:a" }),
      task(2, { did: "did:plc:a", status: "ended" }),
      task(3, { did: "did:plc:b", windows: evening }),
      task(4, { did: "did:plc:c", windows: evening, priority: true }),
      task(5, { did: "did:plc:d", windows: [{ startMinute: 420, endMinute: 480 }] }),
      task(6, { did: "did:plc:e", endsAt: 10 }),
    ])
    expect(await s.tasks.countActive("did:plc:a")).toBe(1)
    expect(await s.tasks.countActive("did:plc:none")).toBe(0)
    expect(await s.tasks.countActiveBySlot(1_000_000)).toEqual({ morning: 1, noon: 0, evening: 1 })
  })

  test("tasks のリスト系の条件と並び", async () => {
    const s = make()
    const nowMs = Date.UTC(2026, 9, 1, 0, 0, 0) - JST_OFFSET_MS + 9 * 3_600_000 // 日本時間 9:00
    await s.tasks.putMany([
      task(1, { startedAt: nowMs - 3000, endsAt: nowMs + 3000 }),
      task(2, { startedAt: nowMs - 2000, endsAt: nowMs + 3000, windows: [slotToWindow("evening")] }),
      task(3, { startedAt: nowMs - 1000, endsAt: nowMs + 3000, priority: true }),
      task(4, { startedAt: nowMs - 9000, endsAt: nowMs - 1, resultState: "none", checkedAt: 50 }),
      task(5, { startedAt: nowMs - 9000, endsAt: nowMs - 2, resultState: "accepted", checkedAt: 40 }),
      task(6, { startedAt: nowMs - 9000, endsAt: nowMs - 3, resultState: "expired", status: "withdrawn" }),
    ])
    expect((await s.tasks.listCandidates(nowMs, 10)).map((t) => t.id)).toEqual(["task0001", "task0003"])
    expect((await s.tasks.listCandidates(nowMs, 1)).map((t) => t.id)).toEqual(["task0001"])
    expect((await s.tasks.listPriority(nowMs, 10)).map((t) => t.id)).toEqual(["task0003"])
    expect((await s.tasks.listPendingResult(nowMs, 10)).map((t) => t.id)).toEqual(["task0004"])
    expect((await s.tasks.listFinalizable(nowMs, 10)).map((t) => t.id)).toEqual(["task0005"])
    const due = (await s.tasks.listDueForRecheck(100, 10)).map((t) => t.id)
    expect(due.slice(0, 3).sort()).toEqual(["task0001", "task0002", "task0003"])
    expect(due.slice(3)).toEqual(["task0005", "task0004"])
    expect((await s.tasks.listDueForRecheck(100, 2)).length).toBe(2)
  })

  test("openCheckins: put・patch・delete・一覧", async () => {
    const s = make()
    await s.openCheckins.putMany([open(1), open(2), open(3, { replyUri: "at://r/3" })])
    expect((await s.openCheckins.getMany(["chk3", "none", "chk1"])).map((r) => r.id)).toEqual(["chk3", "chk1"])
    expect((await s.openCheckins.listExpired(2000, 10)).map((r) => r.id)).toEqual(["chk1"])
    expect((await s.openCheckins.listUnreplied(0, 10)).map((r) => r.id)).toEqual(["chk1", "chk2"])
    await s.openCheckins.patch("chk1", { replyUri: "at://r/1" })
    expect((await s.openCheckins.get("chk1"))?.replyUri).toBe("at://r/1")
    expect((await s.openCheckins.listUnreplied(0, 10)).map((r) => r.id)).toEqual(["chk2"])
    await s.openCheckins.patch("none", { replyUri: "x" })
    await s.openCheckins.delete("chk1")
    await s.openCheckins.deleteMany(["chk2", "chk3", "none"])
    expect(await s.openCheckins.getMany(["chk1", "chk2", "chk3"])).toEqual([])
  })

  test("reports: put・patch・listByTask・listDueForRecheck", async () => {
    const s = make()
    await s.reports.putMany([report(2), report(1), report(3, { taskId: "task0002" })])
    expect((await s.reports.listByTask("task0001")).map((r) => r.checkinId)).toEqual(["chk1", "chk2"])
    await s.reports.patch("chk1", { revoked: "tampered" })
    await s.reports.patch("chk2", { checkedAt: 99 })
    await s.reports.patch("none", { revoked: "x" })
    expect((await s.reports.listDueForRecheck(100, 10)).map((r) => r.checkinId)).toEqual(["chk3", "chk2"])
    expect((await s.reports.get("chk1"))?.revoked).toBe("tampered")
    expect(await s.reports.get("none")).toBeNull()
  })

  test("evaluations: put・patch・getMany・listStale", async () => {
    const s = make()
    await s.evaluations.putMany([evaluation(1), evaluation(2), evaluation(3, { stale: true })])
    await s.evaluations.patch("task0002", { stale: true })
    await s.evaluations.patch("none", { visible: false })
    expect((await s.evaluations.listStale(10)).map((r) => r.taskId)).toEqual(["task0002", "task0003"])
    expect((await s.evaluations.getMany(["task0003", "none", "task0001"])).map((r) => r.taskId)).toEqual(["task0003", "task0001"])
    await s.evaluations.put(evaluation(1, { scoreHundredths: 1 }))
    expect((await s.evaluations.get("task0001"))?.scoreHundredths).toBe(1)
  })

  test("evaluations.page は同点を含めて重複・欠落なく並び、昇順にも対応する", async () => {
    const s = make()
    const rows = Array.from({ length: 120 }, (_, i) =>
      evaluation(i, { scoreHundredths: 1000 + (i % 7) * 10, finalRatePermille: i % 4, finalizedAt: 5000 + (i % 3), visible: i % 10 !== 0 }),
    )
    await s.evaluations.putMany(rows)
    for (const sort of ["score", "rate"] as const) {
      for (const order of ["desc", "asc"] as const) {
        const seen: EvaluationRow[] = []
        let after: [number, number, string] | undefined
        for (let guard = 0; guard < 20; guard++) {
          const page = await s.evaluations.page({ sort, order, after, limit: 50 })
          seen.push(...page)
          const last = page[page.length - 1]
          if (page.length < 50 || !last) break
          after = [sort === "score" ? last.scoreHundredths : last.finalRatePermille, last.finalizedAt, last.taskId]
        }
        const visible = rows.filter((r) => r.visible)
        expect(seen.length).toBe(visible.length)
        expect(new Set(seen.map((r) => r.taskId)).size).toBe(visible.length)
        const key = (r: EvaluationRow) => (sort === "score" ? r.scoreHundredths : r.finalRatePermille)
        const dir = order === "desc" ? -1 : 1
        for (let i = 1; i < seen.length; i++) {
          const a = seen[i - 1] as EvaluationRow, b = seen[i] as EvaluationRow
          const c = dir * (key(a) - key(b) || a.finalizedAt - b.finalizedAt || (a.taskId < b.taskId ? -1 : 1))
          expect(c).toBeLessThanOrEqual(0)
        }
      }
    }
  })
})

describe("platform/AC-22: 1 操作の外部通信は 1 回以下", () => {
  test("d1 の全操作が D1 への呼び出し 1 回で済む", async () => {
    await resetD1()
    const { db, counter } = countingDb(env.DB)
    const s = createD1Store(db)
    const ids = Array.from({ length: 250 }, (_, i) => task(i).id)
    await s.tasks.putMany(ids.map((_, i) => task(i)))
    const ops: [string, () => Promise<unknown>][] = [
      ["botSession.get", () => s.botSession.get()],
      ["botSession.put", () => s.botSession.put({ accessJwt: "a", refreshJwt: "r", expiresAt: 1 })],
      ["entitlements.get", () => s.entitlements.get("d")],
      ["entitlements.put", () => s.entitlements.put({ did: "d", plan: "p", flags: "{}", validUntil: null })],
      ["plans.get", () => s.plans.get(1)],
      ["plans.putIfAbsent", () => s.plans.putIfAbsent({ dayStart: 1, triggers: [] })],
      ["tasks.get", () => s.tasks.get("task0001")],
      ["tasks.getMany(250)", () => s.tasks.getMany(ids)],
      ["tasks.getByTaskUri", () => s.tasks.getByTaskUri("u")],
      ["tasks.put", () => s.tasks.put(task(1))],
      ["tasks.putMany(250)", () => s.tasks.putMany(ids.map((_, i) => task(i)))],
      ["tasks.patch", () => s.tasks.patch("task0001", { status: "ended" })],
      ["tasks.countActive", () => s.tasks.countActive("d")],
      ["tasks.countActiveBySlot", () => s.tasks.countActiveBySlot(0)],
      ["tasks.listPriority", () => s.tasks.listPriority(0, 5)],
      ["tasks.listCandidates", () => s.tasks.listCandidates(0, 5)],
      ["tasks.listPendingResult", () => s.tasks.listPendingResult(0, 5)],
      ["tasks.listFinalizable", () => s.tasks.listFinalizable(0, 5)],
      ["tasks.listDueForRecheck", () => s.tasks.listDueForRecheck(0, 5)],
      ["openCheckins.get", () => s.openCheckins.get("c")],
      ["openCheckins.getMany", () => s.openCheckins.getMany(["a", "b"])],
      ["openCheckins.put", () => s.openCheckins.put(open(1))],
      ["openCheckins.putMany", () => s.openCheckins.putMany([open(1), open(2)])],
      ["openCheckins.patch", () => s.openCheckins.patch("chk1", { replyUri: "u" })],
      ["openCheckins.delete", () => s.openCheckins.delete("chk1")],
      ["openCheckins.deleteMany", () => s.openCheckins.deleteMany(["a", "b"])],
      ["openCheckins.listExpired", () => s.openCheckins.listExpired(0, 5)],
      ["openCheckins.listUnreplied", () => s.openCheckins.listUnreplied(0, 5)],
      ["reports.get", () => s.reports.get("c")],
      ["reports.put", () => s.reports.put(report(1))],
      ["reports.putMany", () => s.reports.putMany([report(1), report(2)])],
      ["reports.patch", () => s.reports.patch("chk1", { checkedAt: 1 })],
      ["reports.listByTask", () => s.reports.listByTask("t")],
      ["reports.listDueForRecheck", () => s.reports.listDueForRecheck(0, 5)],
      ["evaluations.get", () => s.evaluations.get("t")],
      ["evaluations.getMany", () => s.evaluations.getMany(["a"])],
      ["evaluations.put", () => s.evaluations.put(evaluation(1))],
      ["evaluations.putMany", () => s.evaluations.putMany([evaluation(1), evaluation(2)])],
      ["evaluations.patch", () => s.evaluations.patch("task0001", { stale: true })],
      ["evaluations.listStale", () => s.evaluations.listStale(5)],
      ["evaluations.page", () => s.evaluations.page({ sort: "score", order: "desc", limit: 5 })],
    ]
    for (const [name, op] of ops) {
      counter.calls = 0
      await op()
      expect({ name, calls: counter.calls }).toEqual({ name, calls: 1 })
    }
  })
})
