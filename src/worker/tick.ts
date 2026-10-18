// 5分おきの処理の登録と実行
import type { Env } from "../platform/env"
import { loadOptions } from "../platform/options"

export type TickHandler = {
  name: string
  run: (now: number, env: Env) => Promise<void>
}
export type TickResult = { name: string; ok: boolean; ms: number; error?: string }

const handlers: TickHandler[] = []

export function registerTick(handler: TickHandler): void {
  handlers.push(handler)
}

/** 試験用: 登録を空にする */
export function resetTicks(): void {
  handlers.length = 0
}

export async function runTick(now: number, env: Env): Promise<TickResult[]> {
  loadOptions(env) // 範囲外の指定の警告を、定期実行のたびに1回だけ記録する
  const results: TickResult[] = []
  for (const h of handlers) {
    const t0 = Date.now()
    try {
      await h.run(now, env)
      results.push({ name: h.name, ok: true, ms: Date.now() - t0 })
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      console.error(`tick handler ${h.name} failed: ${error}`)
      results.push({ name: h.name, ok: false, ms: Date.now() - t0, error })
    }
  }
  return results
}
