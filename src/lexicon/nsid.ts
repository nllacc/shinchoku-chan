// 名前空間の接頭辞とコレクション識別子（接頭辞は scripts/rename-namespace.mjs が書き換える）
export const NSID_PREFIX = "com.example.shinchoku"

export const NSID = {
  defs: `${NSID_PREFIX}.defs`,
  task: `${NSID_PREFIX}.task`,
  progress: `${NSID_PREFIX}.progress`,
  result: `${NSID_PREFIX}.result`,
  enrollment: `${NSID_PREFIX}.bot.enrollment`,
  checkin: `${NSID_PREFIX}.bot.checkin`,
  receipt: `${NSID_PREFIX}.bot.receipt`,
  revocation: `${NSID_PREFIX}.bot.revocation`,
  evaluation: `${NSID_PREFIX}.bot.evaluation`,
} as const

export type CollectionNsid = (typeof NSID)[Exclude<keyof typeof NSID, "defs">]
