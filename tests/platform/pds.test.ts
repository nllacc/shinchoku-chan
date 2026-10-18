import { afterEach, describe, expect, test, vi } from "vitest"
import { RecordNotFoundError, cidOf, resolveDid, verifyCid } from "../../src/platform/pds"

// 公開 PDS のレコードを使うため、ネットワークに接続できる環境で実行する
const BSKY_APP = "did:plc:z72i7hdynmk6r22z27h6tvur"
const PROFILE = `at://${BSKY_APP}/app.bsky.actor.profile/self`

afterEach(() => vi.restoreAllMocks())

describe("pds", () => {
  test("DID から PDS と handle を解決できる", async () => {
    const r = await resolveDid(BSKY_APP)
    expect(r.pds).toMatch(/^https:\/\//)
    expect(r.handle).toBe("bsky.app")
  })

  test("platform/AC-6: 取得したレコードのCIDを再計算した値が、PDSの返すCIDと一致する", async () => {
    const { pds } = await resolveDid(BSKY_APP)
    const r = await verifyCid(pds, PROFILE)
    expect(r.ok).toBe(true)
    expect(r.cid).toBe(await cidOf(r.value))
  })

  test("platform/AC-7: 内容を改変したレコードは、CIDが一致しないと判定される", async () => {
    const { pds } = await resolveDid(BSKY_APP)
    const real = globalThis.fetch
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const res = await real(input, init)
      const body = (await res.json()) as { value: { displayName?: string } }
      body.value.displayName = "改変"
      return Response.json(body)
    })
    expect((await verifyCid(pds, PROFILE)).ok).toBe(false)
  })

  test("存在しないレコードは RecordNotFoundError を投げる", async () => {
    const { pds } = await resolveDid(BSKY_APP)
    await expect(verifyCid(pds, `at://${BSKY_APP}/app.bsky.feed.post/3zzzzzzzzzzzz`)).rejects.toBeInstanceOf(RecordNotFoundError)
  })

  test("DID の解決に失敗すると例外を投げる", async () => {
    await expect(resolveDid("did:plc:doesnotexistdoesnotexist")).rejects.toThrow()
    await expect(resolveDid("did:key:abc")).rejects.toThrow()
  })
})
