import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { NSID } from "../../src/lexicon/nsid"
import { createStore } from "../../src/platform/store"
import { buildScoreInput, finalizeTasks } from "../../src/ranking/finalize"
import { BOT_DID, FakeNet, resetDb, testEnv } from "../receipt/fakeNet"
import { DAY, NOW, cloneTask, endedTask, reportRow } from "./helpers"

const END = NOW + 3 * DAY
let net: FakeNet
beforeEach(async () => {
  net = new FakeNet()
  net.install()
  await resetDb()
})
afterEach(() => vi.unstubAllGlobals())

describe("buildScoreInput", () => {
  test("ranking/AC-3: 取消された報告は、評価の入力に含まれない", async () => {
    const task = await endedTask(net)
    const input = buildScoreInput(task, [
      reportRow(task, { value: 100 }),
      reportRow(task, { value: 200, revoked: "tampered" }),
      reportRow(task, { kind: "result", value: 300 }),
      reportRow(task, { kind: "result", value: 10, revoked: "deleted" }),
    ])
    expect(input.records).toHaveLength(1)
    expect(input.records[0]!.permille).toBe(333)
    expect(input.final).toEqual({ permille: 1000 })
    expect(input).toMatchObject({ startedAt: task.startedAt, endsAt: task.endsAt, dailyTarget: 1 })
  })

  test("結果報告が取消されていれば終点は最後の進捗になる", async () => {
    const task = await endedTask(net)
    expect(buildScoreInput(task, [reportRow(task, { kind: "result", value: 300, revoked: "tampered" })]).final).toBeNull()
  })
})

describe("finalizeTasks", () => {
  test("ranking/AC-1: 結果確認が済んだ終了済みの作業が7件あるとき、1回の定期実行で評価されるのは5件", async () => {
    const base = await endedTask(net)
    for (let i = 1; i < 7; i++) await cloneTask(base, i)
    await finalizeTasks(END, testEnv)
    const store = createStore(testEnv)
    const evals = await store.evaluations.page({ sort: "score", order: "desc", limit: 100 })
    expect(evals).toHaveLength(5)
    expect(net.list(BOT_DID, NSID.evaluation)).toHaveLength(5)
    await finalizeTasks(END + 1000, testEnv)
    expect(await store.evaluations.page({ sort: "score", order: "desc", limit: 100 })).toHaveLength(7)
  })

  test("ranking/AC-2: 結果確認が未了の作業・期間中の作業は評価されない", async () => {
    const base = await endedTask(net, {}, "issued")
    await cloneTask(base, 1, { resultState: "none" })
    await finalizeTasks(END, testEnv)
    expect(net.list(BOT_DID, NSID.evaluation)).toHaveLength(0)
    await cloneTask(base, 2, { resultState: "accepted" })
    await finalizeTasks(base.endsAt - 1000, testEnv)
    expect(net.list(BOT_DID, NSID.evaluation)).toHaveLength(0)
  })

  test("ranking/AC-4: 評価の確定後に、Botのリポジトリの評価のレコードと、データベースの行が一致する", async () => {
    const task = await endedTask(net)
    const store = createStore(testEnv)
    await store.reports.put(reportRow(task, { value: 150, receivedAt: task.startedAt + DAY }))
    await store.reports.put(reportRow(task, { kind: "result", value: 300, receivedAt: task.endsAt - 1000, note: "完了" }))
    await finalizeTasks(END, testEnv)
    const rec = net.list(BOT_DID, NSID.evaluation)[0]!.value
    const row = (await store.evaluations.get(task.id))!
    expect(rec).toMatchObject({
      subject: task.did, enrollment: { uri: task.enrollmentUri, cid: task.enrollmentCid }, algorithm: "linear-v1",
      scoreHundredths: row.scoreHundredths, finalRatePermille: row.finalRatePermille, missingCount: row.missingCount,
      finalizedAt: new Date(row.finalizedAt).toISOString(),
    })
    expect(row).toMatchObject({ handle: task.handle, summary: task.summary, durationDays: 2, finalRatePermille: 1000, visible: true, stale: false })
    expect(row.evaluationUri).toMatch(/^at:\/\//)
    expect((await store.tasks.get(task.id))?.status).toBe("ended")
  })

  test("評価のレコードの作成に失敗した作業は active のまま残り、次の定期実行で再試行される", async () => {
    const task = await endedTask(net)
    vi.spyOn(console, "warn").mockImplementation(() => {})
    net.down.add("https://bsky.social")
    await finalizeTasks(END, testEnv)
    const store = createStore(testEnv)
    expect((await store.tasks.get(task.id))?.status).toBe("active")
    expect(await store.evaluations.get(task.id)).toBeNull()
    net.down.clear()
    await finalizeTasks(END + 5 * 60_000, testEnv)
    expect((await store.tasks.get(task.id))?.status).toBe("ended")
    expect(await store.evaluations.get(task.id)).not.toBeNull()
  })

  test("結果確認が期限切れの作業は、最後の進捗を終点として評価される", async () => {
    const task = await endedTask(net, {}, "expired")
    await createStore(testEnv).reports.put(reportRow(task, { value: 300, receivedAt: task.startedAt + DAY }))
    await finalizeTasks(END, testEnv)
    expect((await createStore(testEnv).evaluations.get(task.id))?.finalRatePermille).toBe(1000)
  })

  test("欠測は減点としてシステムオプションの値で評価に反映される", async () => {
    const task = await endedTask(net)
    await finalizeTasks(END, testEnv)
    const row = (await createStore(testEnv).evaluations.get(task.id))!
    expect(row.missingCount).toBe(2) // 2日 × 必須1回、記録なし
    expect(row.scoreHundredths).toBe(0)
  })
})
