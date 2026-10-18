// D1 による保存先の契約の実装。1 操作は D1 への呼び出し 1 回（batch を含む）で済ませる
import type { DataStore, EvaluationRow, OpenCheckinRow, PlanRow, ReportRow, TaskRow } from "./store"
import { minuteOfDay, slotToWindow, type Slot } from "./time"

// 項目の型: s 文字列、n 数値、b 真偽（0 と 1）、j JSON の文字列
type Kind = "s" | "n" | "b" | "j"
type Spec = { table: string; pk: string; cols: [field: string, column: string, kind: Kind][] }

const TASKS: Spec = {
  table: "tasks",
  pk: "id",
  cols: [
    ["id", "id", "s"], ["did", "did", "s"], ["handle", "handle", "s"],
    ["taskUri", "task_uri", "s"], ["taskCid", "task_cid", "s"],
    ["anchorUri", "anchor_uri", "s"], ["anchorCid", "anchor_cid", "s"],
    ["enrollmentUri", "enrollment_uri", "s"], ["enrollmentCid", "enrollment_cid", "s"], ["pds", "pds", "s"],
    ["title", "title", "s"], ["summary", "summary", "s"], ["goal", "goal", "s"],
    ["metricName", "metric_name", "s"], ["metricUnit", "metric_unit", "s"],
    ["scale", "scale", "n"], ["startValue", "start_value", "n"], ["goalValue", "goal_value", "n"],
    ["durationDays", "duration_days", "n"], ["dailyTarget", "daily_target", "n"], ["windows", "windows", "j"],
    ["startedAt", "started_at", "n"], ["endsAt", "ends_at", "n"],
    ["evidenceRequired", "evidence_required", "b"], ["priority", "priority", "b"],
    ["status", "status", "s"], ["resultState", "result_state", "s"],
    ["lastNotifiedDay", "last_notified_day", "n"], ["notifiedWindows", "notified_windows", "n"],
    ["progressIssued", "progress_issued", "n"], ["checkedAt", "checked_at", "n"],
  ],
}
const OPEN: Spec = {
  table: "open_checkins",
  pk: "id",
  cols: [
    ["id", "id", "s"], ["taskId", "task_id", "s"], ["did", "did", "s"], ["kind", "kind", "s"], ["seq", "seq", "n"],
    ["checkinUri", "checkin_uri", "s"], ["checkinCid", "checkin_cid", "s"], ["replyUri", "reply_uri", "s"],
    ["issuedAt", "issued_at", "n"], ["expiresAt", "expires_at", "n"],
  ],
}
const REPORTS: Spec = {
  table: "reports",
  pk: "checkin_id",
  cols: [
    ["checkinId", "checkin_id", "s"], ["taskId", "task_id", "s"], ["kind", "kind", "s"],
    ["receiptUri", "receipt_uri", "s"], ["receiptCid", "receipt_cid", "s"],
    ["recordUri", "record_uri", "s"], ["recordCid", "record_cid", "s"],
    ["value", "value", "n"], ["receivedAt", "received_at", "n"], ["note", "note", "s"],
    ["revoked", "revoked", "s"], ["checkedAt", "checked_at", "n"],
  ],
}
const EVALS: Spec = {
  table: "evaluations",
  pk: "task_id",
  cols: [
    ["taskId", "task_id", "s"], ["handle", "handle", "s"], ["summary", "summary", "s"],
    ["durationDays", "duration_days", "n"], ["scoreHundredths", "score_hundredths", "n"],
    ["finalRatePermille", "final_rate_permille", "n"], ["missingCount", "missing_count", "n"],
    ["algorithm", "algorithm", "s"], ["evaluationUri", "evaluation_uri", "s"], ["finalizedAt", "finalized_at", "n"],
    ["stale", "stale", "b"], ["visible", "visible", "b"],
  ],
}
const PLANS: Spec = {
  table: "plans",
  pk: "day_start",
  cols: [["dayStart", "day_start", "n"], ["triggers", "triggers", "j"]],
}
const SESSION: Spec = {
  table: "bot_session",
  pk: "id",
  cols: [["id", "id", "n"], ["accessJwt", "access_jwt", "s"], ["refreshJwt", "refresh_jwt", "s"], ["expiresAt", "expires_at", "n"]],
}
const ENTITLEMENTS: Spec = {
  table: "entitlements",
  pk: "did",
  cols: [["did", "did", "s"], ["plan", "plan", "s"], ["flags", "flags", "s"], ["validUntil", "valid_until", "n"]],
}

