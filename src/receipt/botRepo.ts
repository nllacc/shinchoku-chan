// Bot のリポジトリへの書き込み(書き込み先は Bot のリポジトリのみ)
import { getBotAgent } from "../platform/botSession"
import type { Env } from "../platform/env"
import { putRecordOnce } from "../platform/rkey"
import type { CollectionNsid } from "../lexicon/nsid"
import { validateRecord } from "../lexicon/validate"
import type { StrongRef } from "../lexicon/types"

export async function writeBotRecord(
  env: Env,
  collection: CollectionNsid,
  record: object,
  rkey?: string,
): Promise<{ ref: StrongRef; created: boolean }> {
  const checked = validateRecord(collection, record)
  if (!checked.ok) {
    throw new Error(`invalid bot record (${collection}): ${checked.issues.map((i) => `${i.path} ${i.reason}`).join(", ")}`)
  }
  const agent = await getBotAgent(env)
  if (rkey) return putRecordOnce(agent, collection, rkey, record)
  const res = await agent.xrpc("POST", "com.atproto.repo.createRecord", {
    body: { repo: agent.did, collection, validate: false, record: { $type: collection, ...record } },
  })
  if (!res.ok) throw new Error(`createRecord failed (${res.status}): ${(await res.text()).slice(0, 200)}`)
  const r = (await res.json()) as StrongRef
  return { ref: { uri: r.uri, cid: r.cid }, created: true }
}

/** Bot のリポジトリのレコードを読む。なければ null */
export async function readBotRecord(
  env: Env,
  collection: CollectionNsid,
  rkey: string,
): Promise<{ ref: StrongRef; value: Record<string, any> } | null> {
  const agent = await getBotAgent(env)
  const res = await agent.xrpc("GET", "com.atproto.repo.getRecord", { query: { repo: agent.did, collection, rkey } })
  if (!res.ok) {
    if (res.status === 400 && (await res.text()).includes("RecordNotFound")) return null
    throw new Error(`getRecord failed (${res.status})`)
  }
  const r = (await res.json()) as { uri: string; cid: string; value: Record<string, any> }
  return { ref: { uri: r.uri, cid: r.cid }, value: r.value }
}
