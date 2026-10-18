import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { NSID } from "../../src/lexicon/nsid"
import { getDetail } from "../../src/ranking/detail"
import { createStore } from "../../src/platform/store"
import { FakeNet, USER_DID, USER_PDS, blobRef, resetDb, testEnv, userReport } from "../receipt/fakeNet"
import { DAY, NOW, endedTask, reportRow } from "./helpers"
import { finalizeTasks } from "../../src/ranking/finalize"

let net: FakeNet
beforeEach(async () => {
  net = new FakeNet()
  net.install()
  await resetDb()
})
afterEach(() => vi.unstubAllGlobals())

async function evaluatedWithImages() {
  const start = await blobRef("start")
  const evidence = await blobRef("evidence")
  const { row } = await (await import("../receipt/fakeNet")).enrolled(net, NOW, { durationDays: 2, slot: "morning", startImage: start, goal: "30km 走り切る", summary: "毎日ランニングを続ける。".repeat(10) })
  const task = { ...row, resultState: "accepted" as const }
  const store = createStore(testEnv)
  await store.tasks.put(task)
  const rec = await userReport(net, task, { ref: { uri: `at://x/y/z`, cid: "bafyreigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi" } }, { kind: "result", value: 300, evidenceCid: evidence.ref.$link })
  await store.reports.put(reportRow(task, { kind: "result", value: 300, receivedAt: task.endsAt - 1000, note: "やり切った", recordUri: rec.uri, recordCid: rec.cid }))
  await finalizeTasks(NOW + 3 * DAY, testEnv)
  return { task, start, evidence }
}

describe("getDetail", () => {
  test("ranking/AC-11: 詳細が、作業のゴールと概要の全文と欠測件数を含む", async () => {
    const { task } = await evaluatedWithImages()
    const d = (await getDetail(testEnv, task.id))!
    expect(d).toMatchObject({ goal: "30km 走り切る", summary: "毎日ランニングを続ける。".repeat(10), missingCount: 2, resultDescription: "やり切った", durationDays: 2, finalRatePermille: 1000 })
    expect(d.metric).toMatchObject({ name: "距離", unit: "km", scale: 1, startValue: 0, goalValue: 300 })
    expect(d.profileUrl).toBe("https://bsky.app/profile/user.test")
  })

  test("ranking/AC-12: 画像のあるレコードの詳細が、PDSの公開URLを含む", async () => {
    const { task, start, evidence } = await evaluatedWithImages()
    const d = (await getDetail(testEnv, task.id))!
    expect(d.startImageUrl).toBe(`${USER_PDS}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(USER_DID)}&cid=${start.ref.$link}`)
    expect(d.evidenceUrl).toContain(`cid=${evidence.ref.$link}`)
  })

  test("レコードが削除済みなら画像だけ省略し、そのほかは保存先の値を返す", async () => {
    const { task } = await evaluatedWithImages()
    net.remove(USER_DID, NSID.task, task.taskUri.split("/").pop()!)
    const d = (await getDetail(testEnv, task.id))!
    expect(d.startImageUrl).toBeUndefined()
    expect(d.evidenceUrl).toBeDefined()
    expect(d.goal).toBe("30km 走り切る")
  })

  test("PDS に到達できなくても詳細は返る", async () => {
    const { task } = await evaluatedWithImages()
    net.down.add(USER_PDS)
    const d = (await getDetail(testEnv, task.id))!
    expect(d.startImageUrl).toBeUndefined()
    expect(d.summary).toContain("ランニング")
  })

  test("評価の行がない、または visible が偽の作業は null", async () => {
    expect(await getDetail(testEnv, "nothing")).toBeNull()
    const { task } = await evaluatedWithImages()
    await createStore(testEnv).evaluations.patch(task.id, { visible: false })
    expect(await getDetail(testEnv, task.id)).toBeNull()
  })
})