/** 集合ごとの表の対応。運用スクリプト（移行）の対応表との一致を試験で確かめる */
export const D1_SPECS = {
  botSession: SESSION,
  entitlements: ENTITLEMENTS,
  plans: PLANS,
  tasks: TASKS,
  openCheckins: OPEN,
  reports: REPORTS,
  evaluations: EVALS,
}

const toDb = (v: unknown, k: Kind): unknown => {
  if (v === null || v === undefined) return null
  if (k === "b") return v ? 1 : 0
  if (k === "j") return JSON.stringify(v)
  return v
}
const fromDb = (v: unknown, k: Kind): unknown => {
  if (v === null || v === undefined) return null
  if (k === "b") return v === 1
  if (k === "j") return JSON.parse(v as string)
  return v
}
const rowOf = <T>(spec: Spec, db: Record<string, unknown> | null): T | null => {
  if (!db) return null
  return Object.fromEntries(spec.cols.map(([f, c, k]) => [f, fromDb(db[c], k)])) as T
}

/** 項目の部分集合を更新する文の組み立て（項目名は spec の中のものだけを許す） */
function setClause(spec: Spec, fields: Record<string, unknown>) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined)
  const cols = entries.map(([f]) => {
    const c = spec.cols.find(([name]) => name === f)
    if (!c) throw new Error(`unknown field: ${f}`)
    return c
  })
  return {
    sql: cols.map(([, c]) => `${c} = ?`).join(", "),
    values: entries.map(([, v], i) => toDb(v, (cols[i] as Spec["cols"][number])[2])),
  }
}

const CHUNK = 100 // 1 クエリの束縛変数の上限

