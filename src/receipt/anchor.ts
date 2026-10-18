// 起点投稿の検証
import type { Env } from "../platform/env"
import { RecordNotFoundError, resolveDid, verifyCid } from "../platform/pds"
import type { StrongRef } from "../lexicon/types"

const POST = "app.bsky.feed.post"

type Facet = { features?: { $type?: string; did?: string }[] }

export async function verifyAnchor(env: Env, did: string, anchor: StrongRef): Promise<boolean> {
  const [scheme, , repo, collection] = anchor.uri.split("/")
  if (scheme !== "at:" || repo !== did || collection !== POST) return false
  const { pds } = await resolveDid(did)
  let got
  try {
    got = await verifyCid(pds, anchor.uri)
  } catch (e) {
    if (e instanceof RecordNotFoundError) return false
    throw e
  }
  if (!got.ok || got.cid !== anchor.cid) return false
  const facets = (got.value as { facets?: Facet[] }).facets ?? []
  return facets.some((f) => f.features?.some((x) => x.$type === "app.bsky.richtext.facet#mention" && x.did === env.BOT_DID))
}
