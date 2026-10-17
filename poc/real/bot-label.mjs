// Bot のプロフィールに自己ラベル "bot" を付け、AppView に反映されることを確かめる
// 実行: node --env-file=.env poc/real/bot-label.mjs
const PDS = "https://bsky.social"
const post = async (nsid, jwt, body) => (await fetch(`${PDS}/xrpc/${nsid}`, { method: "POST", headers: { "content-type": "application/json", ...(jwt ? { authorization: `Bearer ${jwt}` } : {}) }, body: JSON.stringify(body) })).json()
const s = await post("com.atproto.server.createSession", null, { identifier: process.env.BOT_APP_IDENTIFIER, password: process.env.BOT_APP_PASSWORD })
const cur = await (await fetch(`${PDS}/xrpc/com.atproto.repo.getRecord?repo=${s.did}&collection=app.bsky.actor.profile&rkey=self`)).json().catch(() => ({}))
const value = { ...(cur.value ?? {}), $type: "app.bsky.actor.profile", labels: { $type: "com.atproto.label.defs#selfLabels", values: [{ val: "bot" }] } }
const put = await post("com.atproto.repo.putRecord", s.accessJwt, { repo: s.did, collection: "app.bsky.actor.profile", rkey: "self", record: value, ...(cur.cid ? { swapRecord: cur.cid } : {}) })
console.log("putRecord:", put.error ?? "ok")
for (let i = 0; i < 8; i++) {
  await new Promise((r) => setTimeout(r, 2000))
  const p = await (await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${s.did}`)).json()
  const labels = (p.labels ?? []).map((l) => `${l.val}(src=${l.src === s.did ? "self" : l.src})`)
  console.log("AppView のラベル:", labels)
  if (labels.length) break
}
