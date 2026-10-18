// Bot のセッションの取得と更新。成功した結果は必ず保存して再利用する
import type { Env } from "./env"
import { createStore } from "./store"

const PDS = "https://bsky.social"
const MARGIN_MS = 60_000 // 期限の直前のトークンは使わない

export type BotAgent = {
  did: string
  pds: string
  /** 認証つきで XRPC を呼ぶ */
  xrpc(
    method: "GET" | "POST",
    nsid: string,
    opts?: { query?: Record<string, string>; body?: unknown },
  ): Promise<Response>
}

type Session = { accessJwt: string; refreshJwt: string; did: string }

const jwtExpiry = (jwt: string): number => {
  const payload = JSON.parse(atob((jwt.split(".")[1] ?? "").replaceAll("-", "+").replaceAll("_", "/")))
  return (payload.exp as number) * 1000
}

async function call(nsid: string, init: RequestInit & { token?: string }): Promise<Response> {
  const headers = new Headers(init.headers)
  if (init.token) headers.set("authorization", `Bearer ${init.token}`)
  return fetch(`${PDS}/xrpc/${nsid}`, { ...init, headers })
}

async function createSession(env: Env): Promise<Session> {
  const res = await call("com.atproto.server.createSession", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: env.BOT_HANDLE, password: env.BOT_APP_PASSWORD }),
  })
  if (!res.ok) throw new Error(`createSession failed (${res.status})`)
  return (await res.json()) as Session
}

async function refreshSession(refreshJwt: string): Promise<Session | null> {
  const res = await call("com.atproto.server.refreshSession", { method: "POST", token: refreshJwt })
  return res.ok ? ((await res.json()) as Session) : null
}

export async function getBotAgent(env: Env, now = Date.now()): Promise<BotAgent> {
  const store = createStore(env)
  const saved = await store.botSession.get()
  let accessJwt: string | null = saved && saved.expiresAt > now + MARGIN_MS ? saved.accessJwt : null
  if (!accessJwt) {
    let session: Session | null = null
    if (saved && jwtExpiry(saved.refreshJwt) > now + MARGIN_MS) session = await refreshSession(saved.refreshJwt)
    session ??= await createSession(env)
    accessJwt = session.accessJwt
    await store.botSession.put({
      accessJwt: session.accessJwt,
      refreshJwt: session.refreshJwt,
      expiresAt: jwtExpiry(session.accessJwt),
    })
  }
  const token = accessJwt
  return {
    did: env.BOT_DID,
    pds: PDS,
    xrpc(method, nsid, opts = {}) {
      const url = new URL(`${PDS}/xrpc/${nsid}`)
      for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v)
      return fetch(url, {
        method,
        headers: { authorization: `Bearer ${token}`, ...(opts.body ? { "content-type": "application/json" } : {}) },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      })
    },
  }
}
