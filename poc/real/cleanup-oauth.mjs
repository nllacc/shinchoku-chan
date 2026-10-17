// OAuth 検証ページが作成したレコードを、アプリパスワードのセッションで削除する
// 実行: node --env-file=.env poc/real/cleanup-oauth.mjs
const PDS = "https://bsky.social"
const WORKER = process.env.WORKER_URL ?? "http://127.0.0.1:8787"
const report = await (await fetch(`${WORKER}/report`)).json()
if (!report?.created?.length) { console.log("削除対象なし"); process.exit(0) }
const s = await (await fetch(`${PDS}/xrpc/com.atproto.server.createSession`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ identifier: process.env.SKYSHARE_E2E_IDENTIFIER, password: process.env.SKYSHARE_E2E_APP_PASSWORD }),
})).json()
if (s.did !== report.did) throw new Error(`DID が一致しない: ${s.did} / ${report.did}`)
for (const uri of report.created) {
  const [, , repo, collection, rkey] = uri.split("/")
  const r = await fetch(`${PDS}/xrpc/com.atproto.repo.deleteRecord`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${s.accessJwt}` },
    body: JSON.stringify({ repo, collection, rkey }),
  })
  console.log(r.status, uri)
}
