// 試験用の模擬ネットワーク。DID ディレクトリ・ユーザーの PDS・Bot の PDS を1つの fetch で再現する
import { env } from "cloudflare:workers"
import { vi } from "vitest"
import type { Env } from "../../src/platform/env"
import { cidOf } from "../../src/platform/pds"
import { createStore } from "../../src/platform/store"
import { NSID } from "../../src/lexicon/nsid"
import { at, ref, task as taskFixture } from "../lexicon/fixtures"
import type { TaskRecord } from "../../src/lexicon/types"

export const BOT_DID = "did:plc:botbotbotbotbotbotbotbot"
export const USER_DID = "did:plc:aaaaaaaaaaaaaaaaaaaaaaaa"
export const USER_PDS = "https://pds.user.test"
export const testEnv = { ...env, BOT_DID, BOT_HANDLE: "bot.test", BOT_APP_PASSWORD: "pw", RKEY_SECRET: "test-secret", ADMIN_TOKEN: "t" } as unknown as Env

export type Stored = { value: Record<string, any>; cid: string }

export class FakeNet {
  repos = new Map<string, Map<string, Stored>>()
  blobs = new Set<string>()
  calls: string[] = []
  /** 取得時に別の CID を返す URI(CID が内容と一致しない状況) */
  wrongCid = new Set<string>()
  /** 到達できない PDS のホスト */
  down = new Set<string>()
  private n = 0

  private repo(did: string) {
    if (!this.repos.has(did)) this.repos.set(did, new Map())
    return this.repos.get(did)!
  }

  async put(did: string, collection: string, rkey: string, value: Record<string, any>): Promise<{ uri: string; cid: string }> {
    const cid = await cidOf(value)
    this.repo(did).set(`${collection}/${rkey}`, { value, cid })
    return { uri: `at://${did}/${collection}/${rkey}`, cid }
  }

  get(did: string, collection: string, rkey: string) {
    return this.repos.get(did)?.get(`${collection}/${rkey}`)
  }

  list(did: string, collection: string) {
    return [...(this.repos.get(did)?.entries() ?? [])].filter(([k]) => k.startsWith(`${collection}/`)).map(([, v]) => v)
  }

  remove(did: string, collection: string, rkey: string) {
    this.repos.get(did)?.delete(`${collection}/${rkey}`)
  }

  install() {
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => this.handle(input, init))
  }

  private async handle(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = new URL(String(input instanceof Request ? input.url : input))
    const method = (init?.method ?? "GET").toUpperCase()
    this.calls.push(`${method} ${url.host}${url.pathname}`)
    if (this.down.has(url.origin)) throw new TypeError("network down")
    if (url.host === "plc.directory") {
      const did = decodeURIComponent(url.pathname.slice(1))
      return Response.json({
        alsoKnownAs: [`at://${did === BOT_DID ? "bot.test" : "user.test"}`],
        service: [{ id: "#atproto_pds", serviceEndpoint: did === BOT_DID ? "https://bsky.social" : USER_PDS }],
      })
    }
    const nsid = url.pathname.split("/").pop()
    if (nsid === "com.atproto.repo.getRecord") {
      const s = this.get(url.searchParams.get("repo")!, url.searchParams.get("collection")!, url.searchParams.get("rkey")!)
      if (!s) return Response.json({ error: "RecordNotFound" }, { status: 400 })
      const uri = `at://${url.searchParams.get("repo")}/${url.searchParams.get("collection")}/${url.searchParams.get("rkey")}`
      return Response.json({ uri, cid: this.wrongCid.has(uri) ? await cidOf({ other: 1 }) : s.cid, value: s.value })
    }
    if (nsid === "com.atproto.sync.getBlob") {
      return this.blobs.has(url.searchParams.get("cid")!) ? new Response(null, { status: 200 }) : new Response("no", { status: 404 })
    }
    const body = init?.body ? JSON.parse(String(init.body)) : {}
    if (nsid === "com.atproto.repo.putRecord") {
      if (this.get(body.repo, body.collection, body.rkey)) return Response.json({ error: "InvalidSwap" }, { status: 400 })
      return Response.json(await this.put(body.repo, body.collection, body.rkey, body.record))
    }
    if (nsid === "com.atproto.repo.createRecord") {
      return Response.json(await this.put(body.repo, body.collection, `3k${String(++this.n).padStart(11, "0")}`, body.record))
    }
    return new Response("unhandled", { status: 500 })
  }
}

export async function resetDb() {
  for (const t of ["tasks", "open_checkins", "reports", "evaluations", "bot_session", "entitlements"]) await env.DB.prepare(`DELETE FROM ${t}`).run()
  const exp = Date.now() + 24 * 3_600_000
  await createStore(testEnv).botSession.put({ accessJwt: "access", refreshJwt: "refresh", expiresAt: exp })
}

/** 起点投稿(Bot へのメンション付き)と作業レコードをユーザーのリポジトリに置く */
export async function seedTask(
  net: FakeNet,
  over: Partial<TaskRecord> = {},
  opts: { mention?: boolean; rkey?: string } = {},
): Promise<{ taskUri: string; taskCid: string; task: TaskRecord }> {
  const mention = opts.mention ?? true
  const post = await net.put(USER_DID, "app.bsky.feed.post", `3post${Math.random().toString(36).slice(2, 10)}`, {
    $type: "app.bsky.feed.post",
    text: "@bot 始めます",
    createdAt: at,
    facets: mention ? [{ index: { byteStart: 0, byteEnd: 4 }, features: [{ $type: "app.bsky.richtext.facet#mention", did: BOT_DID }] }] : [],
  })
  const task = { ...taskFixture({ anchor: { uri: post.uri, cid: post.cid }, ...over }) }
  const rkey = opts.rkey ?? `3task${Math.random().toString(36).slice(2, 10)}`
  const stored = await net.put(USER_DID, NSID.task, rkey, { $type: NSID.task, ...task })
  return { taskUri: stored.uri, taskCid: stored.cid, task }
}
export { ref }
