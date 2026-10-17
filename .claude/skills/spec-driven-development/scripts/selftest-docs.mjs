/**
 * architecture・PoC・設定・補助コマンドの自己テスト（selftest.mjs から読み込まれる）。
 *
 * - 雛形（architecture.md・poc-readme.md）が、3 つの spec を持つリポジトリでチェックを通過すること
 * - 雛形を1か所ずつ崩したとき、対応するルールが検出されること（docCases。全ルール ID の網羅は selftest.mjs が強制する）
 * - 設定ファイル・--status・--retarget-poc・--check-poc-committed の挙動
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  checkAll,
  depsProblem,
  makeRoot,
  rulesOf,
  run,
  runFull,
  templates,
} from "./selftest-lib.mjs"

const read = (f) => fs.readFileSync(path.join(templates, f), "utf8")

/** architecture の雛形が参照する spec 名（雛形のとおり設計済みの spec として作る） */
export const ARCH_SPECS = [
  "notification-badge",
  "notification-api",
  "delivery-worker",
]

const ARCH = "../docs/architecture.md"
const POC = "../poc/storage-cost/README.md"
const DEFAULTS = {
  [ARCH]: () => read("architecture.md"),
  [POC]: () => read("poc-readme.md"),
  "../poc/storage-cost/measure.md": () => "測定値\n",
}

/** architecture と PoC の雛形を配置した edits。edits のキーが既定の配置先なら、雛形に対する編集になる */
export function arch(edits = {}) {
  const out = {}
  for (const [k, def] of Object.entries(DEFAULTS))
    out[k] =
      k in edits ? (edits[k] === null ? null : () => edits[k](def())) : def
  for (const [k, v] of Object.entries(edits)) if (!(k in DEFAULTS)) out[k] = v
  return out
}

const a = (fn) => arch({ [ARCH]: fn })
const p = (fn) => arch({ [POC]: fn })

const rep = (from, to) => (t) => {
  assert.ok(t.includes(from), `置換元が雛形にない: ${from}`)
  return t.replace(from, to)
}
const sub = (re, to) => (t) => {
  assert.ok(re.test(t), `置換元が雛形にない: ${re}`)
  return t.replace(re, to)
}

