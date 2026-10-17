// 実アカウントでの追加検証（通知・スレッド・facet・セッション・冪等性・受理時刻・改変検出・制限ヘッダ）
// 実行: node --env-file=.env poc/real/probe.mjs
// 作成したレコード・投稿は最後に削除する
const PDS = "https://bsky.social"
const APPVIEW = "https://public.api.bsky.app"
const NS = "com.example.shinchoku"
const env = process.env
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (k, v) => console.log(`${k.padEnd(34)}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
let failed = false
const check = (name, ok, detail) => { log(`${ok ? "合" : "否"} ${name}`, detail ?? ""); if (!ok) failed = true }

const b64 = (s) => JSON.parse(Buffer.from(s.split(".")[1], "base64url").toString())
async function req(method, nsid, { sess, body, query, base = PDS } = {}) {
  const u = new URL(`${base}/xrpc/${nsid}`)
  for (const [k, v] of Object.entries(query ?? {})) u.searchParams.set(k, v)
  const r = await fetch(u, {
    method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...(sess ? { authorization: `Bearer ${sess.jwt}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  let json; try { json = JSON.parse(text) } catch {}
  const rl = Object.fromEntries([...r.headers].filter(([k]) => k.startsWith("ratelimit")))
  return { status: r.status, json, text, rl }
}
async function login(id, pw) {
  const r = await req("POST", "com.atproto.server.createSession", { body: { identifier: id, password: pw } })
  if (r.status !== 200) throw new Error(`login ${id}: ${r.text}`)
  return { did: r.json.did, jwt: r.json.accessJwt, refresh: r.json.refreshJwt, rl: r.rl }
}

const created = []
const now = () => new Date().toISOString()
async function create(sess, collection, record, rkey) {
  const r = await req("POST", "com.atproto.repo.createRecord", { sess, body: { repo: sess.did, collection, rkey, validate: false, record: { $type: collection, ...record } } })
  if (r.status !== 200) return r
  created.push({ sess, collection, rkey: r.json.uri.split("/").pop() })
  return r
}
const must = (r) => { if (r.status !== 200) throw new Error(r.text); return r.json }
// TID（コミットの rev）を時刻へ変換する
const tidToMs = (rev) => { const A = "234567abcdefghijklmnopqrstuvwxyz"; let n = 0n; for (const c of rev) n = n * 32n + BigInt(A.indexOf(c)); return Number((n >> 10n) / 1000n) }

const user = await login(env.SKYSHARE_E2E_IDENTIFIER, env.SKYSHARE_E2E_APP_PASSWORD)
const bot = await login(env.BOT_APP_IDENTIFIER, env.BOT_APP_PASSWORD)

