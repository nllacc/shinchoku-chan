// lexicons/ 配下の JSON（正本）を束ねる。import のパスは rename-namespace.mjs が接頭辞に合わせて書き換える
import defs from "./com/example/shinchoku/defs.json"

export const LEXICON_DOCS: Record<string, unknown>[] = [defs]
