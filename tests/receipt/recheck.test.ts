import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { NSID } from "../../src/lexicon/nsid"
import { createStore } from "../../src/platform/store"
import { recheckRecords } from "../../src/receipt/recheck"
import { submitReport } from "../../src/receipt/submit"
import { BOT_DID, FakeNet, USER_DID, enrolled, issueCheckin, resetDb, testEnv, userReport } from "./fakeNet"

const NOW = Date.parse("2026-10-19T01:00:00.000Z")
const MIN = 60_000
const LATER = NOW + 25 * 3_600_000 // 再確認の間隔(24時間)を過ぎた時刻
let net: FakeNet
beforeEach(async () => {
  net = new FakeNet()
  net.install()
  await resetDb()
})
afterEach(() => vi.unstubAllGlobals())

async function acceptedReport() {
  const { row, taskUri } = await enrolled(net, NOW)
  const c = await issueCheckin(net, row, { kind: "progress", issuedAt: NOW, expiresAt: NOW + 30 * MIN })
  const rec = await userReport(net, row, c, { kind: "progress", value: 100 })
  expect((await submitReport(testEnv, rec.uri, NOW + MIN)).ok).toBe(true)
  const store = createStore(testEnv)
  await store.evaluations.put({
    taskId: row.id, handle: row.handle, summary: row.summary, durationDays: 3, scoreHundredths: 5000, finalRatePermille: 500, missingCount: 0,
    algorithm: "linear-v1", evaluationUri: null, finalizedAt: NOW, stale: false, visible: true,
  })
  // 受理した作業の再確認は後続の確認で行うため、ここでは作業の確認済み時刻を新しくしておく
  await store.tasks.patch(row.id, { checkedAt: LATER })
  return { row, taskUri, c, rec, store }
}

describe("recheckRecords", () => {
  test("変化がなければ確認済みの時刻だけを更新し、取消は作らない", async () => {
    const { c, store } = await acceptedReport()
    await recheckRecords(LATER, testEnv)
    expect((await store.reports.get(c.key))?.checkedAt).toBe(LATER)
    expect(net.list(BOT_DID, NSID.revocation)).toHaveLength(0)
  })

  test("receipt/AC-13: 受理後に内容を書き換えたレコードは、再確認で取消が作られ、対象から外れる", async () => {
    const { c, rec, store } = await acceptedReport()
    const key = rec.uri.split("/").pop()!
    await net.put(USER_DID, NSID.progress, key, { ...net.get(USER_DID, NSID.progress, key)!.value, value: 999 })
    await recheckRecords(LATER, testEnv)
    const revs = net.list(BOT_DID, NSID.revocation)
    expect(revs).toHaveLength(1)
    const report = (await store.reports.get(c.key))!
    expect(revs[0]!.value).toMatchObject({ reason: "tampered", subject: USER_DID, target: { uri: report.receiptUri, cid: report.receiptCid } })
    expect(report.revoked).toBe("tampered")
    expect((await store.evaluations.get(report.taskId))?.stale).toBe(true)
    // 取消済みは再確認の対象から外れる
    await recheckRecords(LATER + 25 * 3_600_000, testEnv)
    expect(net.list(BOT_DID, NSID.revocation)).toHaveLength(1)
  })

  test("報告のレコードが削除されていれば reason: deleted の取消を作る", async () => {
    const { c, rec, store } = await acceptedReport()
    net.remove(USER_DID, NSID.progress, rec.uri.split("/").pop()!)
    await recheckRecords(LATER, testEnv)
    expect(net.list(BOT_DID, NSID.revocation)[0]!.value.reason).toBe("deleted")
    expect((await store.reports.get(c.key))?.revoked).toBe("deleted")
  })

  test("receipt/AC-14: 受理後に作業レコードを削除すると、再確認でその作業が取り下げられる", async () => {
    const { row, taskUri, store } = await acceptedReport()
    await store.tasks.patch(row.id, { checkedAt: 0 })
    net.remove(USER_DID, NSID.task, taskUri.split("/").pop()!)
    await recheckRecords(LATER, testEnv)
    expect((await store.tasks.get(row.id))?.status).toBe("withdrawn")
    expect((await store.evaluations.get(row.id))?.visible).toBe(false)
    const revs = net.list(BOT_DID, NSID.revocation)
    expect(revs).toHaveLength(1)
    expect(revs[0]!.value).toMatchObject({ reason: "deleted", target: { uri: row.enrollmentUri, cid: row.enrollmentCid } })
  })

  test("作業レコードが書き換えられた場合も、取消を作って取り下げる", async () => {
    const { row, taskUri, store } = await acceptedReport()
    await store.tasks.patch(row.id, { checkedAt: 0 })
    const key = taskUri.split("/").pop()!
    await net.put(USER_DID, NSID.task, key, { ...net.get(USER_DID, NSID.task, key)!.value, goal: "改変" })
    await recheckRecords(LATER, testEnv)
    expect((await store.tasks.get(row.id))?.status).toBe("withdrawn")
    expect(net.list(BOT_DID, NSID.revocation)[0]!.value.reason).toBe("tampered")
  })

  test("PDS の一時的な失敗では行を更新せず、次の定期実行で再試行する", async () => {
    const { c, store } = await acceptedReport()
    vi.spyOn(console, "warn").mockImplementation(() => {})
    net.down.add("https://pds.user.test")
    await recheckRecords(LATER, testEnv)
    expect((await store.reports.get(c.key))?.checkedAt).toBe(0)
    net.down.clear()
    await recheckRecords(LATER + 5 * MIN, testEnv)
    expect((await store.reports.get(c.key))?.checkedAt).toBe(LATER + 5 * MIN)
  })

  test("確認の間隔(24時間)が過ぎていない行は対象にならない", async () => {
    const { c, store } = await acceptedReport()
    await store.reports.patch(c.key, { checkedAt: NOW })
    await recheckRecords(NOW + 3_600_000, testEnv)
    expect((await store.reports.get(c.key))?.checkedAt).toBe(NOW)
  })

  test("1回に確認するのは10件まで", async () => {
    const { row } = await enrolled(net, NOW)
    const store = createStore(testEnv)
    for (let i = 0; i < 12; i++) {
      const c = await issueCheckin(net, row, { kind: "progress", issuedAt: NOW, expiresAt: NOW + 30 * MIN, day: `d${i}` })
      const rec = await userReport(net, row, c, { kind: "progress", value: i })
      await submitReport(testEnv, rec.uri, NOW + MIN)
    }
    await store.tasks.patch(row.id, { checkedAt: LATER })
    await recheckRecords(LATER, testEnv)
    const done = (await store.reports.listByTask(row.id)).filter((r) => r.checkedAt === LATER)
    expect(done).toHaveLength(10)
  })
})
