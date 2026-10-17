import { BrowserOAuthClient, buildLoopbackClientId } from "@atproto/oauth-client-browser"

const NS = "com.example.shinchoku"
// web-task の設計書と同じ形式の権限（blob は画像のみ）
const SCOPE = `atproto repo:${NS}.task?action=create repo:${NS}.progress?action=create repo:app.bsky.feed.post?action=create blob:image/*`
const $ = (id) => document.getElementById(id)
const out = $("out")
const log = (s) => { out.textContent += s + "\n" }

// 例外を画面に出す（何も起きないように見えるのを防ぐ）
window.addEventListener("error", (e) => log("エラー: " + e.message))
window.addEventListener("unhandledrejection", (e) => log("未処理のエラー: " + (e.reason?.message ?? e.reason)))
// フォームの送信による再読み込みを、初期化の完了前でも必ず止める
$("login").onsubmit = (e) => { e.preventDefault(); signIn().catch((err) => log("signIn エラー: " + (err?.message ?? err))) }
log(`環境: ${location.href} / secureContext=${isSecureContext} / crypto.subtle=${typeof crypto?.subtle}`)

// ループバックのクライアントは 127.0.0.1 でのアクセスが必須
if (location.hostname === "localhost") {
  location.replace(`http://127.0.0.1:${location.port}${location.pathname}`)
}

let client
let session
const ready = (async () => {
  client = new BrowserOAuthClient({
    handleResolver: "https://bsky.social",
    clientMetadata: {
      client_id: buildLoopbackClientId(location) + "&scope=" + encodeURIComponent(SCOPE),
      redirect_uris: [`http://127.0.0.1:${location.port}/`],
      scope: SCOPE,
      response_types: ["code"],
      grant_types: ["authorization_code", "refresh_token"],
      token_endpoint_auth_method: "none",
      application_type: "web",
      dpop_bound_access_tokens: true,
    },
  })
  const result = await client.init()
  session = result?.session
})()

async function signIn() {
  const handle = $("handle").value.trim()
  log(`サインインを開始: ${handle}`)
  await ready
  await client.signIn(handle, { scope: SCOPE })
}

await ready.catch((e) => log("初期化エラー: " + (e?.message ?? e)))

if (!session) {
  $("state").textContent = "未サインイン"
} else {
  $("state").textContent = `サインイン済み: ${session.did}`
  $("run").disabled = false
  $("run").onclick = run
}

async function run() {
  $("run").disabled = true
  const results = []
  const rec = (name, ok, detail) => { results.push({ name, ok, detail }); log(`${ok ? "合" : "否"} ${name}: ${detail}`) }
  const call = async (nsid, body, ct = "application/json") => {
    const r = await session.fetchHandler(`/xrpc/${nsid}`, {
      method: "POST", headers: { "content-type": ct }, body: ct === "application/json" ? JSON.stringify(body) : body,
    })
    const text = await r.text()
    let json; try { json = JSON.parse(text) } catch {}
    return { status: r.status, text: text.slice(0, 160), json }
  }
  const create = (col, extra) => call("com.atproto.repo.createRecord", {
    repo: session.did, collection: col, validate: false,
    record: { $type: col, createdAt: new Date().toISOString(), ...extra },
  })
  const created = []
  try {
    const info = await session.getTokenInfo()
    rec("付与された権限", true, info.scope)
    const task = await create(`${NS}.task`, { summary: "OAuth検証" })
    rec("要求した task を作成できる", task.status === 200, task.text); if (task.json?.uri) created.push(task.json.uri)
    const prog = await create(`${NS}.progress`, { task: { uri: task.json?.uri, cid: task.json?.cid }, value: 500 })
    rec("要求した progress を作成できる", prog.status === 200, prog.text); if (prog.json?.uri) created.push(prog.json.uri)
    const post = await create("app.bsky.feed.post", { text: "[shinchoku-chan OAuth検証] 自動で削除されます" })
    rec("要求した feed.post を作成できる", post.status === 200, post.text); if (post.json?.uri) created.push(post.json.uri)
    const bot = await create(`${NS}.bot.receipt`, { x: 1 })
    rec("要求していない bot.receipt は拒否される", bot.status >= 400, `${bot.status} ${bot.text}`); if (bot.status === 200 && bot.json?.uri) created.push(bot.json.uri)
    const del = await call("com.atproto.repo.deleteRecord", { repo: session.did, collection: `${NS}.task`, rkey: "nonexist" })
    rec("要求していない delete は拒否される", del.status >= 400 && del.status !== 404 || /scope|permission|auth/i.test(del.text), `${del.status} ${del.text}`)
    const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0))
    const blob = await call("com.atproto.repo.uploadBlob", png, "image/png")
    rec("画像の blob をアップロードできる", blob.status === 200, blob.text)
    const txt = await call("com.atproto.repo.uploadBlob", new Uint8Array([104, 105]), "text/plain")
    rec("画像以外の blob は拒否される", txt.status >= 400, `${txt.status} ${txt.text}`)
    if (prog.json?.uri) {
      const v = await (await fetch(`/verify?uri=${encodeURIComponent(prog.json.uri)}`)).json()
      rec("Worker が CID を照合できる", v.match === true && v.localCid === prog.json.cid, JSON.stringify(v))
    }
  } catch (e) {
    rec("実行エラー", false, String(e))
  }
  await fetch("/report", { method: "POST", body: JSON.stringify({ did: session.did, created, results }) })
  log("結果をサーバーへ送信しました")
}
