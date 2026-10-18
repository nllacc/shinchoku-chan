import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { verifyAnchor } from "../../src/receipt/anchor"
import { BOT_DID, FakeNet, USER_DID, resetDb, seedTask, testEnv } from "./fakeNet"

let net: FakeNet
beforeEach(async () => {
  net = new FakeNet()
  net.install()
  await resetDb()
})
afterEach(() => vi.unstubAllGlobals())

describe("verifyAnchor", () => {
  test("receipt/AC-2: Botへのメンションを含む起点投稿は有効、含まなければ無効", async () => {
    const ok = await seedTask(net)
    expect(await verifyAnchor(testEnv, USER_DID, ok.task.anchor)).toBe(true)
    const ng = await seedTask(net, {}, { mention: false })
    expect(await verifyAnchor(testEnv, USER_DID, ng.task.anchor)).toBe(false)
  })

  test("他人のリポジトリの投稿・投稿以外のコレクション・CID不一致は無効", async () => {
    const t = await seedTask(net)
    expect(await verifyAnchor(testEnv, "did:plc:other", t.task.anchor)).toBe(false)
    expect(await verifyAnchor(testEnv, USER_DID, { uri: t.taskUri, cid: t.taskCid })).toBe(false)
    expect(await verifyAnchor(testEnv, USER_DID, { ...t.task.anchor, cid: t.taskCid })).toBe(false)
  })

  test("存在しない投稿は無効、メンション先が別の DID でも無効", async () => {
    const t = await seedTask(net)
    expect(await verifyAnchor(testEnv, USER_DID, { uri: `at://${USER_DID}/app.bsky.feed.post/3none`, cid: t.task.anchor.cid })).toBe(false)
    expect(await verifyAnchor({ ...testEnv, BOT_DID: BOT_DID + "x" } as never, USER_DID, t.task.anchor)).toBe(false)
  })
})
