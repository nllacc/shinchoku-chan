// Bot のレコードのキーの導出と、キーを指定した作成。同じ秘密値と入力から常に同じ値を作る
import type { BotAgent } from "./botSession"

const encoder = new TextEncoder()

async function hmac(secret: string, parts: string[]): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(parts.join("|"))))
}

/** HMAC-SHA-256 の先頭 16 バイトを 22 文字の base64url にする */
export async function deriveRkey(secret: string, parts: string[]): Promise<string> {
  const head = (await hmac(secret, parts)).slice(0, 16)
  return btoa(String.fromCharCode(...head)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}

/** HMAC の先頭 6 バイトを 2 の 48 乗で割った、0 以上 1 未満の値 */
export async function deriveUnit(secret: string, parts: string[]): Promise<number> {
  const head = (await hmac(secret, parts)).slice(0, 6)
  return head.reduce((acc, b) => acc * 256 + b, 0) / 2 ** 48
}

export const enrollmentKey = (secret: string, taskUri: string) =>
  deriveRkey(secret, ["enrollment", taskUri])

export const checkinKey = (
  secret: string,
  enrollmentRkey: string,
  i: { day: string; window: number; kind: "progress" | "result" },
) => deriveRkey(secret, ["checkin", enrollmentRkey, i.day, String(i.window), i.kind])

/**
 * キーを指定して Bot のリポジトリへレコードを作る。swapRecord を null にするため、同じキーが
 * あれば更新されず、既存のレコードを取得して created を偽にして返す
 */
export async function putRecordOnce(
  agent: BotAgent,
  collection: string,
  rkey: string,
  record: object,
): Promise<{ ref: { uri: string; cid: string }; created: boolean }> {
  const res = await agent.xrpc("POST", "com.atproto.repo.putRecord", {
    body: { repo: agent.did, collection, rkey, swapRecord: null, validate: false, record: { $type: collection, ...record } },
  })
  if (res.ok) return { ref: (await res.json()) as { uri: string; cid: string }, created: true }
  const text = await res.text()
  if (!text.includes("InvalidSwap")) throw new Error(`putRecord failed (${res.status}): ${text.slice(0, 200)}`)
  const got = await agent.xrpc("GET", "com.atproto.repo.getRecord", {
    query: { repo: agent.did, collection, rkey },
  })
  if (!got.ok) throw new Error(`getRecord after InvalidSwap failed (${got.status})`)
  const r = (await got.json()) as { uri: string; cid: string }
  return { ref: { uri: r.uri, cid: r.cid }, created: false }
}
