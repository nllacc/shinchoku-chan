import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { NSID } from "../../src/lexicon/nsid"
import { createStore } from "../../src/platform/store"
import worker from "../../src/worker/index"
import { BOT_DID, FakeNet, USER_DID, issueCheckin, resetDb, seedTask, testEnv, userReport } from "./fakeNet"

let net: FakeNet
beforeEach(async () => {
  net = new FakeNet()
  net.install()
  await resetDb()
})
afterEach(() => vi.unstubAllGlobals())

const call = (path: string, body?: unknown) =>
  worker.fetch(new Request(`https://x.test${path}`, body ? { method: "POST", body: JSON.stringify(body) } : {}), testEnv)

// 画面が行う順序(作業の受理 → 確認依頼の取得 → 報告の受理)を、API 経由で通す
test("receipt: 作業の受理から報告の受理までを API 経由で通せる", async () => {
  const { taskUri } = await seedTask(net, { durationDays: 3, slot: "morning" })
  const enrolledRes = await call("/api/enroll", { taskUri })
  expect(enrolledRes.status).toBe(200)
  const { taskId, windows } = (await enrolledRes.json()) as { taskId: string; windows: unknown[] }
  expect(windows).toEqual([{ startMinute: 480, endMinute: 720 }])

  const row = (await createStore(testEnv).tasks.get(taskId))!
  const now = Date.now()
  const checkin = await issueCheckin(net, row, { kind: "progress", issuedAt: now, expiresAt: now + 30 * 60_000 })

  const info = (await (await call(`/api/checkin?id=${checkin.key}`)).json()) as Record<string, any>
  expect(info).toMatchObject({ status: "issued", did: USER_DID, kind: "progress", evidenceRequired: false })
  expect(info.taskRef).toEqual({ uri: taskUri, cid: row.taskCid })
  expect(info.metric).toMatchObject({ name: "距離", unit: "km", scale: 1 })

  const rec = await userReport(net, row, { ref: info.checkinRef }, { kind: "progress", value: 150 })
  const submitted = await call("/api/submit", { recordUri: rec.uri })
  expect(submitted.status).toBe(200)
  expect(net.list(BOT_DID, NSID.receipt)).toHaveLength(1)

  // 解決済みの確認依頼は状態だけを返す
  expect(await (await call(`/api/checkin?id=${checkin.key}`)).json()).toMatchObject({ status: "accepted" })
  expect((await call("/api/checkin?id=unknown")).status).toBe(404)
  // 二重の受理は 409
  const again = await call("/api/submit", { recordUri: rec.uri })
  expect(again.status).toBe(409)
  expect((await again.json()) as any).toMatchObject({ error: { kind: "duplicate" } })
})

test("不正な入力は 422 を返す", async () => {
  expect((await call("/api/enroll", {})).status).toBe(422)
  expect((await call("/api/submit", { recordUri: 5 })).status).toBe(422)
  expect((await call("/api/checkin")).status).toBe(422)
})
