import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { timedDb } from "../setup/timedDb"
import { submitReport } from "../../src/receipt/submit"
import { FakeNet, blobRef, enrolled, issueCheckin, resetDb, testEnv, userReport } from "./fakeNet"

const NOW = Date.parse("2026-10-19T01:00:00.000Z")
const MIN = 60_000
let net: FakeNet
beforeEach(async () => {
  net = new FakeNet()
  net.install()
  await resetDb()
})
afterEach(() => vi.unstubAllGlobals())

test("receipt/AC-17: 報告の受理依頼1件で発生する外部への通信が、保存先の操作を除いて8回以下", async () => {
  const realCid = (await blobRef("real")).ref.$link
  net.blobs.add(realCid)
  const { row } = await enrolled(net, NOW, { startImage: await blobRef("start") })
  const checkin = await issueCheckin(net, row, { kind: "progress", issuedAt: NOW, expiresAt: NOW + 30 * MIN })
  const rec = await userReport(net, row, checkin, { kind: "progress", value: 100, evidenceCid: realCid })
  net.calls.length = 0
  expect((await submitReport(testEnv, rec.uri, NOW + MIN)).ok).toBe(true)
  expect(net.calls.length).toBeLessThanOrEqual(8)
})

test("receipt/AC-16: 報告の受理依頼を100回処理したとき、1件あたりの処理時間が10ミリ秒以下", async () => {
  // 試験環境の時計では CPU 時間そのものは測れない。通信を模擬に置き換え、保存先の待ち時間を差し引いた処理全体の時間で上限を確かめる(実機の CPU 時間は PoC で測定する)
  const { row } = await enrolled(net, NOW)
  const uris: string[] = []
  const ids: string[] = []
  for (let i = 0; i < 100; i++) {
    const checkin = await issueCheckin(net, row, { kind: "progress", issuedAt: NOW, expiresAt: NOW + 30 * MIN, day: `d${i}` })
    uris.push((await userReport(net, row, checkin, { kind: "progress", value: i })).uri)
    ids.push(checkin.key)
  }
  const io = { ms: 0 }
  const timedEnv = { ...testEnv, DB: timedDb(testEnv.DB, io) } as typeof testEnv
  const t0 = performance.now()
  for (const uri of uris) expect((await submitReport(timedEnv, uri, NOW + MIN)).ok).toBe(true)
  expect(io.ms).toBeGreaterThan(0)
  expect((performance.now() - t0 - io.ms) / 100).toBeLessThanOrEqual(10)
})
