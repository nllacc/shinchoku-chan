import { jsonToLex } from "@atproto/lex-json"
import * as dagCbor from "@ipld/dag-cbor"
import { CID } from "multiformats/cid"
import { sha256 } from "multiformats/hashes/sha2"
import * as Lex from "@atproto/lexicon"

interface Env { DB: D1Database }

const NS = "com.example.shinchoku"
const OAUTH_SCOPE = `atproto repo:${NS}.task?action=create repo:${NS}.progress?action=create repo:${NS}.result?action=create repo:app.bsky.feed.post?action=create blob:image/*`

// OAuth 検証ページが送ってきた結果（PoC のためメモリに保持する）
let lastReport: unknown = null

async function resolvePds(did: string): Promise<string> {
  const url = did.startsWith("did:web:")
    ? `https://${did.slice(8)}/.well-known/did.json`
    : `https://plc.directory/${did}`
  const doc: any = await (await fetch(url)).json()
  return doc.service.find((s: any) => s.id === "#atproto_pds").serviceEndpoint
}

async function cidOf(record: unknown): Promise<string> {
  const bytes = dagCbor.encode(jsonToLex(record as any))
  const hash = await sha256.digest(bytes)
  return CID.createV1(dagCbor.code, hash).toString()
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const u = new URL(req.url)
    if (u.pathname === "/verify") {
      const [, , did, col, rkey] = u.searchParams.get("uri")!.split("/")
      const t0 = Date.now()
      const pds = await resolvePds(did)
      const t1 = Date.now()
      const r: any = await (await fetch(`${pds}/xrpc/com.atproto.repo.getRecord?repo=${did}&collection=${col}&rkey=${rkey}`)).json()
      const t2 = Date.now()
      const cid = await cidOf(r.value)
      const t3 = Date.now()
      return Response.json({ pds, serverCid: r.cid, localCid: cid, match: cid === r.cid, ms: { resolve: t1 - t0, getRecord: t2 - t1, cid: t3 - t2 } })
    }
    if (u.pathname === "/client-metadata.json") {
      // 公開オリジン用の OAuth クライアント情報（web/app.js の SCOPE と同じ値）
      return Response.json({
        client_id: `${u.origin}/client-metadata.json`,
        client_name: "shinchoku-chan PoC",
        client_uri: u.origin,
        redirect_uris: [`${u.origin}/`],
        scope: OAUTH_SCOPE,
        response_types: ["code"],
        grant_types: ["authorization_code", "refresh_token"],
        token_endpoint_auth_method: "none",
        application_type: "web",
        dpop_bound_access_tokens: true,
      })
    }
    if (u.pathname === "/subreq") {
      // 外部通信（subrequest）を n 回まで呼べるか測る
      const n = Number(u.searchParams.get("n") ?? 60)
      let ok = 0, error = ""
      for (let i = 0; i < n; i++) {
        try { const r = await fetch("https://bsky.social/xrpc/com.atproto.server.describeServer"); await r.arrayBuffer(); ok++ } catch (e) { error = String(e); break }
      }
      return Response.json({ n, ok, error })
    }
    if (u.pathname === "/d1loop") {
      // D1 のクエリを n 回まで呼べるか測る
      const n = Number(u.searchParams.get("n") ?? 60)
      let ok = 0, error = ""
      for (let i = 0; i < n; i++) {
        try { await env.DB.prepare("SELECT 1").first(); ok++ } catch (e) { error = String(e); break }
      }
      return Response.json({ n, ok, error })
    }
    if (u.pathname === "/report") {
      if (req.method === "POST") lastReport = await req.json()
      return Response.json(lastReport)
    }
    if (u.pathname === "/cpu") {
      // 取得済みレコードに対するCPU負荷のみを測る（ネットワークなし）
      const rec = { $type: "com.example.shinchoku.progress", task: { uri: "at://did:plc:abc/x/y", cid: "bafyreib2rxk3rybk3aobmv5cjuql3bm2twh4jeyxlwbgsaakkjldxbtlwa" }, value: 1250, note: "x".repeat(140), createdAt: new Date().toISOString() }
      const n = Number(u.searchParams.get("n") ?? 200)
      let c = ""
      for (let i = 0; i < n; i++) c = await cidOf({ ...rec, value: i })
      return Response.json({ n, last: c })
    }
    if (u.pathname === "/d1") {
      await env.DB.exec("CREATE TABLE IF NOT EXISTS t(id INTEGER PRIMARY KEY, v TEXT)")
      await env.DB.prepare("INSERT INTO t(v) VALUES (?)").bind("a").run()
      const r = await env.DB.prepare("SELECT count(*) c FROM t").first()
      return Response.json(r)
    }
    return new Response("ok")
  },
  async scheduled(_e: ScheduledController, _env: Env) {
    console.log("tick", new Date().toISOString())
  },
}
