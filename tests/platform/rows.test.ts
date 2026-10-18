import { describe, expect, test } from "vitest"
import type { BotAgent } from "../../src/platform/botSession"
import { FREE_FLAGS } from "../../src/platform/entitlement"
import { createMemoryStore } from "../../src/platform/memoryStore"
import { putRecordOnce } from "../../src/platform/rkey"
import {
  evaluationRowFromRecords,
  openCheckinRowFromRecords,
  reportRowFromRecords,
  taskRowFromRecords,
} from "../../src/platform/rows"
import { slotToWindow } from "../../src/platform/time"

const enrollment = {
  task: { uri: "at://did:plc:u/t/1", cid: "bafyt" },
  startedAt: "2026-10-01T00:00:00.000Z",
  endsAt: "2026-10-04T00:00:00.000Z",
  durationDays: 3,
  windows: [slotToWindow("morning")],
  dailyTarget: 1,
  scale: 1,
  startValue: 0,
  goalValue: 100,
}
const taskRec = {
  title: "走る",
  summary: "毎朝走る",
  goal: "10km",
  metric: { name: "距離", unit: "km" },
  anchor: { uri: "at://did:plc:u/p/1", cid: "bafya" },
}
const eRef = { uri: "at://did:plc:bot/e/ENR1", cid: "bafye" }
const owner = { did: "did:plc:u", handle: "u.example.com", pds: "https://pds.example" }

describe("rows", () => {
  test("受理と作業のレコードから作業の行を作る（独自ドメインの handle も扱える）", () => {
    const row = taskRowFromRecords({ enrollment, enrollmentRef: eRef, task: taskRec, owner, flags: FREE_FLAGS })
    expect(row).toMatchObject({
      id: "ENR1", handle: "u.example.com", title: "走る", taskUri: "at://did:plc:u/t/1",
      startedAt: Date.parse("2026-10-01T00:00:00.000Z"), status: "active", evidenceRequired: false, priority: false,
    })
    expect(taskRowFromRecords({ enrollment, enrollmentRef: eRef, task: { ...taskRec, startImage: {} }, owner, flags: { ...FREE_FLAGS, priority: true } })).toMatchObject({ evidenceRequired: true, priority: true })
  })

  test("作業レコードが削除済みなら自由記述を空にして withdrawn の行を作る", () => {
    const row = taskRowFromRecords({ enrollment, enrollmentRef: eRef, task: null, owner, flags: FREE_FLAGS })
    expect(row).toMatchObject({ status: "withdrawn", title: "", summary: "", anchorUri: "" })
  })

  test("platform/AC-13: 保存する受理・確認依頼・受領証の行が、Botのレコードの参照を持つ", () => {
    const task = taskRowFromRecords({ enrollment, enrollmentRef: eRef, task: taskRec, owner, flags: FREE_FLAGS })
    expect(task.enrollmentUri).toBe(eRef.uri)
    expect(task.enrollmentCid).toBe(eRef.cid)
    const checkin = openCheckinRowFromRecords({
      checkin: { subject: "did:plc:u", kind: "progress", seq: 2, issuedAt: "2026-10-01T01:00:00.000Z", expiresAt: "2026-10-01T01:30:00.000Z" },
      checkinRef: { uri: "at://did:plc:bot/c/CHK1", cid: "bafyc" }, taskId: "ENR1", replyUri: null,
    })
    expect(checkin).toMatchObject({ id: "CHK1", checkinUri: "at://did:plc:bot/c/CHK1", checkinCid: "bafyc", seq: 2, replyUri: null })
    expect(checkin.expiresAt - checkin.issuedAt).toBe(30 * 60_000)
    const report = reportRowFromRecords({
      receipt: { status: "accepted", record: { uri: "at://did:plc:u/p/9", cid: "bafyp" }, value: 42, receivedAt: "2026-10-01T01:10:00.000Z" },
      receiptRef: { uri: "at://did:plc:bot/r/CHK1", cid: "bafyr" }, kind: "progress", taskId: "ENR1",
      userRecord: { note: "順調" }, recordRef: { uri: "at://did:plc:u/p/9", cid: "bafyp" },
    })
    expect(report).toMatchObject({ checkinId: "CHK1", receiptUri: "at://did:plc:bot/r/CHK1", receiptCid: "bafyr", recordUri: "at://did:plc:u/p/9", value: 42, note: "順調" })
    const result = reportRowFromRecords({
      receipt: { status: "accepted", value: 100, receivedAt: "2026-10-04T01:10:00.000Z" },
      receiptRef: { uri: "at://did:plc:bot/r/CHK2", cid: "bafyr2" }, kind: "result", taskId: "ENR1",
      userRecord: { description: "達成" }, recordRef: { uri: "at://did:plc:u/r/1", cid: "bafyr3" },
    })
    expect(result.note).toBe("達成")
    expect(() => reportRowFromRecords({ receipt: { status: "expired", receivedAt: "2026-10-01T00:00:00.000Z" }, receiptRef: eRef, kind: "progress", taskId: "x", userRecord: null, recordRef: eRef })).toThrow(RangeError)
    const ev = evaluationRowFromRecords({
      evaluation: { scoreHundredths: 8000, finalRatePermille: 900, missingCount: 1, algorithm: "v1", finalizedAt: "2026-10-05T00:00:00.000Z" },
      evaluationRef: { uri: "at://did:plc:bot/ev/1", cid: "bafyev" }, task,
    })
    expect(ev).toMatchObject({ taskId: "ENR1", handle: "u.example.com", evaluationUri: "at://did:plc:bot/ev/1", visible: true, stale: false })
  })

  test("同じレコードから同じ行ができる（純粋関数）", () => {
    const make = () => taskRowFromRecords({ enrollment, enrollmentRef: eRef, task: taskRec, owner, flags: FREE_FLAGS })
    expect(make()).toEqual(make())
  })
})

