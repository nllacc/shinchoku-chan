// 使い方: node scripts/dev-seed.mjs | npx wrangler d1 execute shinchoku-chan --local --file /dev/stdin
// ローカルの確認用に、評価が確定した架空の作業を投入する SQL を出力する(本番では使わない)
const COUNT = Number(process.argv[2] ?? 60)
const BASE = Date.parse("2026-10-01T00:00:00+09:00")
const DAY = 86_400_000
const q = (s) => `'${String(s).replaceAll("'", "''")}'`

const themes = [
  ["毎日走る", "5km ランニングを毎日続ける", "距離", "km"],
  ["英単語を覚える", "英単語を 100 語覚えて、毎日小テストで確認します。通勤の電車の中で取り組みます", "単語数", "語"],
  ["筋トレ", "腕立て伏せの回数を増やす", "回数", "回"],
  ["読書", "技術書を 1 冊読み切る", "ページ", "ページ"],
  ["貯金", "月末までに 3 万円を貯める", "金額", "円"],
]

const out = ["DELETE FROM evaluations;", "DELETE FROM reports;", "DELETE FROM tasks;"]
for (let i = 1; i <= COUNT; i++) {
  const [title, goal, metric, unit] = themes[i % themes.length]
  const id = `seed${String(i).padStart(3, "0")}`
  const handle = `demo${i}.bsky.social`
  const started = BASE + (i % 20) * DAY
  const days = (i % 7) + 1
  const rate = Math.max(0, 1100 - ((i * 37) % 1000))
  const score = Math.max(0, 9800 - ((i * 211) % 9500))
  const summary = `${goal}。${i % 4 === 0 ? "途中で体調を崩しても、できる範囲で続けることを目標にします。".repeat(3) : ""}`
  out.push(
    `INSERT INTO tasks (id, did, handle, task_uri, task_cid, anchor_uri, anchor_cid, enrollment_uri, enrollment_cid, pds, title, summary, goal, metric_name, metric_unit, scale, start_value, goal_value, duration_days, daily_target, windows, started_at, ends_at, evidence_required, priority, status, result_state) VALUES (${[
      q(id), q(`did:plc:seed${i}`), q(handle), q(`at://did:plc:seed${i}/x.task/${id}`), q("bafyseed"), q(`at://did:plc:seed${i}/app.bsky.feed.post/${id}`), q("bafyseed"),
      q(`at://did:plc:bot/x.enrollment/${id}`), q("bafyseed"), q("https://pds.invalid"), q(title), q(summary), q(goal), q(metric), q(unit), 0, 0, 100, days, 1, q("[]"), started, started + days * DAY, 0, 0, q("ended"), q("accepted"),
    ].join(", ")});`,
    `INSERT INTO evaluations (task_id, handle, summary, duration_days, score_hundredths, final_rate_permille, missing_count, algorithm, finalized_at) VALUES (${[
      q(id), q(handle), q(summary), days, score, rate, i % 3, q("v1"), started + days * DAY,
    ].join(", ")});`,
  )
  if (i % 5 === 0) {
    out.push(
      `INSERT INTO reports (checkin_id, task_id, kind, receipt_uri, receipt_cid, record_uri, record_cid, value, received_at, note) VALUES (${[
        q(`ck${id}`), q(id), q("result"), q("at://x/r/1"), q("bafyseed"), q("at://x/r/2"), q("bafyseed"), 100, started + days * DAY, q("最後までやり切りました。次も続けます。"),
      ].join(", ")});`,
    )
  }
}
console.log(out.join("\n"))
