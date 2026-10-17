/**
 * architecture 体裁チェック: docs/architecture.md（と分割ファイル docs/architecture/*.md）が雛形どおりであることを検証する。
 *
 * - 章立て・表の列・固定形（機能は「関与 → 説明 → ワークフロー図」）
 * - 表と図の対応（構成要素・外部インターフェース・機能の関与）
 * - 行数の上限と分割、機能の重複・網羅
 * 図の記法・規模・状態図・構文の検査は check-diagram の共通処理（G 系）を使う。
 * spec・PoC との突合は check-structure（S 系）、語彙と文体は check-wording（W 系）が担う。
 */
import { pathToFileURL } from "node:url"
import { syntaxError } from "./mermaid-syntax.mjs"
import {
  analyzeDiagram,
  checkCycle,
  hasBranch,
  splitChapter,
} from "./check-diagram.mjs"
import {
  ARCH_CHAPTERS,
  ARCH_TABLES,
  parseArchitecture,
  pocThemeOf,
} from "./docs-model.mjs"
import {
  finding,
  headings,
  isTableLine,
  nonBlank,
  parseTable,
  runCli,
} from "./lib.mjs"

export const title = "architecture 体裁チェック（check-architecture）"

const LIMIT = {
  purposeChars: 300,
  cell: 60,
  name: 30,
}

const len = (s) => [...s].length

export const rules = {
  "F-A01":
    "architecture.md の1行目は「# <名称> アーキテクチャ」の H1 とし、H1 は1つだけにする",
  "F-A02": `architecture.md の H2 は「${ARCH_CHAPTERS.join("」「")}」をこの順で過不足なく置き、H1 と最初の H2 の間に本文を置かない`,
  "F-A03": "H3 は「5. 機能」の機能見出しだけに使う。H4 以下は使わない",
  "F-A04": `目的と範囲は、箇条書き・表を使わず、合計 ${LIMIT.purposeChars} 文字以内の地の文で書く`,
  "F-A05":
    "表の章（2・4・6・7・8・9）は所定の列見出しの表だけで書く（該当なしは「- なし」。2 章は不可）。全セルを埋め、各セルは 60 文字以内で「。」を含めない",
  "F-A06": `構成要素表: 構成要素名は一意で ${LIMIT.name} 文字以内、種別は「内部」「外部」、内部は実装spec を1件以上、外部は実装spec を「-」にする。内部を1件以上置く`,
  "F-A07":
    "外部インターフェース表: IF 名は一意、方向は「提供」「利用」、外部の要素は構成要素表の外部、内部の要素は構成要素表の内部とし、すべての外部の要素がいずれかの IF に現れる",
  "F-A08":
    "システム構成（3章）は内部の要素だけの関係図（flowchart／classDiagram）1〜3 個で書く（内部が1件以下なら「- なし」）。ノード名は構成要素表の内部の名前と一致し、すべての内部の要素がいずれかの図に現れる",
  "F-A09":
    "外部インターフェース（4章）の表の後に境界図（flowchart）を1個だけ置く。ノードは構成要素表の名前（外部は ID を ext_ で始める）、辺の名前は IF 名とし、表の行と図の辺が一対一に対応し、向きが方向と一致する（提供 = 外部 → 内部、利用 = 内部 → 外部）",
  "F-A10":
    "機能は「- 関与: 要素, 要素」の行 → 説明1行 → ワークフロー図（sequenceDiagram／stateDiagram-v2）1個の固定形で書く。機能名は一意で 30 文字以内。5 章は機能（H3）と分割ファイルへの索引（「- [機能名](architecture/<名>.md): 説明。」）だけで書く（なしは「- なし」）",
  "F-A11":
    "機能の関与は構成要素表に実在する名前を重複なく設定値の範囲（初期 2〜6 件）で書く。シーケンス図の参加者は関与と一致し、ノード名は構成要素表の名前（外部は ID を ext_ で始める）にする",
  "F-A12":
    "技術基盤と横断的制約の根拠は、spec 名または poc/<テーマ> を「、」か「,」で区切って1件以上書く。横断的制約の値は数値を含む",
  "F-A13":
    "architecture.md は設定の行数（architecture.maxLines。初期 400）以内、機能（H3 または分割ファイル）は設定の行数（architecture.maxFunctionLines。初期 80）以内にする。超えるときは機能を docs/architecture/<機能>.md に分割し、5 章を索引にする",
  "F-A14":
    "関与する構成要素の集合と、図のメッセージ名の集合が、どちらも設定の類似度（architecture.mergeSimilarity。初期 0.8）以上の機能を2つ以上置かない（同じ振る舞いを重複して書かず、統合する）",
  "F-A15":
    "すべての内部の要素が、いずれかの機能の関与に現れる（機能がある場合）",
  "F-A16":
    "分割ファイルは1行目を「# <機能名>」の H1 とし、H1 は1つだけにする。H2 以下は使わず、機能名は索引のリンクの名前と一致する",
}

