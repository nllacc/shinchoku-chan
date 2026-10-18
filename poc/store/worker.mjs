// 保存先の契約を D1 で実現するときの、D1 固有の挙動を測る検証用 Worker
// GET /run で全項目を実行して結果の JSON を返す。使う表は poc_ で始まり、最後に削除する
const SCHEMA = [
  `CREATE TABLE poc_tasks (id TEXT PRIMARY KEY, did TEXT NOT NULL, status TEXT NOT NULL, ends_at INTEGER NOT NULL,
    checked_at INTEGER NOT NULL DEFAULT 0, last_notified_day INTEGER, notified_windows INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL)`,
  `CREATE INDEX poc_tasks_did_status ON poc_tasks (did, status)`,
  `CREATE INDEX poc_tasks_status_ends ON poc_tasks (status, ends_at)`,
  `CREATE INDEX poc_tasks_checked ON poc_tasks (status, checked_at)`,
  `CREATE TABLE poc_eval (task_id TEXT PRIMARY KEY, visible INTEGER NOT NULL, score INTEGER NOT NULL, finalized_at INTEGER NOT NULL,
    stale INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL)`,
  `CREATE INDEX poc_eval_score ON poc_eval (visible, score DESC, finalized_at DESC, task_id DESC)`,
  `CREATE INDEX poc_eval_stale ON poc_eval (stale)`,
  `CREATE TABLE poc_plans (day_start INTEGER PRIMARY KEY, triggers TEXT NOT NULL)`,
]

const task = (i, over = {}) => ({
  id: `t${String(i).padStart(5, "0")}`, did: `did:plc:u${i % 50}`, status: "active", ends_at: 1_000_000 + i,
  checked_at: i, last_notified_day: null, notified_windows: 0, payload: "x".repeat(1500), ...over,
})
const insertTask = (db, t) => db.prepare(
  `INSERT OR REPLACE INTO poc_tasks (id, did, status, ends_at, checked_at, last_notified_day, notified_windows, payload) VALUES (?,?,?,?,?,?,?,?)`,
).bind(t.id, t.did, t.status, t.ends_at, t.checked_at, t.last_notified_day, t.notified_windows, t.payload)