export function createD1Store(db: D1Database): DataStore {
  const upsert = (spec: Spec, row: object) => {
    const r = row as Record<string, unknown>
    const names = spec.cols.map(([, c]) => c)
    const update = names.filter((c) => c !== spec.pk).map((c) => `${c} = excluded.${c}`).join(", ")
    return db
      .prepare(
        `INSERT INTO ${spec.table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")}) ` +
          `ON CONFLICT(${spec.pk}) DO UPDATE SET ${update}`,
      )
      .bind(...spec.cols.map(([f, , k]) => toDb(r[f], k)))
  }
  const putMany = async (spec: Spec, rows: object[]) => {
    if (rows.length > 0) await db.batch(rows.map((r) => upsert(spec, r)))
  }
  const getOne = async <T>(spec: Spec, key: unknown) =>
    rowOf<T>(spec, await db.prepare(`SELECT * FROM ${spec.table} WHERE ${spec.pk} = ?`).bind(key).first())
  const all = async <T>(spec: Spec, sql: string, ...binds: unknown[]) =>
    ((await db.prepare(sql).bind(...binds).all()).results as Record<string, unknown>[]).map((r) => rowOf<T>(spec, r) as T)
  const getMany = async <T>(spec: Spec, ids: string[]): Promise<T[]> => {
    if (ids.length === 0) return []
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK))
    const results = await db.batch(
      chunks.map((c) =>
        db.prepare(`SELECT * FROM ${spec.table} WHERE ${spec.pk} IN (${c.map(() => "?").join(", ")})`).bind(...c),
      ),
    )
    const found = new Map<string, T>()
    for (const res of results) {
      for (const r of res.results as Record<string, unknown>[]) found.set(r[spec.pk] as string, rowOf<T>(spec, r) as T)
    }
    return ids.flatMap((id) => (found.has(id) ? [found.get(id) as T] : []))
  }
  const patch = async (spec: Spec, key: unknown, fields: Record<string, unknown>) => {
    const { sql, values } = setClause(spec, fields)
    if (sql) await db.prepare(`UPDATE ${spec.table} SET ${sql} WHERE ${spec.pk} = ?`).bind(...values, key).run()
  }
  const deleteMany = async (spec: Spec, ids: string[]) => {
    if (ids.length > 0) await db.batch(ids.map((id) => db.prepare(`DELETE FROM ${spec.table} WHERE ${spec.pk} = ?`).bind(id)))
  }

  return {
    botSession: {
      get: async () => {
        const r = await getOne<Record<string, unknown>>(SESSION, 1)
        return r ? { accessJwt: r.accessJwt as string, refreshJwt: r.refreshJwt as string, expiresAt: r.expiresAt as number } : null
      },
      put: (row) => upsert(SESSION, { id: 1, ...row }).run().then(() => undefined),
    },
    entitlements: {
      get: (did) => getOne(ENTITLEMENTS, did),
      put: (row) => upsert(ENTITLEMENTS, row).run().then(() => undefined),
    },
    plans: {
      get: (dayStart) => getOne<PlanRow>(PLANS, dayStart),
      async putIfAbsent(row) {
        const [, selected] = await db.batch([
          db.prepare("INSERT OR IGNORE INTO plans (day_start, triggers) VALUES (?, ?)").bind(row.dayStart, JSON.stringify(row.triggers)),
          db.prepare("SELECT * FROM plans WHERE day_start = ?").bind(row.dayStart),
        ])
        return rowOf<PlanRow>(PLANS, (selected as D1Result).results[0] as Record<string, unknown>) as PlanRow
      },
    },
    tasks: {
      get: (id) => getOne<TaskRow>(TASKS, id),
      getMany: (ids) => getMany<TaskRow>(TASKS, ids),
      async getByTaskUri(uri) {
        return rowOf<TaskRow>(TASKS, await db.prepare("SELECT * FROM tasks WHERE task_uri = ?").bind(uri).first())
      },
      put: (row) => upsert(TASKS, row).run().then(() => undefined),
      putMany: (rows) => putMany(TASKS, rows),
      patch: (id, fields) => patch(TASKS, id, fields),
      async countActive(did) {
        const r = await db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE did = ? AND status = 'active'").bind(did).first<{ n: number }>()
        return r?.n ?? 0
      },
      async countActiveBySlot(dayStart) {
        const rows = await db
          .prepare("SELECT windows FROM tasks WHERE status = 'active' AND ends_at > ? AND priority = 0")
          .bind(dayStart)
          .all<{ windows: string }>()
        const counts: Record<Slot, number> = { morning: 0, noon: 0, evening: 0 }
        for (const r of rows.results) {
          const windows = JSON.parse(r.windows) as { startMinute: number; endMinute: number }[]
          for (const slot of ["morning", "noon", "evening"] as const) {
            const s = slotToWindow(slot)
            if (windows.some((w) => w.startMinute === s.startMinute && w.endMinute === s.endMinute)) counts[slot]++
          }
        }
        return counts
      },
      listPriority: (dayStart, limit) =>
        all<TaskRow>(TASKS, "SELECT * FROM tasks WHERE status = 'active' AND ends_at > ? AND priority = 1 ORDER BY started_at LIMIT ?", dayStart, limit),
      async listCandidates(now, limit) {
        // 窓は JSON のため SQL で絞れない。期間で絞った行を読み、窓の判定は呼び出しの中で行う
        const rows = await all<TaskRow>(TASKS, "SELECT * FROM tasks WHERE status = 'active' AND started_at <= ? AND ends_at > ? ORDER BY started_at", now, now)
        const minute = minuteOfDay(now)
        return rows.filter((t) => t.windows.some((w) => w.startMinute <= minute && minute < w.endMinute)).slice(0, limit)
      },
      listPendingResult: (now, limit) =>
        all<TaskRow>(TASKS, "SELECT * FROM tasks WHERE status = 'active' AND ends_at <= ? AND result_state = 'none' ORDER BY ends_at LIMIT ?", now, limit),
      listFinalizable: (now, limit) =>
        all<TaskRow>(TASKS, "SELECT * FROM tasks WHERE status = 'active' AND ends_at <= ? AND result_state IN ('accepted', 'expired') ORDER BY ends_at LIMIT ?", now, limit),
      listDueForRecheck: (before, limit) =>
        all<TaskRow>(TASKS, "SELECT * FROM tasks WHERE status <> 'withdrawn' AND checked_at < ? ORDER BY checked_at LIMIT ?", before, limit),
    },
    openCheckins: {
      get: (id) => getOne<OpenCheckinRow>(OPEN, id),
      getMany: (ids) => getMany<OpenCheckinRow>(OPEN, ids),
      put: (row) => upsert(OPEN, row).run().then(() => undefined),
      putMany: (rows) => putMany(OPEN, rows),
      patch: (id, fields) => patch(OPEN, id, fields),
      delete: (id) => db.prepare("DELETE FROM open_checkins WHERE id = ?").bind(id).run().then(() => undefined),
      deleteMany: (ids) => deleteMany(OPEN, ids),
      listExpired: (now, limit) =>
        all<OpenCheckinRow>(OPEN, "SELECT * FROM open_checkins WHERE expires_at < ? ORDER BY expires_at LIMIT ?", now, limit),
      listUnreplied: (now, limit) =>
        all<OpenCheckinRow>(OPEN, "SELECT * FROM open_checkins WHERE reply_uri IS NULL AND expires_at >= ? ORDER BY expires_at LIMIT ?", now, limit),
    },
    reports: {
      get: (id) => getOne<ReportRow>(REPORTS, id),
      put: (row) => upsert(REPORTS, row).run().then(() => undefined),
      putMany: (rows) => putMany(REPORTS, rows),
      patch: (id, fields) => patch(REPORTS, id, fields),
      listByTask: (taskId) =>
        all<ReportRow>(REPORTS, "SELECT * FROM reports WHERE task_id = ? ORDER BY received_at", taskId),
      listDueForRecheck: (before, limit) =>
        all<ReportRow>(REPORTS, "SELECT * FROM reports WHERE revoked IS NULL AND checked_at < ? ORDER BY checked_at LIMIT ?", before, limit),
    },
    evaluations: {
      get: (id) => getOne<EvaluationRow>(EVALS, id),
      getMany: (ids) => getMany<EvaluationRow>(EVALS, ids),
      put: (row) => upsert(EVALS, row).run().then(() => undefined),
      putMany: (rows) => putMany(EVALS, rows),
      patch: (id, fields) => patch(EVALS, id, fields),
      listStale: (limit) =>
        all<EvaluationRow>(EVALS, "SELECT * FROM evaluations WHERE stale = 1 ORDER BY finalized_at LIMIT ?", limit),
      page(q) {
        const key = q.sort === "score" ? "score_hundredths" : "final_rate_permille"
        const dir = q.order === "desc" ? "DESC" : "ASC"
        const cmp = q.order === "desc" ? "<" : ">"
        const after = q.after ? ` AND (${key}, finalized_at, task_id) ${cmp} (?, ?, ?)` : ""
        return all<EvaluationRow>(
          EVALS,
          `SELECT * FROM evaluations WHERE visible = 1${after} ORDER BY ${key} ${dir}, finalized_at ${dir}, task_id ${dir} LIMIT ?`,
          ...(q.after ?? []),
          q.limit,
        )
      },
    },
  }
}
