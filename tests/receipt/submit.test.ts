import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { NSID } from "../../src/lexicon/nsid"
import { createStore } from "../../src/platform/store"
import { submitReport } from "../../src/receipt/submit"
import { BOT_DID, FakeNet, blobRef, USER_DID, enrolled, issueCheckin, resetDb, testEnv, userReport } from "./fakeNet"

const NOW = Date.parse("2026-10-19T01:00:00.000Z")
const MIN = 60_000
let net: FakeNet
beforeEach(async () => {
  net = new FakeNet()
  net.install()
  await resetDb()
})
afterEach(() => vi.unstubAllGlobals())

async function setup(over = {}) {
  const { row } = await enrolled(net, NOW, over)
  const checkin = await issueCheckin(net, row, { kind: "progress", issuedAt: NOW + 60 * MIN, expiresAt: NOW + 90 * MIN })
  return { row, checkin }
}

describe("submitReport", () => {
  test("receipt/AC-10: 受理した報告の受領証が、ユーザーのレコードの参照と実測値を持つ", async () => {
    const { row, checkin } = await setup()
    const rec = await userReport(net, row, checkin, { kind: "progress", value: 125 })
    const r = await submitReport(testEnv, rec.uri, NOW + 70 * MIN)
    expect(r).toMatchObject({ ok: true, status: "accepted" })
    const receipt = net.get(BOT_DID, NSID.receipt, checkin.key)!.value
    expect(receipt).toMatchObject({ status: "accepted", record: rec, value: 125, subject: USER_DID, receivedAt: new Date(NOW + 70 * MIN).toISOString() })
    const store = createStore(testEnv)
    expect(await store.reports.get(checkin.key)).toMatchObject({ value: 125, kind: "progress", recordUri: rec.uri })
    expect(await store.openCheckins.get(checkin.key)).toBeNull()
  })

  test("receipt/AC-7: 確認依頼の期限の1秒後に届いた報告の受理依頼は拒否される", async () => {
    const { row, checkin } = await setup()
    const rec = await userReport(net, row, checkin, { kind: "progress", value: 100 })
    expect(await submitReport(testEnv, rec.uri, checkin.open.expiresAt + 1000)).toMatchObject({ ok: false, status: 410, reason: "expired" })
    expect(net.list(BOT_DID, NSID.receipt)).toHaveLength(0)
  })

  test("期限ちょうどは受理される(createdAt は判定に使わない)", async () => {
    const { row, checkin } = await setup()
    const rec = await userReport(net, row, checkin, { kind: "progress", value: 100, at: "2020-01-01T00:00:00.000Z" })
    expect((await submitReport(testEnv, rec.uri, checkin.open.expiresAt)).ok).toBe(true)
  })

  test("receipt/AC-8: 確認依頼を参照していない報告は受理されない", async () => {
    const { row, checkin } = await setup()
    const rec = await userReport(net, row, { ref: { uri: `at://${BOT_DID}/${NSID.checkin}/unknown`, cid: checkin.ref.cid } }, { kind: "progress", value: 100 })
    expect(await submitReport(testEnv, rec.uri, NOW + 70 * MIN)).toMatchObject({ ok: false, status: 422, reason: "mismatch" })
  })

  test("別の作業・別の種別・別のユーザーの報告は不整合として拒否される", async () => {
    const { row, checkin } = await setup()
    const store = createStore(testEnv)
    // 種別の不一致: 進捗の確認依頼に結果報告
    const asResult = await userReport(net, row, checkin, { kind: "result", value: 100 })
    expect(await submitReport(testEnv, asResult.uri, NOW + 70 * MIN)).toMatchObject({ status: 422, reason: "mismatch" })
    // 作業 CID の不一致
    await store.openCheckins.put({ ...checkin.open })
    const wrongTask = await userReport(net, row, checkin, { kind: "progress", value: 100, taskCid: checkin.ref.cid })
    expect(await submitReport(testEnv, wrongTask.uri, NOW + 70 * MIN)).toMatchObject({ status: 422, reason: "mismatch" })
    // 確認依頼の宛先が別ユーザー
    await store.openCheckins.put({ ...checkin.open, did: "did:plc:someoneelse" })
    const ok = await userReport(net, row, checkin, { kind: "progress", value: 100 })
    expect(await submitReport(testEnv, ok.uri, NOW + 70 * MIN)).toMatchObject({ status: 422, reason: "mismatch" })
  })

  test("receipt/AC-9: 開始前画像のある作業の報告に証跡画像がなければ受理されない", async () => {
    const { row, checkin } = await setup({ startImage: await blobRef("start") })
    expect(row.evidenceRequired).toBe(true)
    const none = await userReport(net, row, checkin, { kind: "progress", value: 100 })
    expect(await submitReport(testEnv, none.uri, NOW + 70 * MIN)).toMatchObject({ ok: false, status: 422, reason: "evidence-missing" })
    // 画像の参照があっても、実体がなければ拒否
    const ghost = await userReport(net, row, checkin, { kind: "progress", value: 100, evidenceCid: (await blobRef("ghost")).ref.$link })
    expect(await submitReport(testEnv, ghost.uri, NOW + 70 * MIN)).toMatchObject({ status: 422, reason: "evidence-missing" })
    // 実在すれば受理
    const realCid = (await blobRef("real")).ref.$link
    net.blobs.add(realCid)
    const real = await userReport(net, row, checkin, { kind: "progress", value: 100, evidenceCid: realCid })
    expect((await submitReport(testEnv, real.uri, NOW + 70 * MIN)).ok).toBe(true)
  })

  test("receipt/AC-11: 同じ確認依頼に2件目の報告を受理依頼すると、拒否される", async () => {
    const { row, checkin } = await setup()
    const first = await userReport(net, row, checkin, { kind: "progress", value: 100 })
    const second = await userReport(net, row, checkin, { kind: "progress", value: 900 })
    expect((await submitReport(testEnv, first.uri, NOW + 70 * MIN)).ok).toBe(true)
    expect(await submitReport(testEnv, second.uri, NOW + 71 * MIN)).toMatchObject({ ok: false, status: 409, reason: "duplicate" })
    expect(net.list(BOT_DID, NSID.receipt)).toHaveLength(1)
  })

  test("同じ報告の再送は、受領証を増やさず拒否される(作成後は確認依頼が閉じている)", async () => {
    const { row, checkin } = await setup()
    const rec = await userReport(net, row, checkin, { kind: "progress", value: 100 })
    await submitReport(testEnv, rec.uri, NOW + 70 * MIN)
    expect(await submitReport(testEnv, rec.uri, NOW + 71 * MIN)).toMatchObject({ status: 409 })
    expect(net.list(BOT_DID, NSID.receipt)).toHaveLength(1)
  })

  test("保存先の登録が途中で止まっていても、同じ報告の再送で登録が完了する", async () => {
    const { row, checkin } = await setup()
    const rec = await userReport(net, row, checkin, { kind: "progress", value: 100 })
    const store = createStore(testEnv)
    // 受領証は作られたが登録されていない状態
    await net.put(BOT_DID, NSID.receipt, checkin.key, {
      $type: NSID.receipt, subject: USER_DID, checkin: checkin.ref, status: "accepted", record: rec, value: 100, receivedAt: new Date(NOW).toISOString(),
    })
    const r = await submitReport(testEnv, rec.uri, NOW + 70 * MIN)
    expect(r).toMatchObject({ ok: true })
    expect(await store.reports.get(checkin.key)).not.toBeNull()
    expect(await store.openCheckins.get(checkin.key)).toBeNull()
  })

  test("結果報告を受理すると作業の結果状態が accepted になる", async () => {
    const { row } = await enrolled(net, NOW)
    const checkin = await issueCheckin(net, row, { kind: "result", issuedAt: NOW, expiresAt: NOW + 30 * MIN, day: "end" })
    const rec = await userReport(net, row, checkin, { kind: "result", value: 300 })
    expect((await submitReport(testEnv, rec.uri, NOW + 10 * MIN)).ok).toBe(true)
    expect((await createStore(testEnv).tasks.get(row.id))?.resultState).toBe("accepted")
    expect((await createStore(testEnv).reports.get(checkin.key))?.note).toBe("終わった")
  })

  test("存在しない記録・構造違反・URI の誤りは拒否され、PDS 障害は再試行可の 502", async () => {
    const { row, checkin } = await setup()
    expect(await submitReport(testEnv, `at://${USER_DID}/app.bsky.feed.post/x`, NOW)).toMatchObject({ status: 422, reason: "bad-uri" })
    expect(await submitReport(testEnv, `at://${USER_DID}/${NSID.progress}/3nope`, NOW)).toMatchObject({ status: 422, reason: "invalid-record" })
    const rec = await userReport(net, row, checkin, { kind: "progress", value: 100 })
    net.down.add("https://pds.user.test")
    expect(await submitReport(testEnv, rec.uri, NOW + 70 * MIN)).toMatchObject({ status: 502, reason: "pds-unreachable" })
  })
})
