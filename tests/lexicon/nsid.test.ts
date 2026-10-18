import { describe, expect, test } from "vitest"
import { NSID, NSID_PREFIX } from "../../src/lexicon/nsid"
import { LEXICON_DOCS } from "../../lexicons/registry"

describe("nsid", () => {
  test("lexicon/AC-10: Bot側の識別子はユーザー側と異なる階層(bot.)に置かれる", () => {
    for (const k of ["enrollment", "checkin", "receipt", "revocation", "evaluation"] as const) {
      expect(NSID[k].startsWith(`${NSID_PREFIX}.bot.`)).toBe(true)
    }
    for (const k of ["task", "progress", "result"] as const) {
      expect(NSID[k].startsWith(`${NSID_PREFIX}.bot.`)).toBe(false)
    }
  })

  test("lexicon/AC-10: registry の各文書の id が NSID と一致する", () => {
    const ids = LEXICON_DOCS.map((d) => (d as { id: string }).id)
    for (const id of ids) expect(Object.values(NSID)).toContain(id)
  })
})
