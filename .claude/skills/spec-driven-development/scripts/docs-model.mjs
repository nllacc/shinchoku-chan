/**
 * architecture と PoC の文書モデル。
 *
 * 文書を章単位に分解し、構成要素・外部インターフェース・機能・根拠・PoC の状態を取り出す。
 * 体裁の検査（check-architecture／check-poc）、突合（check-structure）、工程の導出（commands）が
 * 同じ解釈を使うための共通部で、体裁が崩れた文書でも例外を投げず、取れる範囲で返す。
 */
import {
  isCompleted,
  isDesigned,
  nonBlank,
  parseTable,
  sectionsByH2,
} from "./lib.mjs"

export const ARCH_CHAPTERS = [
  "1. 目的と範囲",
  "2. 構成要素",
  "3. システム構成",
  "4. 外部インターフェース",
  "5. 機能",
  "6. データ",
  "7. 信頼と検証",
  "8. 技術基盤",
  "9. 横断的制約",
]

/** 表の章 → 列見出し */
export const ARCH_TABLES = {
  "2. 構成要素": ["構成要素", "種別", "責務", "実装spec"],
  "4. 外部インターフェース": [
    "IF",
    "方向",
    "外部の要素",
    "内部の要素",
    "方式",
    "認証",
  ],
  "6. データ": ["データ", "保管場所", "書き込み主体"],
  "7. 信頼と検証": ["対象", "信頼する前提", "検証手段"],
  "8. 技術基盤": ["領域", "採用", "理由", "根拠"],
  "9. 横断的制約": ["制約", "値", "根拠"],
}

/** 文（述語で終わる記述）を書く列。ほかの列は名称・値の列で、名詞でよい */
export const ARCH_SENTENCE_COLUMNS = {
  "2. 構成要素": ["責務"],
  "7. 信頼と検証": ["信頼する前提", "検証手段"],
  "8. 技術基盤": ["理由"],
}

export const POC_CHAPTERS = [
  "1. 結論",
  "2. 反映先",
  "3. 制約値",
  "4. 検証項目",
  "5. 手順と結果",
]

export const POC_TABLES = {
  "3. 制約値": ["項目", "値"],
  "4. 検証項目": ["仮説", "合格基準", "結果"],
}

