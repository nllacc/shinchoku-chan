// Bot アカウントのプロフィールの自己ラベル bot を確認・設定する運用スクリプト
//   node --env-file=.env scripts/bot-profile.mjs check   （終了コード: bot があれば 0、なければ 1）
//   node --env-file=.env scripts/bot-profile.mjs set     （BOT_APP_IDENTIFIER と BOT_APP_PASSWORD で設定する）
import { pathToFileURL } from "node:url"

const PDS = "https://bsky.social"

async function getProfile(did, fetchImpl) {
  const u = new URL(`${PDS}/xrpc/com.atproto.repo.getRecord`)
  u.searchParams.set("repo", did)
  u.searchParams.set("collection", "app.bsky.actor.profile")
  u.searchParams.set("rkey", "self")
  const res = await fetchImpl(u)
  if (res.status === 400) return null // プロフィールがまだない
  if (!res.ok) throw new Error(`getRecord failed (${res.status})`)
  return res.json()
}

const hasBot = (value) => (value?.labels?.values ?? []).some((v) => v.val === "bot")

/** 公開のプロフィールに bot の自己ラベルがあれば true */
export async function checkLabel(did, fetchImpl = fetch) {
  return hasBot((await getProfile(did, fetchImpl))?.value)
}

/** 既存のプロフィールの項目を保ち、bot を加えて書く。すでにあれば何も書かず false を返す */
export async function setLabel(session, fetchImpl = fetch) {
  const cur = await getProfile(session.did, fetchImpl)
  if (hasBot(cur?.value)) return false
  const values = [...(cur?.value?.labels?.values ?? []), { val: "bot" }]
  const record = {
    ...(cur?.value ?? {}),
    $type: "app.bsky.actor.profile",
    labels: { $type: "com.atproto.label.defs#selfLabels", values },
  }
  const res = await fetchImpl(`${PDS}/xrpc/com.atproto.repo.putRecord`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${session.accessJwt}` },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.actor.profile",
      rkey: "self",
      record,
      ...(cur?.cid ? { swapRecord: cur.cid } : {}),
    }),
  })
  if (!res.ok) throw new Error(`putRecord failed (${res.status}): ${await res.text()}`)
  return true
}

async function login() {
  const res = await fetch(`${PDS}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: process.env.BOT_APP_IDENTIFIER, password: process.env.BOT_APP_PASSWORD }),
  })
  if (!res.ok) throw new Error(`createSession failed (${res.status})`)
  return res.json()
}

async function main(command) {
  if (command === "check") {
    const did = process.env.BOT_DID
    if (!did) throw new Error("BOT_DID is required")
    const ok = await checkLabel(did)
    console.log(ok ? "bot の自己ラベルがあります" : "bot の自己ラベルがありません")
    process.exitCode = ok ? 0 : 1
  } else if (command === "set") {
    const changed = await setLabel(await login())
    console.log(changed ? "bot の自己ラベルを設定しました" : "すでに設定されています")
  } else {
    console.error("usage: bot-profile.mjs check|set")
    process.exitCode = 2
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main(process.argv[2])
