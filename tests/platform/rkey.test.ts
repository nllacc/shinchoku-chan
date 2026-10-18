import { describe, expect, test } from "vitest"
import { checkinKey, deriveRkey, deriveUnit, enrollmentKey } from "../../src/platform/rkey"

describe("rkey", () => {
  test("platform/AC-14: 同じ秘密値と同じ入力から導いたキーは同じ値になり、入力が1つ違うと別の値になる", async () => {
    const a = await deriveRkey("s", ["checkin", "e1", "20261001", "0", "progress"])
    expect(await deriveRkey("s", ["checkin", "e1", "20261001", "0", "progress"])).toBe(a)
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/)
    for (const other of [
      await deriveRkey("t", ["checkin", "e1", "20261001", "0", "progress"]),
      await deriveRkey("s", ["checkin", "e2", "20261001", "0", "progress"]),
      await deriveRkey("s", ["checkin", "e1", "20261002", "0", "progress"]),
      await deriveRkey("s", ["checkin", "e1", "20261001", "1", "progress"]),
      await deriveRkey("s", ["checkin", "e1", "20261001", "0", "result"]),
    ])
      expect(other).not.toBe(a)
  })

  test("受理と確認依頼のキーは入力の違いで変わる", async () => {
    const e = await enrollmentKey("s", "at://did:plc:x/t/1")
    expect(e).toBe(await enrollmentKey("s", "at://did:plc:x/t/1"))
    expect(e).not.toBe(await enrollmentKey("s", "at://did:plc:x/t/2"))
    const c = await checkinKey("s", e, { day: "20261001", window: 0, kind: "result" })
    expect(c).toBe(await deriveRkey("s", ["checkin", e, "20261001", "0", "result"]))
  })

  test("deriveUnit は 0 以上 1 未満で、同じ入力から同じ値になる", async () => {
    const u = await deriveUnit("s", ["result", "task1"])
    expect(u).toBeGreaterThanOrEqual(0)
    expect(u).toBeLessThan(1)
    expect(await deriveUnit("s", ["result", "task1"])).toBe(u)
    expect(await deriveUnit("s", ["result", "task2"])).not.toBe(u)
  })
})
