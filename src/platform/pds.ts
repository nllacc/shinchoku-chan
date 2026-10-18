// DID の解決、公開レコードの取得、CID の照合
import { jsonToLex } from "@atproto/lex-json"
import * as dagCbor from "@ipld/dag-cbor"
import { CID } from "multiformats/cid"
import { sha256 } from "multiformats/hashes/sha2"

export class RecordNotFoundError extends Error {}

type DidDoc = {
  alsoKnownAs?: string[]
  service?: { id: string; serviceEndpoint: string }[]
}

/** DID 文書から PDS と handle を得る。独自ドメインの handle も alsoKnownAs から同じ手順で得る */
export async function resolveDid(
  did: string,
): Promise<{ pds: string; handle: string | null }> {
  const url = did.startsWith("did:web:")
    ? `https://${did.slice("did:web:".length)}/.well-known/did.json`
    : did.startsWith("did:plc:")
      ? `https://plc.directory/${did}`
      : null
  if (!url) throw new Error(`unsupported DID method: ${did}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`DID resolution failed (${res.status}): ${did}`)
  const doc = (await res.json()) as DidDoc
  const pds = doc.service?.find((s) => s.id === "#atproto_pds")?.serviceEndpoint
  if (!pds) throw new Error(`no atproto_pds in DID document: ${did}`)
  const aka = doc.alsoKnownAs?.find((a) => a.startsWith("at://"))
  return { pds, handle: aka ? aka.slice("at://".length) : null }
}

/** レコードの値から CID を再計算する（dag-cbor で符号化し sha-256 で固定する） */
export async function cidOf(value: unknown): Promise<string> {
  const bytes = dagCbor.encode(jsonToLex(value as never))
  const hash = await sha256.digest(bytes)
  return CID.createV1(dagCbor.code, hash).toString()
}

export async function verifyCid(
  pds: string,
  uri: string,
): Promise<{ ok: boolean; cid: string; value: unknown }> {
  const [, , did, collection, rkey] = uri.split("/")
  const u = new URL(`${pds}/xrpc/com.atproto.repo.getRecord`)
  u.searchParams.set("repo", did ?? "")
  u.searchParams.set("collection", collection ?? "")
  u.searchParams.set("rkey", rkey ?? "")
  const res = await fetch(u)
  if (!res.ok) {
    const body = await res.text()
    if (res.status === 400 && body.includes("RecordNotFound")) throw new RecordNotFoundError(uri)
    throw new Error(`getRecord failed (${res.status}): ${uri}`)
  }
  const r = (await res.json()) as { cid: string; value: unknown }
  return { ok: (await cidOf(r.value)) === r.cid, cid: r.cid, value: r.value }
}