/** 1 つ目の機能（通知の発行）の本文を雛形から取り出す */
const FIRST_FUNCTION = read("architecture.md")
  .match(/### 通知の発行\n\n([\s\S]*?)(?=### 未読件数の表示)/)[1]
  .trimEnd()
const PART = "../docs/architecture/notification-publish.md"
const SPLIT_INDEX =
  "- [通知の発行](architecture/notification-publish.md): 配信ワーカーは、宛先の有効性に応じて通知を受理か拒否に分ける。\n\n"
/** 1 つ目の機能を分割ファイルへ移した edits */
const split = (partEdit = (t) => t, archEdit = (t) => t) =>
  arch({
    [ARCH]: (t) =>
      archEdit(
        sub(/### 通知の発行\n[\s\S]*?(?=### 未読件数の表示)/, SPLIT_INDEX)(t),
      ),
    [PART]: () => partEdit(`# 通知の発行\n\n${FIRST_FUNCTION}\n`),
  })

/** 検証中の PoC（結論なし・結果なし・反映先なし） */
const pendingPoc = () =>
  read("poc-readme.md")
    .replace("1 宛先あたり 1000 件の保管は、無料枠の範囲に収まる。", "- なし")
    .replace("- delivery-worker", "- なし")
    .replace("| 合   |", "| -    |")

// [説明, edits, 期待ルール, 追加 spec 名]
export const docCases = [
  [
    "設計書の図で円柱を使う",
    {
      "sample/design.md": rep(
        '  unreadCount --> ext_agent["Agent"]',
        '  unreadCount --> ext_agent[("Agent")]',
      ),
    },
    "G015",
  ],
  ["設計済み spec が閾値以上で architecture.md がない", {}, "S010", ARCH_SPECS],
  [
    "分割ファイル名が不正",
    arch({ "../docs/architecture/Bad_Name.md": () => "# x\n" }),
    "S011",
    ARCH_SPECS,
  ],
  [
    "分割ファイルが索引からリンクされていない",
    arch({ [PART]: () => `# 通知の発行\n\n${FIRST_FUNCTION}\n` }),
    "S011",
    ARCH_SPECS,
  ],
  [
    "設計済み spec が実装spec にない",
    arch(),
    "S012",
    [...ARCH_SPECS, "extra-spec"],
  ],
  [
    "根拠の spec が存在しない",
    a(sub(/delivery-worker {2}\|/, "ghost-spec     |")),
    "S013",
    ARCH_SPECS,
  ],
  ["PoC に README.md がない", arch({ [POC]: null }), "S014", ARCH_SPECS],
  [
    "PoC の反映先 spec が存在しない",
    p(rep("- delivery-worker", "- ghost-spec")),
    "S015",
    ARCH_SPECS,
  ],
  [
    "反映先 spec が完了した PoC が残っている",
    arch({ "delivery-worker/tasks.md": (t) => t.replaceAll("- [ ]", "- [x]") }),
    "S016",
    ARCH_SPECS,
  ],
  [
    "反映先 spec が完了した PoC を根拠に持つ行が残っている",
    arch({ "delivery-worker/tasks.md": (t) => t.replaceAll("- [ ]", "- [x]") }),
    "S018",
    ARCH_SPECS,
  ],
  [
    "反映済みでない PoC が上限を超える",
    arch({
      "../.spec-driven.json": () => JSON.stringify({ poc: { maxPending: 1 } }),
      "../poc/second/README.md": pendingPoc,
      "../poc/second/measure.md": () => "x\n",
      "../poc/third/README.md": pendingPoc,
      "../poc/third/measure.md": () => "x\n",
    }),
    "S017",
    ARCH_SPECS,
  ],
  [
    "architecture の H1",
    a(rep("# 通知配信サービス アーキテクチャ", "# 通知配信サービス 設計")),
    "F-A01",
    ARCH_SPECS,
  ],
  [
    "architecture の H2",
    a(rep("## 9. 横断的制約", "## 9. 制約")),
    "F-A02",
    ARCH_SPECS,
  ],
  [
    "構成要素の章に H3",
    a(rep("## 2. 構成要素\n", "## 2. 構成要素\n\n### 補足\n")),
    "F-A03",
    ARCH_SPECS,
  ],
  [
    "目的と範囲に箇条書き",
    a(
      rep(
        "通知配信サービスは、利用者の画面",
        "- 箇条書き。\n通知配信サービスは、利用者の画面",
      ),
    ),
    "F-A04",
    ARCH_SPECS,
  ],
  ["表の列見出しが違う", a(rep("方式", "手段")), "F-A05", ARCH_SPECS],
  [
    "種別が内部・外部でない",
    a(rep("| 内部 | 通知を宛先ごと", "| 中間 | 通知を宛先ごと")),
    "F-A06",
    ARCH_SPECS,
  ],
  [
    "IF の方向が不正",
    a(rep("| 提供 | 利用者 ", "| 受信 | 利用者 ")),
    "F-A07",
    ARCH_SPECS,
  ],
  [
    "内部の要素が関係図にない",
    a(rep('  api --> worker["配信ワーカー"]\n', "")),
    "F-A08",
    ARCH_SPECS,
  ],
  [
    "境界図の辺の名前が IF にない",
    a(rep("|通知表示|", "|通知閲覧|")),
    "F-A09",
    ARCH_SPECS,
  ],
  [
    "機能に関与の行がない",
    a(rep("- 関与: 発行元システム、配信ワーカー\n\n", "")),
    "F-A10",
    ARCH_SPECS,
  ],
  [
    "関与が構成要素表にない",
    a(
      rep(
        "- 関与: 発行元システム、配信ワーカー\n",
        "- 関与: 発行元システム、配信ワーカー、存在しない要素\n",
      ),
    ),
    "F-A11",
    ARCH_SPECS,
  ],
  [
    "根拠が spec 名でも poc/<テーマ> でもない",
    a(sub(/delivery-worker {2}\|/, "配信ワーカー  |")),
    "F-A12",
    ARCH_SPECS,
  ],
  [
    "機能が行数の上限を超える",
    a(
      sub(
        /(sequenceDiagram\n)(  participant ext_source)/,
        `$1${"  %% 補足\n".repeat(80)}$2`,
      ),
    ),
    "F-A13",
    ARCH_SPECS,
  ],
  [
    "関与が似た機能が複数ある",
    a(
      rep(
        "- 関与: 通知バッジ、通知API、配信ワーカー",
        "- 関与: 発行元システム、配信ワーカー",
      ),
    ),
    "F-A14",
    ARCH_SPECS,
  ],
  [
    "どの機能にも現れない内部の要素がある",
    a(
      rep(
        "| 配信ワーカー   | 内部 | 通知を宛先ごとに振り分けて保管する | delivery-worker    |\n",
        "| 配信ワーカー   | 内部 | 通知を宛先ごとに振り分けて保管する | delivery-worker    |\n| 監視           | 内部 | 稼働状況を記録する | delivery-worker    |\n",
      ),
    ),
    "F-A15",
    ARCH_SPECS,
  ],
  [
    "分割ファイルの機能名が索引と違う",
    split(rep("# 通知の発行", "# 別の名前")),
    "F-A16",
    ARCH_SPECS,
  ],
  [
    "機能の図に分岐がない",
    a(
      sub(
        / {2}alt 宛先が有効[\s\S]*? {2}end\n/,
        "  worker-->>ext_source: 受理\n",
      ),
    ),
    "G011",
    ARCH_SPECS,
  ],
  [
    "経緯・時点の語",
    a(rep("このサービスの対象外である。", "2026年の対象外である。")),
    "W009",
    ARCH_SPECS,
  ],
  [
    "文が「。」で終わらない",
    a(rep("このサービスの対象外である。", "このサービスの対象外")),
    "W010",
    ARCH_SPECS,
  ],
  [
    "表の文の列が体言止め",
    a(rep("未読件数を集計して返す", "未読件数の集計")),
    "W010",
    ARCH_SPECS,
  ],
  ["指示語", a(rep("このサービスの", "それの")), "W011", ARCH_SPECS],
  [
    "主語を示す助詞がない",
    a(rep("通知配信サービスは、利用者の画面へ", "利用者の画面へ")),
    "W012",
    ARCH_SPECS,
  ],
  [
    "地の文に spec 名",
    a(rep("このサービスの対象外である。", "delivery-worker の対象外である。")),
    "W013",
    ARCH_SPECS,
  ],
  [
    "spec と同じ行",
    a(
      rep(
        "通知の発行元システムは、このサービスの対象外である。",
        "未読の通知件数をヘッダーに表示し、利用者が新着通知に気付けるようにする。",
      ),
    ),
    "W014",
    ARCH_SPECS,
  ],
  [
    "PoC の H1",
    p(rep("# ストレージ費用 PoC", "# ストレージ費用")),
    "F-P01",
    ARCH_SPECS,
  ],
  ["PoC の H2", p(rep("## 5. 手順と結果", "## 5. 手順")), "F-P02", ARCH_SPECS],
  [
    "PoC の結論が箇条書き",
    p(
      rep("1 宛先あたり 1000 件の保管は、無料枠の範囲に収まる。", "- 箇条書き"),
    ),
    "F-P03",
    ARCH_SPECS,
  ],
  [
    "PoC の反映先が複数",
    p(rep("- delivery-worker", "- delivery-worker、notification-api")),
    "F-P04",
    ARCH_SPECS,
  ],
  [
    "PoC の制約値に数値がない",
    p(rep("| 1000 件 |", "| 多い |")),
    "F-P05",
    ARCH_SPECS,
  ],
  [
    "PoC の結果が合・否・- でない",
    p(rep("| 合   |", "| 良   |")),
    "F-P06",
    ARCH_SPECS,
  ],
  [
    "PoC のリンク先が存在しない",
    p(rep("(measure.md)", "(missing.md)")),
    "F-P07",
    ARCH_SPECS,
  ],
  [
    "PoC の結論があるのに結果が未記入",
    p(rep("| 合   |", "| -    |")),
    "F-P08",
    ARCH_SPECS,
  ],
  [
    "PoC の README が行数の上限を超える",
    p((t) => t + "- [測定手順と測定値](measure.md)\n".repeat(110)),
    "F-P09",
    ARCH_SPECS,
  ],
  [
    "architecture の図が Mermaid の構文エラー",
    a(rep('  api --> worker["配信ワーカー"]\n', "  api --> end\n")),
    "G014",
    ARCH_SPECS,
  ],
  [
    "PoC の README に曖昧語",
    p(rep("無料枠の範囲に収まる。", "無料枠の範囲に収まるなど。")),
    "W002",
    ARCH_SPECS,
  ],
]

for (const [name, edits, rule, specNames] of docCases) {
  test(`${rule}: ${name}`, () => {
    if (rule === "G014") assert.equal(depsProblem, null, depsProblem)
    const r = (rule === "G014" ? runFull : run)(makeRoot(edits, specNames))
    assert.equal(r.code, 1, r.stderr)
    assert.ok(
      rulesOf(r.findings).includes(rule),
      `${rule} が検出されない: ${JSON.stringify(rulesOf(r.findings))}`,
    )
  })
}

// ---------------------------------------------------------------------------

test("architecture と PoC の雛形はすべてのチェックを通過する", () => {
  assert.equal(depsProblem, null, depsProblem)
  const r = runFull(makeRoot(arch(), ARCH_SPECS))
  assert.deepEqual(r.findings, [])
  assert.equal(r.code, 0)
})

test("architecture の出力は冪等", () => {
  const root = makeRoot(a(rep("このサービスの", "それの")), ARCH_SPECS)
  assert.deepEqual(run(root), run(root))
})

test("機能を分割ファイルへ移しても通過する", () => {
  const r = runFull(makeRoot(split(), ARCH_SPECS))
  assert.deepEqual(r.findings, [])
})

test("architecture の W001・W004 は経緯・進捗の語を検出する", () => {
  const r = run(makeRoot(a(rep("このサービスの", "従来の今後の")), ARCH_SPECS))
  assert.ok(rulesOf(r.findings).includes("W004"), JSON.stringify(r.findings))
  assert.ok(rulesOf(r.findings).includes("W001"), JSON.stringify(r.findings))
})

test("architecture の3章で関係図が循環すると G009 を検出する", () => {
  const r = run(
    makeRoot(
      a(
        rep(
          '  api --> worker["配信ワーカー"]\n',
          '  api --> worker["配信ワーカー"]\n  worker --> badge\n',
        ),
      ),
      ARCH_SPECS,
    ),
  )
  assert.ok(rulesOf(r.findings).includes("G009"), JSON.stringify(r.findings))
})

test("要件のみの spec は S003 の対象外で、閾値の計数にも実装spec にも含まれない", () => {
  const future = { "future/requirements.md": () => read("requirements.md") }
  assert.deepEqual(
    run(makeRoot(future, ["notification-api", "delivery-worker"])).findings,
    [],
  )
  const listed = run(
    makeRoot(
      arch({
        ...future,
        [ARCH]: rep("| delivery-worker    |", "| delivery-worker, future |"),
      }),
      ARCH_SPECS,
    ),
  )
  assert.ok(
    rulesOf(listed.findings).includes("S012"),
    JSON.stringify(listed.findings),
  )
})

test("閾値は設定で調整できる（spec 数が閾値未満なら architecture.md は任意）", () => {
  const cfg = {
    "../.spec-driven.json": () =>
      JSON.stringify({ architecture: { minSpecs: 4 } }),
  }
  assert.deepEqual(run(makeRoot(cfg, ARCH_SPECS)).findings, [])
})

test("設定ファイルの誤りは終了コード 2 で止まる", () => {
  const bad = [
    ["JSON でない", "{"],
    ["未知のキー", '{"unknown": 1}'],
    ["未知の項目", '{"poc": {"nothing": 1}}'],
    ["範囲外（下限）", '{"architecture": {"minSpecs": 0}}'],
    ["範囲外（上限）", '{"poc": {"maxPending": 11}}'],
    ["型違い", '{"architecture": {"maxLines": "400"}}'],
    ["関与数の逆転", '{"architecture": {"functionComponents": [6, 2]}}'],
  ]
  for (const [name, text] of bad) {
    const r = run(makeRoot({ "../.spec-driven.json": () => text }))
    assert.equal(r.code, 2, `${name}: ${r.stderr}`)
  }
})

test("--show-config は実効値を表示する", () => {
  const root = makeRoot({
    "../.spec-driven.json": () => JSON.stringify({ poc: { maxPending: 5 } }),
  })
  const r = spawnSync(
    process.execPath,
    [checkAll, "--root", "specs", "--show-config"],
    { cwd: root, encoding: "utf8" },
  )
  const cfg = JSON.parse(r.stdout)
  assert.equal(cfg.poc.maxPending, 5)
  assert.equal(cfg.architecture.minSpecs, 3)
  assert.deepEqual(cfg.architecture.functionComponents, [2, 6])
})

test("architecture・PoC を対象に指定できる", () => {
  const root = makeRoot(arch(), ARCH_SPECS)
  assert.equal(run(root, "architecture").code, 0)
  assert.equal(run(root, "poc/storage-cost").code, 0)
  assert.equal(run(root, "poc/missing").code, 2)
})

test("--status は成果物から工程を導出する", () => {
  const root = makeRoot(
    arch({ "delivery-worker/tasks.md": (t) => t.replace("- [ ]", "- [x]") }),
    ARCH_SPECS,
  )
  const r = spawnSync(
    process.execPath,
    [checkAll, "--root", "specs", "--status", "--json"],
    { cwd: root, encoding: "utf8" },
  )
  assert.equal(r.status, 0, r.stderr)
  const m = JSON.parse(r.stdout)
  assert.equal(
    m.specs.find((s) => s.name === "delivery-worker").state,
    "進行中",
  )
  assert.equal(
    m.specs.find((s) => s.name === "notification-api").state,
    "着手前",
  )
  assert.deepEqual(m.pocs, [
    {
      name: "storage-cost",
      state: "反映済み",
      target: "delivery-worker",
      remove: false,
    },
  ])
  assert.equal(m.architecture.required, true)
  assert.equal(m.architecture.crossFindings, 0)
})

test("PoC の状態: 結論なしは検証中、反映先なしは反映待ち", () => {
  const status = (edit) => {
    const root = makeRoot(arch({ [POC]: edit }), ARCH_SPECS)
    const r = spawnSync(
      process.execPath,
      [checkAll, "--root", "specs", "--status", "--json"],
      { cwd: root, encoding: "utf8" },
    )
    return JSON.parse(r.stdout).pocs[0].state
  }
  assert.equal(status(pendingPoc), "検証中")
  assert.equal(status(rep("- delivery-worker", "- なし")), "反映待ち")
})

// ---- --retarget-poc ----

test("--retarget-poc は根拠の poc/<テーマ> を反映先 spec へ付け替える（既定は表示のみ）", () => {
  const root = makeRoot(arch(), ARCH_SPECS)
  const file = path.join(root, "docs", "architecture.md")
  const before = fs.readFileSync(file, "utf8")
  const cli = (...args) =>
    spawnSync(
      process.execPath,
      [checkAll, "--root", "specs", "--retarget-poc", "storage-cost", ...args],
      { cwd: root, encoding: "utf8" },
    )
  const dry = cli()
  assert.equal(dry.status, 0, dry.stderr)
  assert.match(dry.stdout, /poc\/storage-cost → delivery-worker/)
  assert.equal(fs.readFileSync(file, "utf8"), before)
  const w = cli("--write")
  assert.equal(w.status, 0, w.stderr)
  const after = fs.readFileSync(file, "utf8")
  assert.ok(!after.includes("poc/storage-cost"))
  assert.equal(after.split("\n").length, before.split("\n").length)
  assert.match(
    after,
    /\| 1 宛先あたりの保管件数 \| 1000 件 +\| delivery-worker/,
  )
  assert.match(after, /\| データ保管 .*\| delivery-worker/)
  // 付け替え後に再実行しても対象がない
  assert.match(cli().stdout, /付け替え対象なし/)
})

test("--retarget-poc は反映先が決まらない PoC を拒否する", () => {
  const root = makeRoot(
    arch({ [POC]: rep("- delivery-worker", "- なし") }),
    ARCH_SPECS,
  )
  const r = spawnSync(
    process.execPath,
    [checkAll, "--root", "specs", "--retarget-poc", "storage-cost"],
    { cwd: root, encoding: "utf8" },
  )
  assert.equal(r.status, 2)
  assert.match(r.stderr, /反映先/)
})

// ---- --check-poc-committed ----

const git = (cwd, ...args) =>
  spawnSync(
    "git",
    [
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@example.com",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd, encoding: "utf8" },
  )
const check = (root, theme) =>
  spawnSync(
    process.execPath,
    [checkAll, "--root", "specs", "--check-poc-committed", theme],
    { cwd: root, encoding: "utf8" },
  )

test("--check-poc-committed: 追跡外は 2、未コミットは 1、コミット済みは 0", () => {
  const root = makeRoot(arch(), ARCH_SPECS)
  // git 管理外
  assert.equal(check(root, "storage-cost").status, 2)
  git(root, "init", "-q")
  // 追跡外
  assert.equal(check(root, "storage-cost").status, 2)
  git(root, "add", "-A")
  // ステージ済みで未コミット
  assert.equal(check(root, "storage-cost").status, 1)
  git(root, "commit", "-q", "-m", "init")
  assert.equal(check(root, "storage-cost").status, 0)
  // コミット後の変更
  fs.appendFileSync(
    path.join(root, "poc", "storage-cost", "measure.md"),
    "追記\n",
  )
  assert.equal(check(root, "storage-cost").status, 1)
  // 追跡済みディレクトリに未追跡のファイルを足した場合
  git(root, "checkout", "--", ".")
  fs.writeFileSync(path.join(root, "poc", "storage-cost", "extra.md"), "x\n")
  assert.equal(check(root, "storage-cost").status, 1)
  // 不正なテーマ名・存在しないテーマ
  assert.equal(check(root, "../specs").status, 2)
  assert.equal(check(root, "missing").status, 2)
})

test("51 件の spec でも検査が現実的な時間で終わる", () => {
  const names = Array.from(
    { length: 51 },
    (_, i) => `spec-${String(i).padStart(2, "0")}`,
  )
  const t0 = Date.now()
  const r = run(makeRoot({}, names))
  assert.deepEqual(rulesOf(r.findings), ["S010"])
  assert.ok(Date.now() - t0 < 30000, `${Date.now() - t0} ミリ秒`)
})
