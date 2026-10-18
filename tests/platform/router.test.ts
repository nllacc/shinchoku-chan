import { describe, expect, test } from "vitest"
import type { Env } from "../../src/platform/env"
import { route, type Route } from "../../src/worker/router"

const assets = { fetch: async () => new Response("asset") } as unknown as Fetcher
const env = { ASSETS: assets } as unknown as Env
const hello: Route = {
  method: "GET",
  path: "/api/hello",
  handler: async () => Response.json({ ok: true }),
}

describe("router", () => {
  test("platform/AC-1: APIの経路は handler、それ以外は静的アセットで処理される", async () => {
    const api = await route(new Request("https://x/api/hello"), env, [hello])
    expect(await api.json()).toEqual({ ok: true })
    const asset = await route(new Request("https://x/index.html"), env, [hello])
    expect(await asset.text()).toBe("asset")
  })

  test("platform/AC-19: 存在しないAPIのパスは共通形式のエラーで返る", async () => {
    const res = await route(new Request("https://x/api/nothing"), env, [hello])
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({
      error: { kind: "not-found", message: expect.any(String), retryable: false },
    })
  })

  test("メソッドが違う経路は 404", async () => {
    const res = await route(new Request("https://x/api/hello", { method: "POST" }), env, [hello])
    expect(res.status).toBe(404)
  })

  test("handler が例外を投げると retryable な 500 を返す", async () => {
    const boom: Route = { method: "GET", path: "/api/boom", handler: async () => { throw new Error("x") } }
    const res = await route(new Request("https://x/api/boom"), env, [boom])
    expect(res.status).toBe(500)
    expect((await res.json() as { error: { retryable: boolean } }).error.retryable).toBe(true)
  })
})
