import { env } from "cloudflare:workers"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { getBotAgent } from "../../src/platform/botSession"
import type { Env } from "../../src/platform/env"
import { createStore } from "../../src/platform/store"

const e = { ...env, BOT_DID: "did:plc:bot", BOT_HANDLE: "bot.test", BOT_APP_PASSWORD: "pw" } as unknown as Env
const jwt = (expSec: number) => `h.${btoa(JSON.stringify({ exp: expSec })).replaceAll("=", "")}.s`
const NOW = 1_800_000_000_000
const H = 3_600_000

let calls: string[]
const stubFetch = (handlers: Record<string, () => Response>) =>
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const nsid = new URL(String(input)).pathname.split("/").pop() as string
    calls.push(nsid)
    return (handlers[nsid] ?? (() => new Response("no", { status: 500 })))()
  })

beforeEach(async () => {
  calls = []
  await env.DB.prepare("DELETE FROM bot_session").run()
})
afterEach(() => vi.unstubAllGlobals())

describe("botSession", () => {
  test("platform/AC-8: 有効なセッションがあれば再認証せず、期限が切れていれば更新する", async () => {
    const store = createStore(e)
    stubFetch({})
    await store.botSession.put({ accessJwt: jwt((NOW + 2 * H) / 1000), refreshJwt: jwt((NOW + 90 * 24 * H) / 1000), expiresAt: NOW + 2 * H })
    await getBotAgent(e, NOW)
    expect(calls).toEqual([])

    stubFetch({
      "com.atproto.server.refreshSession": () =>
        Response.json({ did: "did:plc:bot", accessJwt: jwt((NOW + 5 * H) / 1000), refreshJwt: jwt((NOW + 91 * 24 * H) / 1000) }),
    })
    await getBotAgent(e, NOW + 3 * H)
    expect(calls).toEqual(["com.atproto.server.refreshSession"])
    const saved = await store.botSession.get()
    expect(saved?.expiresAt).toBe(NOW + 5 * H)
  })

  test("保存がなければ createSession を呼んで保存し、次回は再利用する", async () => {
    stubFetch({
      "com.atproto.server.createSession": () =>
        Response.json({ did: "did:plc:bot", accessJwt: jwt((NOW + 2 * H) / 1000), refreshJwt: jwt((NOW + 90 * 24 * H) / 1000) }),
    })
    await getBotAgent(e, NOW)
    await getBotAgent(e, NOW + H)
    expect(calls).toEqual(["com.atproto.server.createSession"])
  })

  test("refreshJwt が期限切れ、または更新に失敗したら createSession を呼ぶ", async () => {
    const store = createStore(e)
    await store.botSession.put({ accessJwt: jwt(1), refreshJwt: jwt((NOW - H) / 1000), expiresAt: NOW - 2 * H })
    stubFetch({
      "com.atproto.server.createSession": () =>
        Response.json({ did: "did:plc:bot", accessJwt: jwt((NOW + 2 * H) / 1000), refreshJwt: jwt((NOW + 90 * 24 * H) / 1000) }),
    })
    await getBotAgent(e, NOW)
    expect(calls).toEqual(["com.atproto.server.createSession"])

    calls = []
    await store.botSession.put({ accessJwt: jwt(1), refreshJwt: jwt((NOW + 90 * 24 * H) / 1000), expiresAt: NOW - H })
    stubFetch({
      "com.atproto.server.refreshSession": () => new Response("expired", { status: 400 }),
      "com.atproto.server.createSession": () =>
        Response.json({ did: "did:plc:bot", accessJwt: jwt((NOW + 3 * H) / 1000), refreshJwt: jwt((NOW + 90 * 24 * H) / 1000) }),
    })
    await getBotAgent(e, NOW)
    expect(calls).toEqual(["com.atproto.server.refreshSession", "com.atproto.server.createSession"])
  })

  test("認証に失敗すると例外を投げる", async () => {
    stubFetch({ "com.atproto.server.createSession": () => new Response("no", { status: 401 }) })
    await expect(getBotAgent(e, NOW)).rejects.toThrow("createSession failed")
  })
})
