import { describe, expect, test, vi } from "vitest"
import type { Env } from "../../src/platform/env"
import { DEFAULT_OPTIONS, loadOptions, optionEnvName } from "../../src/platform/options"

const env = (vars: Record<string, string>) => vars as unknown as Env

describe("options", () => {
  test("platform/AC-4: 環境変数がなければ既定値、あればその値が返り、範囲外の値は拒否されて既定値が返る", () => {
    expect(loadOptions(env({}))).toEqual(DEFAULT_OPTIONS)
    expect(loadOptions(env({ OPT_TRIGGERS_PER_DAY: "12" })).triggersPerDay).toBe(12)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(loadOptions(env({ OPT_TRIGGERS_PER_DAY: "25" })).triggersPerDay).toBe(8)
    expect(loadOptions(env({ OPT_TRIGGERS_PER_DAY: "abc" })).triggersPerDay).toBe(8)
    expect(loadOptions(env({ OPT_MAX_USERS_PER_TRIGGER: "0" })).maxUsersPerTrigger).toBe(5)
    expect(warn).toHaveBeenCalledTimes(3)
    warn.mockRestore()
  })

  test("環境変数名の導出と窓の範囲の指定", () => {
    expect(optionEnvName("triggersPerDay")).toBe("OPT_TRIGGERS_PER_DAY")
    expect(optionEnvName("penaltyPerMissingHundredths")).toBe("OPT_PENALTY_PER_MISSING_HUNDREDTHS")
    expect(loadOptions(env({ OPT_FREE_WINDOW_RANGE: "360,1380" })).freeWindowRange).toEqual([360, 1380])
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(loadOptions(env({ OPT_FREE_WINDOW_RANGE: "1380,360" })).freeWindowRange).toEqual([480, 1200])
    warn.mockRestore()
  })

  test("返信の間隔の最大は最小以上になる", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const o = loadOptions(env({ OPT_REPLY_GAP_MIN_SECONDS: "50" }))
    expect(o.replyGapMaxSeconds).toBe(50)
    warn.mockRestore()
  })
})
