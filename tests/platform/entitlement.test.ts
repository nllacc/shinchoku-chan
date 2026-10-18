import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { FREE_FLAGS, getEntitlement } from "../../src/platform/entitlement"
import type { Env } from "../../src/platform/env"
import { createStore } from "../../src/platform/store"

const e = env as unknown as Env
const flags = { maxConcurrentTasks: 3, maxWindows: 3, windowRange: [360, 1380], priority: true, characterSelectable: true }

describe("entitlement", () => {
  beforeEach(async () => void (await env.DB.prepare("DELETE FROM entitlements").run()))

  test("platform/AC-9: 資格の機能フラグから、同時進行数と窓の数と窓の範囲を取得できる", async () => {
    await createStore(e).entitlements.put({ did: "did:plc:a", plan: "pro", flags: JSON.stringify(flags), validUntil: null })
    const got = await getEntitlement(e, "did:plc:a", 1000)
    expect(got).toMatchObject({ maxConcurrentTasks: 3, maxWindows: 3, windowRange: [360, 1380] })
  })

  test("platform/AC-10: 資格が登録されていないユーザーは同時進行数が1の無料フラグで扱われる", async () => {
    expect(await getEntitlement(e, "did:plc:none", 1000)).toEqual(FREE_FLAGS)
    expect(FREE_FLAGS.maxConcurrentTasks).toBe(1)
  })

  test("期限切れは無料フラグ、壊れた flags は無料フラグと警告", async () => {
    const store = createStore(e)
    await store.entitlements.put({ did: "did:plc:old", plan: "pro", flags: JSON.stringify(flags), validUntil: 500 })
    expect(await getEntitlement(e, "did:plc:old", 1000)).toEqual(FREE_FLAGS)
    await store.entitlements.put({ did: "did:plc:bad", plan: "pro", flags: "{oops", validUntil: null })
    await store.entitlements.put({ did: "did:plc:bad2", plan: "pro", flags: JSON.stringify({ maxConcurrentTasks: "3" }), validUntil: null })
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(await getEntitlement(e, "did:plc:bad", 1000)).toEqual(FREE_FLAGS)
    expect(await getEntitlement(e, "did:plc:bad2", 1000)).toEqual(FREE_FLAGS)
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })
})
