// lexicons/ 配下の JSON（正本）を束ねる。import のパスは rename-namespace.mjs が接頭辞に合わせて書き換える
import defs from "./com/example/shinchoku/defs.json"
import progress from "./com/example/shinchoku/progress.json"
import result from "./com/example/shinchoku/result.json"
import task from "./com/example/shinchoku/task.json"

export const LEXICON_DOCS: Record<string, unknown>[] = [defs, task, progress, result]
