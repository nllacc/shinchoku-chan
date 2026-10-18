import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { NSID } from "../../src/lexicon/nsid"
import { createStore } from "../../src/platform/store"
import { expireCheckins } from "../../src/receipt/expire"
import { submitReport } from "../../src/receipt/submit"
import { BOT_DID, FakeNet, enrolled, issueCheckin, resetDb, testEnv, userReport } from "./fakeNet"

const NOW = Date.parse("2026-10-19T01:00:00.000Z")
const MIN = 60_000
let net: FakeNet
beforeEach(async () => {
  net = new FakeNet()
  net.install()
  await resetDb()
})
afterEach(() => vi.unstubAllGlobals())

describe("expireCheckins", () => {
  test("receipt/AC-12: 期限を過ぎた未報告の確認依頼に、期限切れの受領証が1件作られる", async () => {
    const { row } = await enrolled(net, NOW)
    const c = await issueCheckin(net, row, { kind: "progress", issuedAt: NOW, expiresAt: NOW + 30 * MIN })
    await expireCheckins(NOW + 31 * MIN, testEnv)
    const receipts = net.list(BOT_DID, NSID.receipt)
    expect(receipts).toHaveLength(1)
    expect(receipts[0]!.value).toMatchObject({ status: "expired", subject: row.did, checkin: c.ref })
    expect(receipts[0]!.value.record).toBeUndefined()
    expect(await createStore(testEnv).openCheckins.get(c.key)).toBeNull()
    // 繰り返しても増えない
    await expireCheckins(NOW + 40 * MIN, testEnv)
    expect(net.list(BOT_DID, NSID.receipt)).toHaveLength(1)
  })

  test("期限内の確認依頼は何もしない", async () => {
    const { row } = await enrolled(net, NOW)
    const c = await issueCheckin(net, row, { kind: "progress", issuedAt: NOW, expiresAt: NOW + 30 * MIN })
    await expireCheckins(NOW + 10 * MIN, testEnv)
    expect(net.list(BOT_DID, NSID.receipt)).toHaveLength(0)
    expect(await createStore(testEnv).openCheckins.get(c.key)).not.toBeNull()
  })

  test("結果確認が期限切れになると、作業の結果状態が expired になる", async () => {
    const { row } = await enrolled(net, NOW)
    await issueCheckin(net, row, { kind: "result", issuedAt: NOW, expiresAt: NOW + 30 * MIN, day: "end" })
    await expireCheckins(NOW + 31 * MIN, testEnv)
    expect((await createStore(testEnv).tasks.get(row.id))?.resultState).toBe("expired")
  })

  test("1回に処理するのは20件まで。残りは次の定期実行で処理される", async () => {
    const { row } = await enrolled(net, NOW)
    for (let i = 0; i < 25; i++) await issueCheckin(net, row, { kind: "progress", issuedAt: NOW, expiresAt: NOW + 30 * MIN, day: `d${i}` })
    await expireCheckins(NOW + 31 * MIN, testEnv)
    expect(net.list(BOT_DID, NSID.receipt)).toHaveLength(20)
    await expireCheckins(NOW + 32 * MIN, testEnv)
    expect(net.list(BOT_DID, NSID.receipt)).toHaveLength(25)
  })

  test("期限の直前に受理された報告の登録が途中だった場合は、その登録を完了させる(期限切れにしない)", async () => {
    const { row } = await enrolled(net, NOW)
    const c = await issueCheckin(net, row, { kind: "progress", issuedAt: NOW, expiresAt: NOW + 30 * MIN })
    const rec = await userReport(net, row, c, { kind: "progress", value: 100 })
    await net.put(BOT_DID, NSID.receipt, c.key, {
      $type: NSID.receipt, subject: row.did, checkin: c.ref, status: "accepted", record: rec, value: 100, receivedAt: new Date(NOW + MIN).toISOString(),
    })
    await expireCheckins(NOW + 31 * MIN, testEnv)
    const store = createStore(testEnv)
    expect(await store.reports.get(c.key)).toMatchObject({ value: 100 })
    expect(net.get(BOT_DID, NSID.receipt, c.key)!.value.status).toBe("accepted")
  })

  test("失敗した行は次の定期実行で再試行される", async () => {
    const { row } = await enrolled(net, NOW)
    const c = await issueCheckin(net, row, { kind: "progress", issuedAt: NOW, expiresAt: NOW + 30 * MIN })
    vi.spyOn(console, "warn").mockImplementation(() => {})
    net.down.add("https://bsky.social")
    await expireCheckins(NOW + 31 * MIN, testEnv)
    expect(await createStore(testEnv).openCheckins.get(c.key)).not.toBeNull()
    net.down.clear()
    await expireCheckins(NOW + 36 * MIN, testEnv)
    expect(net.list(BOT_DID, NSID.receipt)).toHaveLength(1)
  })

  test("受理後の確認依頼は期限切れの対象にならない", async () => {
    const { row } = await enrolled(net, NOW)
    const c = await issueCheckin(net, row, { kind: "progress", issuedAt: NOW, expiresAt: NOW + 30 * MIN })
    const rec = await userReport(net, row, c, { kind: "progress", value: 100 })
    await submitReport(testEnv, rec.uri, NOW + MIN)
    await expireCheckins(NOW + 31 * MIN, testEnv)
    expect(net.get(BOT_DID, NSID.receipt, c.key)!.value.status).toBe("accepted")
  })
})
