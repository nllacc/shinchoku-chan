// メモリによる保存先の契約の実装。試験と移行の照合に使う
import type {
  BotSessionRow,
  DataStore,
  EntitlementRow,
  EvaluationRow,
  OpenCheckinRow,
  PlanRow,
  ReportRow,
  TaskRow,
} from "./store"
import { minuteOfDay, slotToWindow, type Slot } from "./time"

const clone = <T>(v: T): T => structuredClone(v)
const byAsc = <T>(key: (r: T) => number) => (a: T, b: T) => key(a) - key(b)

function windowMatchesSlot(w: { startMinute: number; endMinute: number }, slot: Slot) {
  const s = slotToWindow(slot)
  return w.startMinute === s.startMinute && w.endMinute === s.endMinute
}

export function createMemoryStore(): DataStore {
  let session: BotSessionRow | null = null
  const entitlements = new Map<string, EntitlementRow>()
  const plans = new Map<number, PlanRow>()
  const tasks = new Map<string, TaskRow>()
  const open = new Map<string, OpenCheckinRow>()
  const reports = new Map<string, ReportRow>()
  const evals = new Map<string, EvaluationRow>()

  const many = <T>(m: Map<string, T>, ids: string[]) =>
    ids.flatMap((id) => (m.has(id) ? [clone(m.get(id) as T)] : []))
  const list = <T>(rows: T[], sort: (a: T, b: T) => number, limit: number) =>
    rows.sort(sort).slice(0, limit).map(clone)

  return {
    botSession: {
      get: async () => (session ? clone(session) : null),
      put: async (row) => void (session = clone(row)),
    },
    entitlements: {
      get: async (did) => clone(entitlements.get(did) ?? null),
      put: async (row) => void entitlements.set(row.did, clone(row)),
    },
    plans: {
      get: async (dayStart) => clone(plans.get(dayStart) ?? null),
      async putIfAbsent(row) {
        if (!plans.has(row.dayStart)) plans.set(row.dayStart, clone(row))
        return clone(plans.get(row.dayStart) as PlanRow)
      },
    },
    tasks: {
      get: async (id) => clone(tasks.get(id) ?? null),
      getMany: async (ids) => many(tasks, ids),
      getByTaskUri: async (uri) =>
        clone([...tasks.values()].find((t) => t.taskUri === uri) ?? null),
      put: async (row) => void tasks.set(row.id, clone(row)),
      putMany: async (rows) => rows.forEach((r) => tasks.set(r.id, clone(r))),
      async patch(id, fields) {
        const t = tasks.get(id)
        if (t) Object.assign(t, clone(fields))
      },
      countActive: async (did) =>
        [...tasks.values()].filter((t) => t.did === did && t.status === "active").length,
      async countActiveBySlot(dayStart) {
        const counts: Record<Slot, number> = { morning: 0, noon: 0, evening: 0 }
        for (const t of tasks.values()) {
          if (t.status !== "active" || t.endsAt <= dayStart || t.priority) continue
          for (const slot of ["morning", "noon", "evening"] as const) {
            if (t.windows.some((w) => windowMatchesSlot(w, slot))) counts[slot]++
          }
        }
        return counts
      },
      listPriority: async (dayStart, limit) =>
        list(
          [...tasks.values()].filter((t) => t.status === "active" && t.endsAt > dayStart && t.priority),
          byAsc((t) => t.startedAt),
          limit,
        ),
      listCandidates: async (now, limit) => {
        const minute = minuteOfDay(now)
        return list(
          [...tasks.values()].filter(
            (t) =>
              t.status === "active" &&
              t.startedAt <= now &&
              t.endsAt > now &&
              t.windows.some((w) => w.startMinute <= minute && minute < w.endMinute),
          ),
          byAsc((t) => t.startedAt),
          limit,
        )
      },
      listPendingResult: async (now, limit) =>
        list(
          [...tasks.values()].filter((t) => t.status === "active" && t.endsAt <= now && t.resultState === "none"),
          byAsc((t) => t.endsAt),
          limit,
        ),
      listFinalizable: async (now, limit) =>
        list(
          [...tasks.values()].filter(
            (t) =>
              t.status === "active" &&
              t.endsAt <= now &&
              (t.resultState === "accepted" || t.resultState === "expired"),
          ),
          byAsc((t) => t.endsAt),
          limit,
        ),
      listDueForRecheck: async (before, limit) =>
        list(
          [...tasks.values()].filter((t) => t.status !== "withdrawn" && t.checkedAt < before),
          byAsc((t) => t.checkedAt),
          limit,
        ),
    },
    openCheckins: {
      get: async (id) => clone(open.get(id) ?? null),
      getMany: async (ids) => many(open, ids),
      put: async (row) => void open.set(row.id, clone(row)),
      putMany: async (rows) => rows.forEach((r) => open.set(r.id, clone(r))),
      async patch(id, fields) {
        const r = open.get(id)
        if (r) r.replyUri = fields.replyUri
      },
      delete: async (id) => void open.delete(id),
      deleteMany: async (ids) => ids.forEach((id) => open.delete(id)),
      listExpired: async (now, limit) =>
        list([...open.values()].filter((r) => r.expiresAt < now), byAsc((r) => r.expiresAt), limit),
      listUnreplied: async (now, limit) =>
        list(
          [...open.values()].filter((r) => r.replyUri === null && r.expiresAt >= now),
          byAsc((r) => r.expiresAt),
          limit,
        ),
    },
    reports: {
      get: async (id) => clone(reports.get(id) ?? null),
      put: async (row) => void reports.set(row.checkinId, clone(row)),
      putMany: async (rows) => rows.forEach((r) => reports.set(r.checkinId, clone(r))),
      async patch(id, fields) {
        const r = reports.get(id)
        if (r) Object.assign(r, clone(fields))
      },
      listByTask: async (taskId) =>
        list([...reports.values()].filter((r) => r.taskId === taskId), byAsc((r) => r.receivedAt), Infinity),
      listDueForRecheck: async (before, limit) =>
        list(
          [...reports.values()].filter((r) => r.revoked === null && r.checkedAt < before),
          byAsc((r) => r.checkedAt),
          limit,
        ),
    },
    evaluations: {
      get: async (id) => clone(evals.get(id) ?? null),
      getMany: async (ids) => many(evals, ids),
      put: async (row) => void evals.set(row.taskId, clone(row)),
      putMany: async (rows) => rows.forEach((r) => evals.set(r.taskId, clone(r))),
      async patch(id, fields) {
        const r = evals.get(id)
        if (r) Object.assign(r, clone(fields))
      },
      listStale: async (limit) =>
        list([...evals.values()].filter((r) => r.stale), byAsc((r) => r.finalizedAt), limit),
      async page(q) {
        const key = (r: EvaluationRow) => (q.sort === "score" ? r.scoreHundredths : r.finalRatePermille)
        const dir = q.order === "desc" ? -1 : 1
        const cmp = (a: EvaluationRow, b: EvaluationRow) =>
          dir * (key(a) - key(b) || a.finalizedAt - b.finalizedAt || (a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0))
        let rows = [...evals.values()].filter((r) => r.visible).sort(cmp)
        if (q.after) {
          const [k, f, id] = q.after
          const cursor = { scoreHundredths: k, finalRatePermille: k, finalizedAt: f, taskId: id } as EvaluationRow
          rows = rows.filter((r) => cmp(cursor, r) < 0)
        }
        return rows.slice(0, q.limit).map(clone)
      },
    },
  }
}
