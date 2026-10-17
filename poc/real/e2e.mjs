// 実アカウントを使った受理フローの検証スクリプト
// 実行: node --env-file=.env poc/real/e2e.mjs（先に npm run dev で Worker を起動しておく）
// 作成したレコード・投稿は、成功・失敗にかかわらず最後に削除する
const PDS = "https://bsky.social"
const WORKER = process.env.WORKER_URL ?? "http://127.0.0.1:8787"
const NS = "com.example.shinchoku"
const env = process.env

const log = (k, v) => console.log(`${k.padEnd(28)}: ${typeof v === "string" ? v : JSON.stringify(v)}`)

async function login(identifier, password) {
  const r = await fetch(`${PDS}/xrpc/com.atproto.server.createSession`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  })
  if (!r.ok) throw new Error(`login ${identifier}: ${r.status} ${await r.text()}`)
  const s = await r.json()
  return { did: s.did, handle: s.handle, jwt: s.accessJwt }
}

async function xrpc(sess, nsid, body) {
  const r = await fetch(`${PDS}/xrpc/${nsid}`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${sess.jwt}` },
    body: JSON.stringify(body),
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`${nsid}: ${r.status} ${t}`)
  return JSON.parse(t)
}

const created = [] // { sess, collection, rkey }
async function create(sess, collection, record) {
  const res = await xrpc(sess, "com.atproto.repo.createRecord", {
    repo: sess.did, collection, record: { $type: collection, ...record }, validate: false,
  })
  created.push({ sess, collection, rkey: res.uri.split("/").pop() })
  return res
}

const now = () => new Date().toISOString()
let failed = false
const check = (name, ok, detail) => { log(`${ok ? "合" : "否"} ${name}`, detail ?? ""); if (!ok) failed = true }

const user = await login(env.SKYSHARE_E2E_IDENTIFIER, env.SKYSHARE_E2E_APP_PASSWORD)
const bot = await login(env.BOT_APP_IDENTIFIER, env.BOT_APP_PASSWORD)
log("ユーザー", `${user.handle} ${user.did}`)
log("Bot", `${bot.handle} ${bot.did}`)

try {
  // 1. ユーザーが起点投稿を行う
  const root = await create(user, "app.bsky.feed.post", { text: "[shinchoku-chan 検証] 起点投稿（自動で削除されます）", createdAt: now() })
  log("起点投稿", root.uri)

  // 2. ユーザーが作業を宣言する（ユーザーの PDS）
  const task = await create(user, `${NS}.task`, { summary: "検証用の作業", createdAt: now() })
  log("作業", task.uri)

  // 3. Bot が起点投稿へ確認依頼の返信を行い、確認依頼レコードを作る（Bot の PDS）
  const reply = await create(bot, "app.bsky.feed.post", {
    text: "[shinchoku-chan 検証] 進捗を教えてください（自動で削除されます）", createdAt: now(),
    reply: { root: { uri: root.uri, cid: root.cid }, parent: { uri: root.uri, cid: root.cid } },
  })
  const request = await create(bot, `${NS}.bot.request`, { task: { uri: task.uri, cid: task.cid }, replyUri: reply.uri, createdAt: now() })
  log("確認依頼", request.uri)

  // 4. ユーザーが報告を作る。確認依頼と作業を参照する
  const progress = await create(user, `${NS}.progress`, {
    task: { uri: task.uri, cid: task.cid }, request: { uri: request.uri, cid: request.cid }, value: 500, createdAt: now(),
  })
  log("進捗報告", progress.uri)

  // 5. Worker がユーザーの PDS からレコードを取得して CID を照合する
  const v = await (await fetch(`${WORKER}/verify?uri=${encodeURIComponent(progress.uri)}`)).json()
  log("Worker 照合結果", v)
  check("Worker の CID が PDS と一致", v.match === true)
  check("Worker の CID が createRecord の CID と一致", v.localCid === progress.cid)

  // 6. 改ざん検知: 別 CID を期待値にした場合は不一致になる
  check("別レコードの CID とは不一致", v.localCid !== task.cid)

  // 7. Bot が受領証を作る
  const receipt = await create(bot, `${NS}.bot.receipt`, {
    progress: { uri: progress.uri, cid: progress.cid }, request: { uri: request.uri }, receivedAt: now(),
  })
  log("受領証", receipt.uri)

  // 8. 公開 API で全レコードを第三者として読み戻せる
  for (const rec of [root, task, reply, request, progress, receipt]) {
    const [, , did, col, rkey] = rec.uri.split("/")
    const r = await fetch(`${PDS}/xrpc/com.atproto.repo.getRecord?repo=${did}&collection=${col}&rkey=${rkey}`)
    const j = await r.json()
    check(`公開取得 ${col}`, r.ok && j.cid === rec.cid)
  }
} catch (e) {
  failed = true
  console.error("検証中のエラー:", e)
} finally {
  // 後始末: 作成の逆順で削除し、削除後に取得できないことを確認する
  for (const c of created.reverse()) {
    try {
      await xrpc(c.sess, "com.atproto.repo.deleteRecord", { repo: c.sess.did, collection: c.collection, rkey: c.rkey })
      const r = await fetch(`${PDS}/xrpc/com.atproto.repo.getRecord?repo=${c.sess.did}&collection=${c.collection}&rkey=${c.rkey}`)
      check(`削除 ${c.collection}`, r.status === 400 || r.status === 404, r.status)
    } catch (e) {
      failed = true
      console.error("削除に失敗:", c.collection, c.rkey, e.message)
    }
  }
}
process.exit(failed ? 1 : 0)
