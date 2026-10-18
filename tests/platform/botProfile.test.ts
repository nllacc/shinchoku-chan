import { describe, expect, test } from "vitest"
import { checkLabel, setLabel } from "../../scripts/bot-profile.mjs"

const profile = (labels?: string[], cid = "bafyold") => ({
  uri: "at://did:plc:bot/app.bsky.actor.profile/self",
  cid,
  value: { $type: "app.bsky.actor.profile", displayName: "進捗ちゃん", ...(labels ? { labels: { $type: "com.atproto.label.defs#selfLabels", values: labels.map((val) => ({ val })) } } : {}) },
})

describe("bot-profile", () => {
  test("platform/AC-18: 自己ラベルのないプロフィールは false、bot の自己ラベルがあれば true になる", async () => {
    const f = (p: unknown) => async () => Response.json(p)
    expect(await checkLabel("did:plc:bot", f(profile()))).toBe(false)
    expect(await checkLabel("did:plc:bot", f(profile(["porn"])))).toBe(false)
    expect(await checkLabel("did:plc:bot", f(profile(["bot"])))).toBe(true)
    expect(await checkLabel("did:plc:bot", async () => new Response('{"error":"RecordNotFound"}', { status: 400 }))).toBe(false)
  })

  test("setLabel は既存の項目を保ち、取得時の CID を swapRecord に付けて bot を加える", async () => {
    let put: any
    const f = async (input: any, init?: any) => {
      if (String(input).includes("putRecord")) { put = JSON.parse(init.body); return Response.json({}) }
      return Response.json(profile(["other"], "bafycur"))
    }
    expect(await setLabel({ did: "did:plc:bot", accessJwt: "jwt" }, f)).toBe(true)
    expect(put.swapRecord).toBe("bafycur")
    expect(put.record.displayName).toBe("進捗ちゃん")
    expect(put.record.labels.values).toEqual([{ val: "other" }, { val: "bot" }])
  })

  test("すでに bot があれば何も書かない", async () => {
    let writes = 0
    const f = async (input: any) => (String(input).includes("putRecord") ? (writes++, Response.json({})) : Response.json(profile(["bot"])))
    expect(await setLabel({ did: "did:plc:bot", accessJwt: "jwt" }, f)).toBe(false)
    expect(writes).toBe(0)
  })
})