const NONE = /^- なし$/

/** 章の本文のうち、表の行を除いた行 */
const nonTable = (lines) => lines.filter((l) => !isTableLine(l))

export async function check(ctx) {
  const arch = ctx.docs.architecture
  if (!ctx.targetArch || !arch.main) return []
  const cfg = ctx.config.architecture
  const syntax =
    ctx.options?.syntax === false
      ? null
      : (block) => syntaxError(block.lines, block.open.no)
  const out = []
  const adder = (file) => (no, rule, msg) =>
    out.push(finding(file.rel, no, rule, msg))
  const main = arch.main
  const add = adder(main)
  const model = parseArchitecture(arch)
  const secs = model.secs

  // ---- F-A01〜03: 見出し ----
  const hs = headings(main.lines)
  const h1s = hs.filter((h) => h.level === 1)
  if (
    !/^# \S.* アーキテクチャ$/.test(main.lines[0]?.text ?? "") ||
    h1s.length !== 1
  )
    add(
      1,
      "F-A01",
      "1行目は「# <名称> アーキテクチャ」の H1 にし、H1 は1つだけにする",
    )
  const h2s = secs.filter((s) => s.title !== null).map((s) => s.title)
  if (h2s.join("\n") !== ARCH_CHAPTERS.join("\n"))
    add(
      1,
      "F-A02",
      `H2 は「${ARCH_CHAPTERS.join("」「")}」をこの順で過不足なく置く（実際: ${h2s.join("、") || "なし"}）`,
    )
  const preamble = nonBlank(secs[0].lines).filter((l) => !/^#\s/.test(l.text))
  if (preamble.length > 0)
    add(preamble[0].no, "F-A02", "H1 と最初の H2 の間に本文を置かない")
  let currentH2 = null
  for (const l of main.lines) {
    if (l.code) continue
    const m = /^(#{2,6})\s+(.*?)\s*$/.exec(l.text)
    if (!m) continue
    if (m[1].length === 2) currentH2 = m[2]
    else if (m[1].length === 3 && currentH2 !== "5. 機能")
      add(l.no, "F-A03", "H3 は「5. 機能」の機能見出しだけに使う")
    else if (m[1].length >= 4) add(l.no, "F-A03", "H4 以下は使わない")
  }

  // ---- F-A04: 目的と範囲 ----
  const s1 = model.sec("1. 目的と範囲")
  if (s1) {
    const body = nonBlank(s1.lines)
    const bad = body.find((l) =>
      /^\s*([-*]|\d+\.)\s|^\s*[|#]|^\s*```/.test(l.text),
    )
    if (body.length === 0) add(s1.no, "F-A04", "目的と範囲が空")
    else if (bad)
      add(bad.no, "F-A04", "箇条書き・表・見出し・コードは使わず地の文で書く")
    const chars = len(body.map((l) => l.text.trim()).join(""))
    if (chars > LIMIT.purposeChars)
      add(s1.no, "F-A04", `${chars} 文字（上限 ${LIMIT.purposeChars} 文字）`)
  }

  // ---- F-A05: 表の章 ----
  const names = {
    internal: new Set(),
    external: new Set(),
    all: new Set(),
  }
  for (const c of model.components) {
    names.all.add(c.name)
    ;(c.kind === "外部" ? names.external : names.internal).add(c.name)
  }
  for (const [chapter, header] of Object.entries(ARCH_TABLES)) {
    const s = model.sec(chapter)
    if (!s) continue
    const body = nonBlank(s.lines)
    const none = body.length === 1 && NONE.test(body[0].text.trim())
    const isIf = chapter === "4. 外部インターフェース"
    if (none) {
      if (chapter === "2. 構成要素")
        add(s.no, "F-A05", "構成要素は「- なし」にできない")
      if (isIf && names.external.size > 0)
        add(
          s.no,
          "F-A05",
          "外部の構成要素があるため、外部インターフェースを書く",
        )
      continue
    }
    const table = parseTable(s.lines)
    if (!table) {
      add(
        s.no,
        "F-A05",
        `表（${header.join(" | ")}）がない（該当なしは「- なし」）`,
      )
      continue
    }
    if (table.header.join("\n") !== header.join("\n") || !table.separator)
      add(
        table.headerNo,
        "F-A05",
        `列見出しは「| ${header.join(" | ")} |」と区切り行にする`,
      )
    if (table.rows.length === 0)
      add(table.headerNo, "F-A05", "表にデータ行がない")
    for (const r of table.rows) {
      if (r.cells.length !== header.length)
        add(r.no, "F-A05", `列数は ${header.length}（実際: ${r.cells.length}）`)
      for (const cell of r.cells) {
        if (cell === "") add(r.no, "F-A05", "空のセルがある")
        if (len(cell) > LIMIT.cell)
          add(
            r.no,
            "F-A05",
            `セルが ${len(cell)} 文字（上限 ${LIMIT.cell} 文字）`,
          )
        if (cell.includes("。")) add(r.no, "F-A05", "セルに「。」を含めない")
      }
    }
    // 表以外の行: 4 章は説明と図、そのほかは置かない
    if (!isIf) {
      const extra = nonBlank(nonTable(s.lines)).filter(
        (l) => !NONE.test(l.text.trim()),
      )
      if (extra.length > 0) add(extra[0].no, "F-A05", "表以外の行を置かない")
    }
  }

  // ---- F-A06: 構成要素表の意味 ----
  const seenNames = new Map()
  for (const c of model.components) {
    if (seenNames.has(c.name))
      add(
        c.no,
        "F-A06",
        `構成要素名「${c.name}」が重複している（初出: ${seenNames.get(c.name)} 行）`,
      )
    else seenNames.set(c.name, c.no)
    if (len(c.name) > LIMIT.name)
      add(
        c.no,
        "F-A06",
        `構成要素名が ${len(c.name)} 文字（上限 ${LIMIT.name} 文字）`,
      )
    if (c.kind !== "内部" && c.kind !== "外部")
      add(c.no, "F-A06", `種別は「内部」か「外部」（実際: ${c.kind}）`)
    else if (c.kind === "内部" && c.specs.length === 0)
      add(c.no, "F-A06", "内部の構成要素は実装spec を1件以上書く")
    else if (c.kind === "外部" && c.specs.length > 0)
      add(c.no, "F-A06", "外部の構成要素の実装spec は「-」にする")
  }
  if (model.components.length > 0 && names.internal.size === 0)
    add(model.sec("2. 構成要素").no, "F-A06", "内部の構成要素を1件以上置く")

  // ---- F-A07: 外部インターフェース表の意味 ----
  const ifSeen = new Map()
  const usedExternal = new Set()
  for (const i of model.interfaces) {
    if (ifSeen.has(i.name))
      add(
        i.no,
        "F-A07",
        `IF 名「${i.name}」が重複している（初出: ${ifSeen.get(i.name)} 行）`,
      )
    else ifSeen.set(i.name, i.no)
    if (i.dir !== "提供" && i.dir !== "利用")
      add(i.no, "F-A07", `方向は「提供」か「利用」（実際: ${i.dir}）`)
    if (!names.external.has(i.ext))
      add(i.no, "F-A07", `外部の要素「${i.ext}」が構成要素表の外部にない`)
    else usedExternal.add(i.ext)
    if (!names.internal.has(i.int))
      add(i.no, "F-A07", `内部の要素「${i.int}」が構成要素表の内部にない`)
  }
  const s4 = model.sec("4. 外部インターフェース")
  if (model.interfaces.length > 0)
    for (const e of [...names.external].sort())
      if (!usedExternal.has(e))
        add(s4.no, "F-A07", `外部の要素「${e}」がどの IF にも現れない`)

  // ---- 図: 3 章（内部の関係図） ----
  const s3 = model.sec("3. システム構成")
  const covered = new Set()
  if (s3) {
    const body = nonBlank(s3.lines)
    const none = body.length === 1 && NONE.test(body[0].text.trim())
    if (none) {
      if (names.internal.size > 1)
        add(s3.no, "F-A08", "内部の構成要素が複数あるため、関係図を置く")
    } else {
      const items = splitChapter(s3, add)
      const diagrams = []
      for (const it of items) {
        if (!it.block.close) continue
        const d = await analyzeDiagram(it, add, syntax, {
          ext: true,
          minNodes: 2,
        })
        if (!d) continue
        if (d.group !== "relation") {
          add(
            it.block.open.no,
            "F-A08",
            "3 章には関係図（flowchart／classDiagram）だけを置く",
          )
          continue
        }
        for (const n of d.nodes.values()) {
          if (n.id.startsWith("ext_"))
            add(
              n.no,
              "F-A08",
              `内部の関係図に外部の要素「${n.label}」を置かない`,
            )
          else if (!names.internal.has(n.label))
            add(n.no, "F-A08", `「${n.label}」は構成要素表の内部にない`)
          else covered.add(n.label)
        }
        diagrams.push(d)
      }
      if (diagrams.length < 1 || diagrams.length > 3)
        add(s3.no, "F-A08", `関係図は 1〜3 個（実際: ${diagrams.length} 個）`)
      for (const n of [...names.internal].sort())
        if (!covered.has(n))
          add(s3.no, "F-A08", `内部の要素「${n}」が関係図にない`)
      checkCycle(diagrams, add)
    }
  }

  // ---- 図: 4 章（境界図） ----
  if (s4) {
    const body = nonBlank(s4.lines)
    const none = body.length === 1 && NONE.test(body[0].text.trim())
    if (!none && model.interfaces.length > 0) {
      const items = splitChapter({ lines: nonTable(s4.lines) }, add)
      const diagrams = []
      for (const it of items) {
        if (!it.block.close) continue
        const d = await analyzeDiagram(it, add, syntax, {
          ext: true,
          minNodes: 2,
          looseEdges: true,
        })
        if (d) diagrams.push(d)
      }
      if (diagrams.length !== 1)
        add(
          s4.no,
          "F-A09",
          `境界図は1個だけ置く（実際: ${diagrams.length} 個）`,
        )
      const d = diagrams[0]
      if (d && d.kind !== "flowchart")
        add(d.open.no, "F-A09", "境界図は flowchart にする")
      else if (d) checkBoundary(d, model, names, add)
    }
  }

  // ---- 5 章: 機能 ----
  const s5 = model.sec("5. 機能")
  const workflow = []
  if (s5) {
    const body = nonBlank(s5.lines)
    const none = body.length === 1 && NONE.test(body[0].text.trim())
    if (!none) {
      for (const l of nonBlank(s5.lines)) {
        if (l.no >= (model.inlineFunctions[0]?.no ?? Infinity)) break
        if (!model.links.some((k) => k.no === l.no))
          add(
            l.no,
            "F-A10",
            "5 章の H3 より前には、分割ファイルへの索引行（「- [機能名](architecture/<名>.md): 説明。」）だけを置く",
          )
      }
      if (model.functions.length === 0)
        add(s5.no, "F-A10", "機能がない（なしは「- なし」）")
    }
  }
  const titles = new Map()
  const sets = []
  for (const fn of model.functions) {
    const fa = adder(fn.file)
    const where = fn.part ? `分割ファイル ${fn.part}` : "機能"
    if (!fn.title || len(fn.title) > LIMIT.name)
      fa(
        fn.no,
        "F-A10",
        `機能名は 1〜${LIMIT.name} 文字（実際: 「${fn.title}」）`,
      )
    if (titles.has(fn.title))
      fa(fn.no, "F-A10", `機能名「${fn.title}」が重複している`)
    titles.set(fn.title, true)
    if (fn.part) {
      const h1 = fn.file.lines.filter((l) => !l.code && /^#\s/.test(l.text))
      const other = fn.file.lines.filter(
        (l) => !l.code && /^#{2,6}\s/.test(l.text),
      )
      if (h1.length !== 1 || fn.file.lines[0]?.text !== `# ${fn.title}`)
        fa(1, "F-A16", "1行目を「# <機能名>」の H1 にし、H1 は1つだけにする")
      for (const l of other)
        fa(l.no, "F-A16", "分割ファイルで H2 以下を使わない")
      const link = model.links.find((k) => k.target === `${fn.part}.md`)
      if (link && link.title !== fn.title)
        fa(
          1,
          "F-A16",
          `機能名「${fn.title}」が索引のリンクの名前「${link.title}」と違う`,
        )
    }
    // 行数
    const lines = fn.part ? fn.file.lines.length : fn.lines.length + 1
    if (lines > cfg.maxFunctionLines)
      fa(
        fn.no,
        "F-A13",
        `${where}「${fn.title}」が ${lines} 行（上限 ${cfg.maxFunctionLines} 行）。機能を docs/architecture/<機能>.md に分割する`,
      )
    // 関与
    if (!fn.involved) {
      fa(
        fn.no,
        "F-A10",
        `${where}「${fn.title}」の最初の行を「- 関与: 要素, 要素」にする`,
      )
      continue
    }
    const uniq = new Set(fn.involved)
    if (uniq.size !== fn.involved.length)
      fa(fn.involvedNo, "F-A11", "関与に同じ名前が重複している")
    const [minC, maxC] = cfg.functionComponents
    if (uniq.size < minC || uniq.size > maxC)
      fa(
        fn.involvedNo,
        "F-A11",
        `関与は ${minC}〜${maxC} 件（実際: ${uniq.size} 件）。多いときは機能を分ける`,
      )
    for (const n of uniq)
      if (!names.all.has(n))
        fa(fn.involvedNo, "F-A11", `関与「${n}」が構成要素表にない`)
    const entry = { fn, set: uniq, msgs: new Set() }
    sets.push(entry)
    // 図
    const chapter = { lines: fn.lines.filter((l) => l.no !== fn.involvedNo) }
    const items = splitChapter(chapter, fa)
    const diagrams = []
    for (const it of items) {
      if (!it.block.close) continue
      const d = await analyzeDiagram(it, fa, syntax, { ext: true, minNodes: 2 })
      if (d) diagrams.push(d)
    }
    if (diagrams.length !== 1)
      fa(
        fn.no,
        "F-A10",
        `${where}「${fn.title}」のワークフロー図は1個だけ置く（実際: ${diagrams.length} 個）`,
      )
    const d = diagrams[0]
    if (!d) continue
    if (d.group !== "workflow") {
      fa(
        d.open.no,
        "F-A10",
        "機能の図は sequenceDiagram か stateDiagram-v2 にする",
      )
      continue
    }
    workflow.push(d)
    for (const e of d.edges) if (e.label) entry.msgs.add(e.label)
    if (d.kind === "sequenceDiagram") {
      const labels = new Set()
      for (const n of d.nodes.values()) {
        const ext = n.id.startsWith("ext_")
        if (ext !== names.external.has(n.label) || !names.all.has(n.label))
          fa(
            n.no,
            "F-A11",
            names.all.has(n.label)
              ? `「${n.label}」は構成要素表の${names.external.has(n.label) ? "外部のため ID を ext_ で始める" : "内部のため ext_ を付けない"}`
              : `「${n.label}」は構成要素表にない`,
          )
        labels.add(n.label)
      }
      for (const n of uniq)
        if (!labels.has(n))
          fa(fn.involvedNo, "F-A11", `関与「${n}」がシーケンス図の参加者にない`)
      for (const n of labels)
        if (!uniq.has(n)) fa(d.open.no, "F-A11", `参加者「${n}」が関与にない`)
    }
  }
  // F-A14: 同じ振る舞いの重複（関与の集合と図のメッセージ名の集合がどちらも似ている機能）
  const jaccard = (a, b) => {
    const inter = [...a].filter((x) => b.has(x)).length
    const union = a.size + b.size - inter
    return union === 0 ? 0 : inter / union
  }
  for (let i = 0; i < sets.length; i++)
    for (let j = i + 1; j < sets.length; j++) {
      const simSet = jaccard(sets[i].set, sets[j].set)
      const simMsg = jaccard(sets[i].msgs, sets[j].msgs)
      if (simSet >= cfg.mergeSimilarity && simMsg >= cfg.mergeSimilarity)
        adder(sets[j].fn.file)(
          sets[j].fn.no,
          "F-A14",
          `機能「${sets[j].fn.title}」と「${sets[i].fn.title}」は、関与（類似度 ${simSet.toFixed(2)}）と図のメッセージ名（類似度 ${simMsg.toFixed(2)}）がどちらも ${cfg.mergeSimilarity} 以上で、同じ振る舞いとみなせる。統合する`,
        )
    }
  // F-A15: 内部の要素の網羅
  if (model.functions.length > 0) {
    const inFn = new Set(sets.flatMap((x) => [...x.set]))
    for (const n of [...names.internal].sort())
      if (!inFn.has(n))
        add(
          s5?.no ?? 1,
          "F-A15",
          `内部の要素「${n}」がどの機能の関与にも現れない`,
        )
  }
  if (workflow.length > 0 && !workflow.some(hasBranch))
    add(
      s5?.no ?? 1,
      "G011",
      "ワークフロー図に分岐がない（alt／opt／break、または2本以上の遷移が出る状態を含める）",
    )

  // ---- F-A12: 根拠 ----
  for (const [chapter, col, name] of [
    ["8. 技術基盤", 3, "根拠"],
    ["9. 横断的制約", 2, "根拠"],
  ]) {
    const t = model.table(chapter)
    for (const r of t?.rows ?? []) {
      const cell = r.cells[col] ?? ""
      const refs =
        cell === "" ? [] : cell.replace(/`/g, "").split(/\s*[,、]\s*/)
      if (
        refs.length === 0 ||
        refs.some(
          (x) =>
            !(pocThemeOf(x) !== null || /^[a-z0-9][a-z0-9-]*$/.test(x)) ||
            x === "",
        )
      )
        add(
          r.no,
          "F-A12",
          `${name}は spec 名か poc/<テーマ> を「、」区切りで書く（実際: ${cell}）`,
        )
      if (chapter === "9. 横断的制約" && !/\d/.test(r.cells[1] ?? ""))
        add(r.no, "F-A12", "横断的制約の値は数値を含める")
    }
  }

  // ---- F-A13: 文書の行数 ----
  if (main.lines.length > cfg.maxLines)
    add(
      1,
      "F-A13",
      `${main.lines.length} 行（上限 ${cfg.maxLines} 行）。機能を docs/architecture/<機能>.md に分割し、5 章を索引にする`,
    )
  return out
}

/** 境界図（F-A09）: ノード名と、表の行 ↔ 辺の一対一・向き */
function checkBoundary(d, model, names, add) {
  const nodeInfo = (id) => d.nodes.get(id)
  for (const n of d.nodes.values()) {
    const ext = n.id.startsWith("ext_")
    if (!names.all.has(n.label))
      add(n.no, "F-A09", `「${n.label}」は構成要素表にない`)
    else if (ext !== names.external.has(n.label))
      add(
        n.no,
        "F-A09",
        names.external.has(n.label)
          ? `外部の要素「${n.label}」の ID は ext_ で始める`
          : `内部の要素「${n.label}」の ID に ext_ を付けない`,
      )
  }
  const matched = new Set()
  for (const e of d.edges) {
    const row = model.interfaces.find((i) => i.name === e.label)
    if (!row) {
      add(
        e.no,
        "F-A09",
        `辺の名前「${e.label}」が外部インターフェース表の IF にない`,
      )
      continue
    }
    matched.add(row.name)
    const from = nodeInfo(e.from)?.label
    const to = nodeInfo(e.to)?.label
    const want = row.dir === "提供" ? [row.ext, row.int] : [row.int, row.ext]
    if (from !== want[0] || to !== want[1])
      add(
        e.no,
        "F-A09",
        `IF「${row.name}」は方向「${row.dir}」のため「${want[0]} → ${want[1]}」にする（実際: ${from} → ${to}）`,
      )
  }
  for (const i of model.interfaces)
    if (!matched.has(i.name))
      add(d.open.no, "F-A09", `IF「${i.name}」の辺が境界図にない`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCli([{ title, rules, check }])
}
