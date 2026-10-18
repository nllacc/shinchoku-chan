import { beforeEach, describe, expect, test, vi } from "vitest"
import type { Env } from "../../src/platform/env"
import { registerTick, resetTicks, runTick } from "../../src/worker/tick"

const env = {} as Env

describe("tick", () => {
  beforeEach(resetTicks)

  test("platform/AC-2: 登録した3つの処理が登録順に1回ずつ呼び出される", async () => {
    const order: string[] = []
    for (const name of ["a", "b", "c"]) registerTick({ name, run: async () => void order.push(name) })
    const results = await runTick(0, env)
    expect(order).toEqual(["a", "b", "c"])
    expect(results.map((r) => r.ok)).toEqual([true, true, true])
  })

  test("platform/AC-3: 2つ目の処理が失敗しても3つ目が実行され、失敗が記録される", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    const ran: string[] = []
    registerTick({ name: "a", run: async () => void ran.push("a") })
    registerTick({ name: "b", run: async () => { throw new Error("boom") } })
    registerTick({ name: "c", run: async () => void ran.push("c") })
    const results = await runTick(0, env)
    expect(ran).toEqual(["a", "c"])
    expect(results[1]).toMatchObject({ name: "b", ok: false, error: "boom" })
    expect(err).toHaveBeenCalledOnce()
    err.mockRestore()
  })

  test("platform/AC-20: 処理が空の定期実行を100回行っても1回あたり5ミリ秒以下である", async () => {
    // 試験の実行環境の時計は粗いため、ここでは基盤の処理に重い処理がないことを確かめる。実機の CPU 時間は PoC で測定した
    const t0 = Date.now()
    for (let i = 0; i < 100; i++) await runTick(i, env)
    expect((Date.now() - t0) / 100).toBeLessThanOrEqual(5)
  })

  test("platform/AC-21: 処理が空の定期実行は保存先から行を読まない", async () => {
    const calls: string[] = []
    const guarded = new Proxy({}, { get: (_t, p) => (calls.push(String(p)), undefined) }) as unknown as Env
    await runTick(0, guarded)
    expect(calls.filter((c) => c === "DB")).toEqual([])
  })
})
