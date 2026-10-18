import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { NSID } from "../../src/lexicon/nsid"
import { enrollTask } from "../../src/receipt/enroll"
import { createStore } from "../../src/platform/store"
import { BOT_DID, FakeNet, USER_DID, resetDb, seedTask, testEnv } from "./fakeNet"

const NOW = Date.parse("2026-10-19T01:00:00.000Z") // 日本時間 10:00
const DAY = 86_400_000
let net: FakeNet
beforeEach(async () => {
  net = new FakeNet()
  net.install()
  await resetDb()
})
afterEach(() => vi.unstubAllGlobals())

describe("enrollTask", () => {
  test("receipt/AC-4: 受理した作業の開始時刻が受理時刻で、終了時刻が期間の日数後になる", async () => {
    const { taskUri } = await seedTask(net, { durationDays: 3, slot: "morning" })
    const r = await enrollTask(testEnv, taskUri, NOW)
    expect(r).toMatchObject({ ok: true, startedAt: NOW, endsAt: NOW + 3 * DAY, windows: [{ startMinute: 480, endMinute: 720 }] })
    const row = await createStore(testEnv).tasks.getByTaskUri(taskUri)
    expect(row).toMatchObject({ did: USER_DID, handle: "user.test", pds: "https://pds.user.test", dailyTarget: 1, status: "active", priority: false })
    const enrollment = net.list(BOT_DID, NSID.enrollment)[0]!.value
    expect(enrollment).toMatchObject({ subject: USER_DID, startedAt: new Date(NOW).toISOString(), dailyTarget: 1 })
  })

  test("receipt/AC-1: CIDが一致しない作業レコードの受理依頼は拒否される", async () => {
    const { taskUri } = await seedTask(net)
    net.wrongCid.add(taskUri)
    expect(await enrollTask(testEnv, taskUri, NOW)).toEqual({ ok: false, status: 422, reason: "invalid-record" })
    expect(net.list(BOT_DID, NSID.enrollment)).toHaveLength(0)
  })

  test("構造・意味規則に違反する作業(1日で時間帯あり)は拒否される", async () => {
    const { taskUri } = await seedTask(net, { durationDays: 1, slot: "morning" })
    expect(await enrollTask(testEnv, taskUri, NOW)).toMatchObject({ ok: false, status: 422, reason: "invalid-record" })
  })

  test("receipt/AC-2: 起点投稿がBotへのメンションを含まない作業は受理されない", async () => {
    const { taskUri } = await seedTask(net, {}, { mention: false })
    expect(await enrollTask(testEnv, taskUri, NOW)).toEqual({ ok: false, status: 422, reason: "anchor-invalid" })
  })

  test("receipt/AC-3: 同時進行数1のユーザーが進行中の作業を持つとき、2件目の受理依頼は拒否される", async () => {
    const a = await seedTask(net)
    const b = await seedTask(net)
    expect((await enrollTask(testEnv, a.taskUri, NOW)).ok).toBe(true)
    expect(await enrollTask(testEnv, b.taskUri, NOW + 1000)).toEqual({ ok: false, status: 409, reason: "limit-reached" })
  })

  test("利用資格で同時進行数が増えていれば2件目も受理される", async () => {
    await createStore(testEnv).entitlements.put({
      did: USER_DID,
      plan: "premium",
      flags: JSON.stringify({ maxConcurrentTasks: 2, maxWindows: 3, windowRange: [360, 1380], priority: true, characterSelectable: false }),
      validUntil: null,
    })
    const a = await seedTask(net)
    const b = await seedTask(net)
    expect((await enrollTask(testEnv, a.taskUri, NOW)).ok).toBe(true)
    expect((await enrollTask(testEnv, b.taskUri, NOW)).ok).toBe(true)
    expect((await createStore(testEnv).tasks.getByTaskUri(b.taskUri))?.priority).toBe(true)
  })

  test("receipt/AC-15: 同じ受理依頼を3回送っても、受理レコードは1件である", async () => {
    const { taskUri } = await seedTask(net)
    const results = [await enrollTask(testEnv, taskUri, NOW), await enrollTask(testEnv, taskUri, NOW + 5000), await enrollTask(testEnv, taskUri, NOW + 9000)]
    expect(results.every((r) => r.ok && r.startedAt === NOW)).toBe(true)
    expect(net.list(BOT_DID, NSID.enrollment)).toHaveLength(1)
  })

  test("並列に3回送っても、受理レコードは1件で、全員が同じ開始時刻になる", async () => {
    const { taskUri } = await seedTask(net)
    const rs = await Promise.all([0, 1, 2].map((i) => enrollTask(testEnv, taskUri, NOW + i * 1000)))
    expect(net.list(BOT_DID, NSID.enrollment)).toHaveLength(1)
    expect(new Set(rs.map((r) => (r.ok ? r.startedAt : -1))).size).toBe(1)
  })

  test("保存先の登録が失敗しても、再送すれば作成済みの受理レコードの内容で登録される", async () => {
    const { taskUri } = await seedTask(net)
    const store = createStore(testEnv)
    const put = vi.spyOn(store.tasks, "put")
    expect((await enrollTask(testEnv, taskUri, NOW)).ok).toBe(true)
    put.mockRestore()
    await testEnv.DB.prepare("DELETE FROM tasks").run()
    const again = await enrollTask(testEnv, taskUri, NOW + 60_000)
    expect(again).toMatchObject({ ok: true, startedAt: NOW })
  })

  test("collection が task でない URI・PDS に到達できない場合", async () => {
    expect(await enrollTask(testEnv, `at://${USER_DID}/app.bsky.feed.post/3x`, NOW)).toEqual({ ok: false, status: 422, reason: "bad-uri" })
    const { taskUri } = await seedTask(net)
    net.down.add("https://pds.user.test")
    expect(await enrollTask(testEnv, taskUri, NOW)).toEqual({ ok: false, status: 502, reason: "pds-unreachable" })
  })
})
