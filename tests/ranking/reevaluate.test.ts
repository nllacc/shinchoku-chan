import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { NSID } from "../../src/lexicon/nsid"
import { createStore } from "../../src/platform/store"
import { finalizeTasks, reevaluateStale } from "../../src/ranking/finalize"
import { BOT_DID, FakeNet, resetDb, testEnv } from "../receipt/fakeNet"
import { DAY, NOW, endedTask, reportRow } from "./helpers"

const END = NOW + 3 * DAY
let net: FakeNet
beforeEach(async () => {
  net = new FakeNet()
  net.install()
  await resetDb()
})
afterEach(() => vi.unstubAllGlobals())

async function evaluated() {
  const task = await endedTask(net)
  const store = createStore(testEnv)
  // 経過割合に沿った記録と、1つだけ大きく外れた記録(index 2)、結果報告
  const records = [0.1, 0.3, 0.5, 0.7, 0.9].map((f, i) =>
    reportRow(task, { value: i === 2 ? 290 : Math.round(f * 300), receivedAt: task.startedAt + f * 2 * DAY }),
  )
  for (const r of records) await store.reports.put(r)
  await store.reports.put(reportRow(task, { kind: "result", value: 300, receivedAt: task.endsAt - 1000 }))
  await finalizeTasks(END, testEnv)
  return { task, store, records }
}

describe("reevaluateStale", () => {
  test("ranking/AC-5: 報告が取消されると、その作業の評価点が再計算され、評価のレコードが追加される", async () => {
    const { task, store, records } = await evaluated()
    const before = (await store.evaluations.get(task.id))!
    expect(net.list(BOT_DID, NSID.evaluation)).toHaveLength(1)
    // 取消(受理側の再確認が行う更新)
    await store.reports.patch(records[2]!.checkinId, { revoked: "tampered" })
    await store.evaluations.patch(task.id, { stale: true })
    await reevaluateStale(END + 25 * 3_600_000, testEnv)
    const after = (await store.evaluations.get(task.id))!
    expect(net.list(BOT_DID, NSID.evaluation)).toHaveLength(2)
    expect(after.stale).toBe(false)
    expect(after.finalizedAt).toBeGreaterThan(before.finalizedAt)
    expect(after.missingCount).toBe(before.missingCount)
    expect(after.scoreHundredths).toBeGreaterThan(before.scoreHundredths)
  })

  test("ranking/AC-6: 取り下げられた作業は再評価されず、ランキングの対象外のままになる", async () => {
    const { task, store } = await evaluated()
    await store.tasks.patch(task.id, { status: "withdrawn" })
    await store.evaluations.patch(task.id, { stale: true, visible: false })
    await reevaluateStale(END + DAY, testEnv)
    expect(net.list(BOT_DID, NSID.evaluation)).toHaveLength(1)
    expect(await store.evaluations.listStale(10)).toHaveLength(0)
    expect((await store.evaluations.get(task.id))?.visible).toBe(false)
  })

  test("stale でない評価は再評価されない", async () => {
    await evaluated()
    await reevaluateStale(END + DAY, testEnv)
    expect(net.list(BOT_DID, NSID.evaluation)).toHaveLength(1)
  })

  test("再評価の書き込みに失敗した行は stale のまま残る", async () => {
    const { task, store } = await evaluated()
    vi.spyOn(console, "warn").mockImplementation(() => {})
    await store.evaluations.patch(task.id, { stale: true })
    net.down.add("https://bsky.social")
    await reevaluateStale(END + DAY, testEnv)
    expect((await store.evaluations.get(task.id))?.stale).toBe(true)
  })
})
