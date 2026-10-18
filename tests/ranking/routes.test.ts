import { beforeEach, describe, expect, test } from "vitest"
import { createStore, type EvaluationRow } from "../../src/platform/store"
import worker from "../../src/worker/index"
import { resetDb, testEnv } from "../receipt/fakeNet"
import { timedDb } from "../setup/timedDb"

const evalRow = (n: number): EvaluationRow => ({
  taskId: `t${String(n).padStart(4, "0")}`, handle: `u${n}.test`, summary: "概要", durationDays: 3, scoreHundredths: 10000 - n,
  finalRatePermille: 500, missingCount: 0, algorithm: "linear-v1", evaluationUri: null, finalizedAt: 1_000_000 + n, stale: false, visible: true,
})
const get = (path: string, env = testEnv) => worker.fetch(new Request(`https://x.test${path}`), env)

beforeEach(resetDb)

describe("ranking routes", () => {
  test("ranking/AC-14: 認証情報なしでランキングの一覧と詳細が取得できる", async () => {
    await createStore(testEnv).evaluations.put(evalRow(1))
    const list = await get("/api/ranking")
    expect(list.status).toBe(200)
    expect(((await list.json()) as { rows: unknown[] }).rows).toHaveLength(1)
    // 詳細は作業の行がないため 404(認証の拒否である 401 ではない)
    expect((await get("/api/ranking/detail?id=t0001")).status).toBe(404)
  })

  test("不正なクエリは 400、id なしの詳細も 400", async () => {
    expect((await get("/api/ranking?sort=bad")).status).toBe(400)
    expect((await get("/api/ranking?order=bad")).status).toBe(400)
    expect((await get("/api/ranking?cursor=%21%21")).status).toBe(400)
    expect((await get("/api/ranking/detail")).status).toBe(400)
    expect(((await (await get("/api/ranking?sort=bad")).json()) as any).error.kind).toBe("bad-request")
  })

  test("既定は評価点の降順", async () => {
    await createStore(testEnv).evaluations.putMany([evalRow(1), evalRow(2)])
    const body = (await (await get("/api/ranking")).json()) as { rows: { taskId: string }[] }
    expect(body.rows.map((r) => r.taskId)).toEqual(["t0001", "t0002"])
  })

  test("ranking/AC-16: 100件の評価がある状態で一覧を取得すると、読み取りが150行以下", async () => {
    await createStore(testEnv).evaluations.putMany(Array.from({ length: 100 }, (_, i) => evalRow(i)))
    const io = { ms: 0, rowsRead: 0 }
    const res = await get("/api/ranking", { ...testEnv, DB: timedDb(testEnv.DB, io) } as typeof testEnv)
    expect(((await res.json()) as { rows: unknown[] }).rows).toHaveLength(50)
    expect(io.rowsRead).toBeGreaterThan(0)
    expect(io.rowsRead).toBeLessThanOrEqual(150)
  })

  test("ranking/AC-17: 一覧の取得を100回行ったとき、1回あたりの処理時間が10ミリ秒以下", async () => {
    // 試験環境の時計では CPU 時間そのものは測れない。保存先の待ち時間を差し引いた処理全体の時間で上限を確かめる(実機の CPU 時間は PoC で測定する)
    await createStore(testEnv).evaluations.putMany(Array.from({ length: 100 }, (_, i) => evalRow(i)))
    const io = { ms: 0 }
    const env = { ...testEnv, DB: timedDb(testEnv.DB, io) } as typeof testEnv
    const t0 = performance.now()
    for (let i = 0; i < 100; i++) await get("/api/ranking", env)
    expect((performance.now() - t0 - io.ms) / 100).toBeLessThanOrEqual(10)
  })
})
