// 利用資格の機能フラグの読み出し
import type { Env } from "./env"
import { createStore } from "./store"

export type EntitlementFlags = {
  maxConcurrentTasks: number
  maxWindows: number
  windowRange: [number, number]
  priority: boolean
  characterSelectable: boolean
}

export const FREE_FLAGS: EntitlementFlags = {
  maxConcurrentTasks: 1,
  maxWindows: 0,
  windowRange: [480, 1200],
  priority: false,
  characterSelectable: false,
}

const isFlags = (v: unknown): v is EntitlementFlags => {
  const f = v as Partial<EntitlementFlags> | null
  return (
    typeof f === "object" &&
    f !== null &&
    Number.isInteger(f.maxConcurrentTasks) &&
    Number.isInteger(f.maxWindows) &&
    Array.isArray(f.windowRange) &&
    f.windowRange.length === 2 &&
    f.windowRange.every(Number.isInteger) &&
    typeof f.priority === "boolean" &&
    typeof f.characterSelectable === "boolean"
  )
}

export async function getEntitlement(
  env: Env,
  did: string,
  now: number,
): Promise<EntitlementFlags> {
  const row = await createStore(env).entitlements.get(did)
  if (!row || (row.validUntil !== null && row.validUntil < now)) return FREE_FLAGS
  try {
    const flags: unknown = JSON.parse(row.flags)
    if (isFlags(flags)) return flags
  } catch {
    // 下の警告へ進む
  }
  console.warn(`entitlement flags of ${did} are broken; using the free flags`)
  return FREE_FLAGS
}