/** 一覧セルの区切り（半角カンマ・読点） */
export const splitList = (text) =>
  text
    .replace(/`/g, "")
    .split(/\s*[,、]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)

const NONE = /^- なし$/

// ---------------------------------------------------------------------------
// architecture
// ---------------------------------------------------------------------------

/** 機能（5章の H3、または分割ファイル全体）から「- 関与:」行・本文を取り出す */
function functionOf({ title, no, lines, file, part }) {
  const body = nonBlank(lines)
  const first = body[0]
  const m = first && /^- 関与: (.+)$/.exec(first.text.trim())
  return {
    title,
    no,
    file,
    part: part ?? null,
    lines,
    involved: m ? splitList(m[1]) : null,
    involvedNo: m ? first.no : null,
  }
}

/** 5章の本文を、H3 ごとの機能と、分割ファイルへの索引行に分ける */
function parseFunctionsChapter(sec, file) {
  const inline = []
  const links = []
  let cur = null
  for (const l of sec?.lines ?? []) {
    const h = !l.code && /^###\s+(.*?)\s*$/.exec(l.text)
    if (h) {
      cur = { title: h[1], no: l.no, lines: [], file }
      inline.push(cur)
      continue
    }
    const link =
      !l.code &&
      !cur &&
      /^- \[([^\]]+)\]\(architecture\/([^)]+)\)(?:: (.*))?$/.exec(l.text.trim())
    if (link) {
      links.push({
        title: link[1],
        target: link[2],
        caption: link[3] ?? "",
        no: l.no,
      })
      continue
    }
    if (cur) cur.lines.push(l)
  }
  return { inline: inline.map(functionOf), links }
}

/** docs/architecture.md と分割ファイルから文書モデルを作る */
export function parseArchitecture(arch) {
  const main = arch.main
  const secs = main ? sectionsByH2(main.lines) : []
  const sec = (title) => secs.find((s) => s.title === title) ?? null
  const table = (title) => {
    const s = sec(title)
    return s ? parseTable(s.lines) : null
  }

  const compTable = table("2. 構成要素")
  const components = (compTable?.rows ?? []).map((r) => ({
    name: r.cells[0] ?? "",
    kind: r.cells[1] ?? "",
    resp: r.cells[2] ?? "",
    specs: r.cells[3] && r.cells[3] !== "-" ? splitList(r.cells[3]) : [],
    no: r.no,
  }))

  const ifTable = table("4. 外部インターフェース")
  const interfaces = (ifTable?.rows ?? []).map((r) => ({
    name: r.cells[0] ?? "",
    dir: r.cells[1] ?? "",
    ext: r.cells[2] ?? "",
    int: r.cells[3] ?? "",
    method: r.cells[4] ?? "",
    auth: r.cells[5] ?? "",
    no: r.no,
  }))

  const fnChapter = parseFunctionsChapter(sec("5. 機能"), main)
  const partFunctions = arch.parts.map((p) => {
    const lines = p.file.lines
    const h1 = lines.find((l) => !l.code && /^#\s+/.test(l.text))
    const rest = lines.filter((l) => l.no > (h1?.no ?? 0))
    return functionOf({
      title: h1 ? h1.text.replace(/^#\s+/, "").trim() : "",
      no: h1?.no ?? 1,
      lines: rest,
      file: p.file,
      part: p.name,
    })
  })

  /** 根拠の列を持つ行（8章の4列目・9章の3列目） */
  const basis = []
  for (const [title, col] of [
    ["8. 技術基盤", 3],
    ["9. 横断的制約", 2],
  ]) {
    const t = table(title)
    for (const r of t?.rows ?? [])
      basis.push({
        chapter: title,
        no: r.no,
        refs: r.cells[col] ? splitList(r.cells[col]) : [],
      })
  }

  return {
    secs,
    sec,
    table,
    components,
    interfaces,
    functions: [...fnChapter.inline, ...partFunctions],
    inlineFunctions: fnChapter.inline,
    partFunctions,
    links: fnChapter.links,
    basis,
  }
}

/** 根拠の値の種別: poc/<テーマ> か spec 名 */
export const pocThemeOf = (ref) => /^poc\/([^/\s]+)$/.exec(ref)?.[1] ?? null

// ---------------------------------------------------------------------------
// PoC
// ---------------------------------------------------------------------------

/** PoC の README から、結論・反映先・制約値・検証項目を取り出す */
export function parsePoc(poc) {
  const secs = poc.readme ? sectionsByH2(poc.readme.lines) : []
  const sec = (t) => secs.find((s) => s.title === t) ?? null
  const conclusionLines = nonBlank(sec("1. 結論")?.lines ?? [])
  const conclusion = {
    none:
      conclusionLines.length === 1 && NONE.test(conclusionLines[0].text.trim()),
    text: conclusionLines.map((l) => l.text.trim()).join(""),
    lines: conclusionLines,
  }
  const targetLines = nonBlank(sec("2. 反映先")?.lines ?? [])
  const tm =
    targetLines.length === 1 &&
    /^- ([a-z0-9][a-z0-9-]*)$/.exec(targetLines[0].text.trim())
  const target = {
    name: tm && tm[1] !== "なし" ? tm[1] : null,
    no: targetLines[0]?.no ?? sec("2. 反映先")?.no ?? 1,
    lines: targetLines,
  }
  const items = sec("4. 検証項目") ? parseTable(sec("4. 検証項目").lines) : null
  const constraints = sec("3. 制約値")
    ? parseTable(sec("3. 制約値").lines)
    : null
  return {
    secs,
    sec,
    conclusion,
    target,
    items,
    constraints,
    results: (items?.rows ?? []).map((r) => r.cells[2] ?? ""),
  }
}

/**
 * PoC の状態を成果物から導出する。
 * - 検証中: 結論が「- なし」、または結果に「-」が残っている
 * - 反映待ち: 結論があり、反映先が「- なし」
 * - 反映済み: 反映先の spec がある（その spec の全タスクが完了していれば remove=true）
 */
export function pocState(poc, specs) {
  const m = parsePoc(poc)
  const concluded =
    !m.conclusion.none &&
    m.results.length > 0 &&
    m.results.every((x) => x === "合" || x === "否")
  if (!concluded)
    return { state: "検証中", remove: false, target: m.target.name }
  if (!m.target.name) return { state: "反映待ち", remove: false, target: null }
  const spec = specs.find((s) => s.name === m.target.name && isDesigned(s))
  return {
    state: "反映済み",
    remove: Boolean(spec && isCompleted(spec)),
    target: m.target.name,
  }
}

/** 反映済みでない（検証中・反映待ち）PoC か */
export const isPending = (st) => st.state !== "反映済み"
