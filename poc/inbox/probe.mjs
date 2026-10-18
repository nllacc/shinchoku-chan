// Bot が通知からメンションと返信を受け取れるかの検証
// 実行: node --env-file=.env poc/inbox/probe.mjs
// 作成した投稿は最後に削除する
const PDS = "https://bsky.social"
const env = process.env
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const enc = new TextEncoder()
let failed = false
const log = (k, v) => console.log(`${k.padEnd(38)}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
const check = (name, ok, detail) => { log(`${ok ? "合" : "否"} ${name}`, detail ?? ""); if (!ok) failed = true }

async function req(method, nsid, { sess, body, query } = {}) {
  const u = new URL(`${PDS}/xrpc/${nsid}`)
  for (const [k, v] of Object.entries(query ?? {})) {
    for (const x of [].concat(v)) u.searchParams.append(k, x)
  }
  const r = await fetch(u, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(sess ? { authorization: `Bearer ${sess.jwt}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  let json; try { json = JSON.parse(text) } catch {}
  return { status: r.status, json, text }
}
async function login(id, pw) {
  const r = await req("POST", "com.atproto.server.createSession", { body: { identifier: id, password: pw } })
  if (r.status !== 200) throw new Error(`login ${id}: ${r.text}`)
  return { did: r.json.did, jwt: r.json.accessJwt, handle: r.json.handle }
}

const created = []
async function post(sess, text, { reply, mentionDid, mentionText } = {}) {
  const record = { $type: "app.bsky.feed.post", text, createdAt: new Date().toISOString(), langs: ["ja"] }
  if (mentionDid) {
    const byteStart = enc.encode(text.slice(0, text.indexOf(mentionText))).length
    const byteEnd = byteStart + enc.encode(mentionText).length
    record.facets = [{ index: { byteStart, byteEnd }, features: [{ $type: "app.bsky.richtext.facet#mention", did: mentionDid }] }]
  }
  if (reply) record.reply = reply
  const r = await req("POST", "com.atproto.repo.createRecord", { sess, body: { repo: sess.did, collection: "app.bsky.feed.post", record } })
  if (r.status !== 200) throw new Error(r.text)
  created.push({ sess, rkey: r.json.uri.split("/").pop() })
  return r.json
}
// 条件を満たす通知が現れるまで 1 秒おきに取得する。現れるまでの秒数を返す
async function waitNotif(sess, pred, limit = 60) {
  const t0 = Date.now()
  while ((Date.now() - t0) / 1000 < limit) {
    const r = await req("GET", "app.bsky.notification.listNotifications", {
      sess, query: { limit: 30, reasons: ["mention", "reply"] },
    })
    const hit = r.json?.notifications?.find(pred)
    if (hit) return { hit, sec: (Date.now() - t0) / 1000, all: r.json.notifications }
    await sleep(1000)
  }
  return null
}

const user = await login(env.SKYSHARE_E2E_IDENTIFIER, env.SKYSHARE_E2E_APP_PASSWORD)
const bot = await login(env.BOT_APP_IDENTIFIER, env.BOT_APP_PASSWORD)
const tag = `probe-${Date.now()}`

try {
  // 1. ユーザーが Bot をメンションして投稿する
  const text1 = `@${bot.handle} 10/25まで 18時に 資料作成 ${tag}`
  const p1 = await post(user, text1, { mentionDid: bot.did, mentionText: `@${bot.handle}` })
  const n1 = await waitNotif(bot, (n) => n.uri === p1.uri)
  check("H1 メンション投稿が reason=mention で届く", n1?.hit.reason === "mention", n1?.hit.reason)
  log("H2 メンションが届くまでの秒数", n1?.sec)
  check("H3 通知から本文とDIDと日時を取れる", n1?.hit.record.text === text1 && n1?.hit.author.did === user.did && !!n1?.hit.indexedAt)
  check("H4 本文のメンション facet が Bot の DID を指す", n1?.hit.record.facets?.[0]?.features?.[0]?.did === bot.did)
  check("H5 reasons の絞り込みで mention・reply 以外が混じらない", n1?.all.every((n) => ["mention", "reply"].includes(n.reason)), [...new Set(n1?.all.map((n) => n.reason))])

  // 2. Bot がユーザーをメンションして返信する（リマインド/評価依頼）
  const root = { uri: p1.uri, cid: p1.cid }
  const text2 = `@${user.handle} 資料作成はどうですか? ${tag}`
  const p2 = await post(bot, text2, { reply: { root, parent: root }, mentionDid: user.did, mentionText: `@${user.handle}` })
  const n2 = await waitNotif(user, (n) => n.uri === p2.uri)
  check("H6 Bot の返信がユーザーに届く", !!n2, n2?.hit.reason)

  // 3. ユーザーが Bot の投稿へ返信して評価する
  const text3 = `できた! ${tag}`
  const p3 = await post(user, text3, { reply: { root, parent: { uri: p2.uri, cid: p2.cid } } })
  const n3 = await waitNotif(bot, (n) => n.uri === p3.uri)
  check("H7 評価の返信が reason=reply で届く", n3?.hit.reason === "reply", n3?.hit.reason)
  log("H8 返信が届くまでの秒数", n3?.sec)
  check("H9 返信の親が Bot の投稿を指し対象を特定できる", n3?.hit.record.reply?.parent.uri === p2.uri && n3?.hit.record.reply?.root.uri === p1.uri)

  // 4. 取得位置: indexedAt の新しい順で並ぶ（checkpoint に使える）
  const ts = n3?.all.map((n) => n.indexedAt) ?? []
  check("H10 indexedAt の降順で並ぶ", ts.every((t, i) => i === 0 || ts[i - 1] >= t))
} finally {
  for (const c of created) {
    await req("POST", "com.atproto.repo.deleteRecord", { sess: c.sess, body: { repo: c.sess.did, collection: "app.bsky.feed.post", rkey: c.rkey } })
  }
  log("後始末", `${created.length} 件の投稿を削除`)
}
process.exit(failed ? 1 : 0)
