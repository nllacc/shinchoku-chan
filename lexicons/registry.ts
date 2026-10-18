// lexicons/ 配下の JSON（正本）を束ねる。import のパスは rename-namespace.mjs が接頭辞に合わせて書き換える
import checkin from "./com/example/shinchoku/bot/checkin.json"
import enrollment from "./com/example/shinchoku/bot/enrollment.json"
import evaluation from "./com/example/shinchoku/bot/evaluation.json"
import receipt from "./com/example/shinchoku/bot/receipt.json"
import revocation from "./com/example/shinchoku/bot/revocation.json"
import defs from "./com/example/shinchoku/defs.json"
import progress from "./com/example/shinchoku/progress.json"
import result from "./com/example/shinchoku/result.json"
import task from "./com/example/shinchoku/task.json"

export const LEXICON_DOCS: Record<string, unknown>[] = [
  defs,
  task,
  progress,
  result,
  enrollment,
  checkin,
  receipt,
  revocation,
  evaluation,
]

// 参照先の AT Protocol 標準定義（独自 lexicon ではないため LEXICON_DOCS に含めず、接頭辞の変更や互換性検査の対象にしない）
export const EXTERNAL_DOCS: Record<string, unknown>[] = [
  {
    lexicon: 1,
    id: "com.atproto.repo.strongRef",
    description: "A URI with a content-hash fingerprint.",
    defs: {
      main: {
        type: "object",
        required: ["uri", "cid"],
        properties: {
          uri: { type: "string", format: "at-uri" },
          cid: { type: "string", format: "cid" },
        },
      },
    },
  },
]