export default {
  async fetch(req, env) {
    if (new URL(req.url).pathname !== "/run") return new Response("GET /run", { status: 404 })
    const db = env.DB
    const out = []
    const rec = (name, ok, detail) => out.push({ name, ok, detail })
    const guard = async (name, fn) => { try { await fn() } catch (e) { rec(name, false, `例外: ${e.message}`) } }

    for (const t of ["poc_tasks", "poc_eval", "poc_plans"]) await db.prepare(`DROP TABLE IF EXISTS ${t}`).run()
    for (const s of SCHEMA) await db.prepare(s).run()

    // 1. 行の書き込み数（索引の分が加わるか）
    await guard("rows_written", async () => {
      const ins = await insertTask(db, task(1)).run()
      const nonIdx = await db.prepare(`UPDATE poc_tasks SET last_notified_day = 5, notified_windows = 1 WHERE id = ?`).bind("t00001").run()
      const idx = await db.prepare(`UPDATE poc_tasks SET checked_at = 999 WHERE id = ?`).bind("t00001").run()
      const del = await db.prepare(`DELETE FROM poc_tasks WHERE id = ?`).bind("t00001").run()
      rec("rows_written", true, { insert: ins.meta.rows_written, updateNonIndexed: nonIdx.meta.rows_written, updateIndexed: idx.meta.rows_written, delete: del.meta.rows_written })
    })

    // 1b. 既存行への put（置換と upsert の書き込み行数）
    await guard("upsert", async () => {
      await insertTask(db, task(2)).run()
      const rep = await insertTask(db, task(2, { payload: "z" })).run()
      const t = task(2, { payload: "w" })
      const ups = await db.prepare(
        `INSERT INTO poc_tasks (id, did, status, ends_at, checked_at, last_notified_day, notified_windows, payload) VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET did=excluded.did, status=excluded.status, ends_at=excluded.ends_at, checked_at=excluded.checked_at,
         last_notified_day=excluded.last_notified_day, notified_windows=excluded.notified_windows, payload=excluded.payload`,
      ).bind(t.id, t.did, t.status, t.ends_at, t.checked_at, t.last_notified_day, t.notified_windows, t.payload).run()
      rec("既存行への put の書き込み行数", true, { insertOrReplace: rep.meta.rows_written, upsert: ups.meta.rows_written })
    })

    // 2. batch の上限と所要時間（putMany）
    await guard("batch", async () => {
      for (const n of [100, 500, 1000]) {
        const t0 = Date.now()
        const res = await db.batch(Array.from({ length: n }, (_, i) => insertTask(db, task(i + 10_000 * n / 100))))
        rec(`batch ${n} 件`, res.length === n, { ms: Date.now() - t0, rowsWritten: res.reduce((a, r) => a + r.meta.rows_written, 0) })
      }
    })
    await guard("batch 逐次との比較", async () => {
      const t0 = Date.now()
      for (let i = 0; i < 20; i++) await insertTask(db, task(50_000 + i)).run()
      const seq = Date.now() - t0
      const t1 = Date.now()
      await db.batch(Array.from({ length: 20 }, (_, i) => insertTask(db, task(60_000 + i))))
      rec("20 件の逐次と batch", true, { sequentialMs: seq, batchMs: Date.now() - t1 })
    })

    // 3. getMany（IN 句の束縛変数の上限）
    await guard("getMany", async () => {
      const ids = (n) => Array.from({ length: n }, (_, i) => `t${String(i).padStart(5, "0")}`)
      for (const n of [90, 100, 101, 500]) {
        try {
          const r = await db.prepare(`SELECT id FROM poc_tasks WHERE id IN (${ids(n).map(() => "?").join(",")})`).bind(...ids(n)).all()
          rec(`IN ${n} 個`, true, { rows: r.results.length, rowsRead: r.meta.rows_read })
        } catch (e) { rec(`IN ${n} 個`, false, e.message.slice(0, 120)) }
      }
    })

    // 4. putIfAbsent（先に保存された行を返す）
    await guard("putIfAbsent", async () => {
      const put = async (day, trig) => {
        const [, sel] = await db.batch([
          db.prepare(`INSERT OR IGNORE INTO poc_plans (day_start, triggers) VALUES (?, ?)`).bind(day, trig),
          db.prepare(`SELECT triggers FROM poc_plans WHERE day_start = ?`).bind(day),
        ])
        return sel.results[0].triggers
      }
      const results = await Promise.all(Array.from({ length: 20 }, (_, i) => put(777, `plan-${i}`)))
      rec("putIfAbsent 20 並列で全員が同じ計画を得る", new Set(results).size === 1, { distinct: new Set(results).size, stored: results[0] })
    })

    // 5. 存在しない主キーの patch
    await guard("patch 欠落", async () => {
      const r = await db.prepare(`UPDATE poc_tasks SET status = 'ended' WHERE id = ?`).bind("nothing").run()
      rec("存在しない主キーの patch は例外にならず changes が 0", r.meta.changes === 0, { changes: r.meta.changes })
    })

    // 6. 評価の一覧（行値比較のキーセット・ページ送り）
    await guard("page", async () => {
      await db.batch(Array.from({ length: 300 }, (_, i) => db.prepare(
        `INSERT INTO poc_eval (task_id, visible, score, finalized_at, stale, payload) VALUES (?,?,?,?,?,?)`,
      ).bind(`e${String(i).padStart(4, "0")}`, i % 10 === 0 ? 0 : 1, 1000 + (i % 7) * 10, 5000 + (i % 3), 0, "y".repeat(400))))
      const seen = []; let cursor = null; let maxRead = 0; let pages = 0
      for (;;) {
        const q = cursor
          ? db.prepare(`SELECT task_id, score, finalized_at FROM poc_eval WHERE visible = 1 AND (score, finalized_at, task_id) < (?,?,?) ORDER BY score DESC, finalized_at DESC, task_id DESC LIMIT 51`).bind(...cursor)
          : db.prepare(`SELECT task_id, score, finalized_at FROM poc_eval WHERE visible = 1 ORDER BY score DESC, finalized_at DESC, task_id DESC LIMIT 51`)
        const r = await q.all(); pages++
        maxRead = Math.max(maxRead, r.meta.rows_read)
        const rows = r.results.slice(0, 50); seen.push(...rows.map((x) => x.task_id))
        if (r.results.length < 51) break
        const last = rows[rows.length - 1]; cursor = [last.score, last.finalized_at, last.task_id]
      }
      rec("同点を含む一覧の重複・欠落がない", new Set(seen).size === seen.length && seen.length === 270, { seen: seen.length, distinct: new Set(seen).size, pages })
      rec("一覧 1 ページの読み取り行数", maxRead <= 60, { maxRowsRead: maxRead })
    })

    // 7. 索引つきの期限検索の読み取り行数
    await guard("リスト", async () => {
      const a = await db.prepare(`SELECT id FROM poc_tasks WHERE status = 'active' AND checked_at < ? ORDER BY checked_at LIMIT 10`).bind(100_000).all()
      const b = await db.prepare(`SELECT id FROM poc_tasks WHERE status = 'active' AND ends_at <= ? ORDER BY ends_at LIMIT 150`).bind(0).all()
      const c = await db.prepare(`SELECT id FROM poc_tasks WHERE status = 'active' AND ends_at > ? ORDER BY ends_at LIMIT 150`).bind(0).all()
      rec("期限の来た対象が 0 件の読み取り", b.meta.rows_read <= 1, { rowsRead: b.meta.rows_read })
      rec("再確認の対象 10 件の読み取り", a.meta.rows_read <= 12, { rowsRead: a.meta.rows_read, rows: a.results.length })
      rec("候補 150 件の読み取り", c.meta.rows_read <= 160, { rowsRead: c.meta.rows_read, rows: c.results.length })
    })

    for (const t of ["poc_tasks", "poc_eval", "poc_plans"]) await db.prepare(`DROP TABLE IF EXISTS ${t}`).run()
    return Response.json({ all: out.every((x) => x.ok), results: out })
  },
}
