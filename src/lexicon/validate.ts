import { BlobRef, Lexicons } from "@atproto/lexicon"
import { CID } from "multiformats/cid"
import { EXTERNAL_DOCS, LEXICON_DOCS } from "../../lexicons/registry"
import { NSID, type CollectionNsid } from "./nsid"

export type ValidationIssue = { path: string; reason: string }
export type ValidationResult =
  | { ok: true }
  | { ok: false; issues: ValidationIssue[] }

// lexicon 定義は起動時に1回だけ読み込み、以降は再利用する
const lexicons = new Lexicons([...LEXICON_DOCS, ...EXTERNAL_DOCS] as never[])

const COLLECTIONS = new Set<string>(
  Object.entries(NSID)
    .filter(([k]) => k !== "defs")
    .map(([, v]) => v),
)

// 作業名: 改行・制御文字・@ # / : と、英数字に挟まれた半角の . を含まない
const TITLE_UNSAFE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}@＠#＃/／:：]|[A-Za-z0-9]\.[A-Za-z0-9]/u

type Rec = Record<string, any>
type Rule = (v: Rec) => ValidationIssue[]

const issue = (path: string, reason: string): ValidationIssue[] => [{ path, reason }]
const time = (s: unknown) => Date.parse(String(s))

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
const IMAGE_MAX_BYTES = 1_000_000

// 画像の種類と大きさ(構造検証は blob の accept と maxSize を確かめないため、ここで検査する)
const imageIssues = (v: Rec, field: string): ValidationIssue[] => {
  const img = v[field]
  if (img === undefined) return []
  const mime = img.mimeType as string
  const size = img.size as number
  return [
    ...(IMAGE_TYPES.includes(mime) ? [] : issue(field, "image-type")),
    ...(size <= IMAGE_MAX_BYTES ? [] : issue(field, "image-too-large")),
  ]
}

const semanticRules: Partial<Record<string, Rule>> = {
  [NSID.task]: (v) => [
    ...(v.metric.startValue === v.metric.goalValue ? issue("metric", "metric-range-empty") : []),
    ...(v.durationDays >= 2 && v.slot === undefined ? issue("slot", "slot-required") : []),
    ...(v.durationDays === 1 && v.slot !== undefined ? issue("slot", "slot-forbidden") : []),
    ...(TITLE_UNSAFE.test(v.title) ? issue("title", "title-unsafe") : []),
    ...imageIssues(v, "startImage"),
  ],
  [NSID.progress]: (v) => imageIssues(v, "evidence"),
  [NSID.result]: (v) => imageIssues(v, "evidence"),
  [NSID.enrollment]: (v) => [
    ...(time(v.endsAt) > time(v.startedAt) ? [] : issue("endsAt", "ends-before-start")),
    ...(v.windows as Rec[]).flatMap((w, i) =>
      w.startMinute < w.endMinute ? [] : issue(`windows/${i}`, "window-inverted"),
    ),
  ],
  [NSID.checkin]: (v) => [
    ...(time(v.expiresAt) > time(v.issuedAt) ? [] : issue("expiresAt", "expires-before-issued")),
    ...(v.kind === "progress" && v.seq === undefined ? issue("seq", "seq-required") : []),
  ],
  [NSID.receipt]: (v) => {
    const has = v.record !== undefined && v.value !== undefined
    const none = v.record === undefined && v.value === undefined
    if (v.status === "accepted" && !has) return issue("record", "accepted-needs-record-and-value")
    if (v.status === "expired" && !none) return issue("record", "expired-forbids-record-and-value")
    return []
  },
}

// 画像の blob は構造検証が BlobRef の実体を要求するため、JSON 表現(ref の $link)を変換する。
// 変換できない値はそのまま渡し、構造検証で拒否させる
function reviveBlobs(value: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(value as object) }
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "object" && v !== null && (v as Rec).$type === "blob") {
      try {
        const b = v as { ref?: { $link?: unknown }; mimeType?: unknown; size?: unknown }
        if (typeof b.ref?.$link === "string" && typeof b.mimeType === "string" && typeof b.size === "number") {
          out[k] = new BlobRef(CID.parse(b.ref.$link), b.mimeType, b.size)
        }
      } catch {
        // 構造検証で拒否される
      }
    }
  }
  return out
}

// 構造検証のエラー文（"Record/<path> <理由>" 形式）を項目名と理由に分ける
function fromStructural(message: string): ValidationIssue {
  const missing = /must have the property "([^"]+)"/.exec(message)
  if (missing) return { path: missing[1]!, reason: "required" }
  const m = /^Record\/(\S+) (.*)$/.exec(message)
  const path = m?.[1] ?? ""
  const reason = path === "durationDays" ? "duration-out-of-range" : (m?.[2] ?? message)
  return { path, reason }
}

export function validateRecord(nsid: CollectionNsid, value: unknown): ValidationResult {
  if (!COLLECTIONS.has(nsid)) throw new RangeError(`unknown-collection: ${nsid}`)
  try {
    lexicons.assertValidRecord(nsid, { $type: nsid, ...reviveBlobs(value) })
  } catch (e) {
    return { ok: false, issues: [fromStructural((e as Error).message)] }
  }
  const issues = semanticRules[nsid]?.(value as Rec) ?? []
  return issues.length ? { ok: false, issues } : { ok: true }
}
