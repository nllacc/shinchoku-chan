// 試験用: D1 の呼び出しに掛かった時間と、読み取った行数を数える
// 試験用 D1 は1回あたり数ミリ秒の入出力の待ちを含む。処理そのものの時間を測るため、保存先の待ち時間を計って差し引く
export function timedDb(db: D1Database, io: { ms: number; rowsRead?: number }): D1Database {
  const timed = async <T>(f: () => Promise<T>): Promise<T> => {
    const t = performance.now()
    try {
      return await f()
    } finally {
      io.ms += performance.now() - t
    }
  }
  const stmt = (s: D1PreparedStatement): D1PreparedStatement =>
    new Proxy(s, {
      get(target, prop) {
        const v = (target as never)[prop]
        if (prop === "bind") return (...a: unknown[]) => stmt((target as { bind: (...x: unknown[]) => D1PreparedStatement }).bind(...a))
        if (prop === "run" || prop === "first" || prop === "all" || prop === "raw") {
          return (...a: unknown[]) =>
            timed(async () => {
              const r = await (v as (...x: unknown[]) => Promise<unknown>).apply(target, a)
              // 読み取った行数(all と run の結果に含まれる)を数える
              io.rowsRead = (io.rowsRead ?? 0) + ((r as { meta?: { rows_read?: number } } | null)?.meta?.rows_read ?? 0)
              return r
            })
        }
        return typeof v === "function" ? (v as (...x: unknown[]) => unknown).bind(target) : v
      },
    })
  return new Proxy(db, {
    get(target, prop) {
      if (prop === "prepare") return (q: string) => stmt(target.prepare(q))
      if (prop === "batch") return (b: D1PreparedStatement[]) => timed(() => target.batch(b))
      const v = (target as never)[prop]
      return typeof v === "function" ? (v as () => unknown).bind(target) : v
    },
  })
}