try {
  // ---- A5: セッション運用 ----
  const at = b64(bot.jwt), rt = b64(bot.refresh)
  log("A5 createSession の制限ヘッダ", bot.rl)
  log("A5 accessJwt の有効期間(分)", Math.round((at.exp - at.iat) / 60))
  log("A5 refreshJwt の有効期間(日)", Math.round((rt.exp - rt.iat) / 86400))
  const rr = await req("POST", "com.atproto.server.refreshSession", { sess: { jwt: bot.refresh } })
  check("A5 refreshJwt でセッションを更新できる", rr.status === 200 && !!rr.json?.accessJwt, rr.status)
  log("A5 refreshSession の制限ヘッダ", rr.rl)
  if (rr.json?.accessJwt) { bot.jwt = rr.json.accessJwt; bot.refresh = rr.json.refreshJwt }
  const old = await req("POST", "com.atproto.server.refreshSession", { sess: { jwt: rt && rr.json ? "x" : bot.refresh } })
  log("A5 不正トークンでの更新", old.status)

  // ---- A2: 通知 ----
  const root = must(await create(user, "app.bsky.feed.post", { text: "[shinchoku-chan 検証] 起点投稿（削除されます）", createdAt: now() }))
  // ---- A4: facet（日本語文面のバイト位置）----
  const url = "https://shinchoku-poc.nlla.workers.dev/checkin/abc123"
  const head = "進捗を教えてください！30分以内にこちらから → "
  const text = head + url + " 🙏"
  const enc = new TextEncoder()
  const byteStart = enc.encode(head).length
  const facets = [{ index: { byteStart, byteEnd: byteStart + enc.encode(url).length }, features: [{ $type: "app.bsky.richtext.facet#link", uri: url }] }]
  const reply = (parent) => ({ text, facets, createdAt: now(), reply: { root: { uri: root.uri, cid: root.cid }, parent: { uri: parent.uri, cid: parent.cid } } })
  const r1 = must(await create(bot, "app.bsky.feed.post", reply(root)))
  // ---- A3: スレッドの連結 ----
  const r2 = must(await create(bot, "app.bsky.feed.post", reply(r1)))
  const r3 = must(await create(bot, "app.bsky.feed.post", reply(r2)))
  let notif
  for (let i = 0; i < 10 && !notif; i++) {
    await sleep(2000)
    const n = await req("GET", "app.bsky.notification.listNotifications", { sess: user, query: { limit: "20" } })
    notif = n.json?.notifications?.filter((x) => x.author.did === bot.did && x.reason === "reply")
    if (!notif?.length) notif = undefined
  }
  check("A2 Bot の返信がユーザーに通知として届く", !!notif, notif ? `${notif.length} 件` : "届かない（20秒待機）")
  let thread
  for (let i = 0; i < 5; i++) {
    thread = await req("GET", "app.bsky.feed.getPostThread", { base: APPVIEW, query: { uri: root.uri, depth: "10" } })
    if (thread.json?.thread?.replies?.[0]?.replies?.[0]?.replies?.[0]) break
    await sleep(2000)
  }
  log("A3 getPostThread", thread.status)
  const t1 = thread.json?.thread?.replies?.[0], t3 = t1?.replies?.[0]?.replies?.[0]
  check("A3 返信が root→r1→r2→r3 の1スレッドに連なる", t1?.post?.uri === r1.uri && t3?.post?.uri === r3.uri)
  const rec = t1?.post?.record
  check("A4 AppView が日本語文面の link facet を保持", rec?.facets?.[0]?.index?.byteStart === byteStart && rec.facets[0].features[0].uri === url, `byteStart=${byteStart}`)
  const sliced = Buffer.from(enc.encode(rec?.text ?? "")).subarray(rec?.facets?.[0]?.index?.byteStart, rec?.facets?.[0]?.index?.byteEnd).toString()
  check("A4 facet の範囲が URL と一致する", sliced === url, sliced)

  // ---- B1: 同じ rkey の二重作成 ----
  const task = must(await create(user, `${NS}.task`, { summary: "検証", createdAt: now() }))
  const chk = must(await create(bot, `${NS}.bot.checkin`, { task, createdAt: now() }))
  const rkey = chk.uri.split("/").pop()
  const [x, y] = await Promise.all([1, 2].map((i) => create(bot, `${NS}.bot.receipt`, { n: i, createdAt: now() }, rkey)))
  const ok = [x, y].filter((r) => r.status === 200).length
  check("B1 同じ rkey の並列作成は1件だけ成功", ok === 1, `${x.status}/${y.status} ${[x, y].find((r) => r.status !== 200)?.text?.slice(0, 120)}`)
  const z = await create(bot, `${NS}.bot.receipt`, { n: 3, createdAt: now() }, rkey)
  check("B1 作成済みの rkey への再作成は拒否", z.status !== 200, `${z.status} ${z.text.slice(0, 120)}`)
  const put = await req("POST", "com.atproto.repo.putRecord", { sess: bot, body: { repo: bot.did, collection: `${NS}.bot.receipt`, rkey, swapRecord: null, validate: false, record: { $type: `${NS}.bot.receipt`, n: 4, createdAt: now() } } })
  check("B1 putRecord(swapRecord=null) も作成済みなら拒否", put.status !== 200, `${put.status} ${put.text.slice(0, 120)}`)

  // ---- B2: 受理時刻 ----
  const t0 = Date.now()
  const prog = must(await create(user, `${NS}.progress`, { task, checkin: chk, value: 1, createdAt: "2000-01-01T00:00:00.000Z" }))
  const t1m = Date.now()
  const back = await req("GET", "com.atproto.repo.getRecord", { query: { repo: user.did, collection: `${NS}.progress`, rkey: prog.uri.split("/").pop() } })
  const t2m = Date.now()
  check("B2 書き込み直後に公開APIで取得できる", back.status === 200 && back.json.cid === prog.cid, `${t2m - t1m}ms`)
  const revMs = tidToMs(prog.commit.rev)
  log("B2 commit.rev の時刻と実時刻の差(ms)", { fromStart: revMs - t0, fromEnd: revMs - t1m })
  check("B2 createdAt は詐称できるが rev は実時刻に近い", back.json.value.createdAt === "2000-01-01T00:00:00.000Z" && Math.abs(revMs - t1m) < 5000)

  // ---- B3: 受理後の改変・削除の検出 ----
  const recKey = prog.uri.split("/").pop()
  const upd = await req("POST", "com.atproto.repo.putRecord", { sess: user, body: { repo: user.did, collection: `${NS}.progress`, rkey: recKey, validate: false, record: { $type: `${NS}.progress`, task, checkin: chk, value: 999, createdAt: now() } } })
  const after = await req("GET", "com.atproto.repo.getRecord", { query: { repo: user.did, collection: `${NS}.progress`, rkey: recKey } })
  check("B3 更新すると CID が変わり検出できる", upd.status === 200 && after.json.cid !== prog.cid, `${prog.cid.slice(-8)} → ${after.json?.cid?.slice(-8)}`)
  await req("POST", "com.atproto.repo.deleteRecord", { sess: user, body: { repo: user.did, collection: `${NS}.progress`, rkey: recKey } })
  const gone = await req("GET", "com.atproto.repo.getRecord", { query: { repo: user.did, collection: `${NS}.progress`, rkey: recKey } })
  check("B3 削除すると取得できず検出できる", gone.status === 400 && /RecordNotFound/.test(gone.text), gone.text.slice(0, 100))

  // ---- D1: 書き込みの制限ヘッダ ----
  const w = await create(bot, `${NS}.bot.checkin`, { task, createdAt: now() })
  log("D1 createRecord の制限ヘッダ", w.rl)
  const lim = await req("GET", "com.atproto.repo.listRecords", { query: { repo: bot.did, collection: `${NS}.bot.checkin`, limit: "100" } })
  log("D1 listRecords の制限ヘッダ", lim.rl)
} catch (e) {
  failed = true
  console.error("検証中のエラー:", e)
} finally {
  for (const c of created.reverse()) {
    const r = await req("POST", "com.atproto.repo.deleteRecord", { sess: c.sess, body: { repo: c.sess.did, collection: c.collection, rkey: c.rkey } })
    if (r.status !== 200 && !/RecordNotFound/.test(r.text)) { failed = true; console.error("削除失敗", c.collection, c.rkey, r.text) }
  }
  log("後始末", `${created.length} 件`)
}
process.exit(failed ? 1 : 0)