// キーを指定した作成を模したBotのリポジトリ
function fakeBotRepo() {
  const records = new Map<string, { uri: string; cid: string }>()
  let creates = 0
  const agent = {
    did: "did:plc:bot",
    pds: "https://fake",
    async xrpc(method: string, nsid: string, opts: { body?: any; query?: any } = {}) {
      if (nsid === "com.atproto.repo.putRecord") {
        const { collection, rkey } = opts.body
        const key = `${collection}/${rkey}`
        if (records.has(key)) return new Response('{"error":"InvalidSwap"}', { status: 400 })
        creates++
        const ref = { uri: `at://did:plc:bot/${key}`, cid: `cid${creates}` }
        records.set(key, ref)
        return Response.json(ref)
      }
      const key = `${opts.query.collection}/${opts.query.rkey}`
      return Response.json(records.get(key))
    },
  } as unknown as BotAgent
  return { agent, count: () => records.size }
}

describe("create and register", () => {
  test("platform/AC-15: 同じキーで2回目に作ろうとしたレコードは、拒否されて1件のままである", async () => {
    const repo = fakeBotRepo()
    const a = await putRecordOnce(repo.agent, "c.example.checkin", "K1", { n: 1 })
    const b = await putRecordOnce(repo.agent, "c.example.checkin", "K1", { n: 2 })
    expect(a.created).toBe(true)
    expect(b).toEqual({ ref: a.ref, created: false })
    expect(repo.count()).toBe(1)
  })

  test("platform/AC-12: Botのレコードの作成後に登録が失敗しても、同じ入力で再実行するとレコードは1件のまま行が1件登録される", async () => {
    const repo = fakeBotRepo()
    const store = createMemoryStore()
    let failOnce = true
    const register = async () => {
      const { ref } = await putRecordOnce(repo.agent, "c.example.checkin", "CHK1", { kind: "progress" })
      const row = openCheckinRowFromRecords({
        checkin: { subject: "did:plc:u", kind: "progress", seq: 1, issuedAt: "2026-10-01T01:00:00.000Z", expiresAt: "2026-10-01T01:30:00.000Z" },
        checkinRef: ref, taskId: "ENR1", replyUri: null,
      })
      if (failOnce) { failOnce = false; throw new Error("store down") }
      await store.openCheckins.put(row)
    }
    await expect(register()).rejects.toThrow("store down")
    await register()
    await register()
    expect(repo.count()).toBe(1)
    expect(await store.openCheckins.getMany(["CHK1"])).toHaveLength(1)
  })
})
