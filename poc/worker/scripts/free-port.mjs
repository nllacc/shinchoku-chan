// 起動前に、このプロジェクトの wrangler dev を親プロセスごと停止する
// （待受中の workerd だけを止めても、親の wrangler が再起動してしまうため）
import { execSync } from "node:child_process"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const ports = process.argv.slice(2).length ? process.argv.slice(2) : ["8787", "9229"]
const patterns = [`${root}/node_modules/.bin/wrangler`, `${root}/node_modules/wrangler/`, `${root}/node_modules/@cloudflare/workerd`]

const sh = (cmd) => { try { return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }) } catch { return "" } }
const killProject = (sig) => patterns.forEach((p) => sh(`pkill -${sig} -f '${p}'`))
const busy = () => ports.filter((p) => sh(`ss -ltn 'sport = :${p}'`).split("\n").length > 2)
const wait = async (ms) => { for (let t = 0; t < ms && busy().length; t += 100) await new Promise((r) => setTimeout(r, 100)) }

if (sh(`pgrep -f '${patterns[0]}'`) || sh(`pgrep -f '${patterns[2]}'`)) {
  killProject("TERM")
  await wait(3000)
  if (busy().length) { killProject("KILL"); await wait(3000) }
  console.log("既存の wrangler dev を停止しました")
}

// プロジェクト外のプロセスが使っている場合は、止めずに原因を示して失敗させる
const still = busy()
if (still.length) {
  console.error(`ポート ${still.join(", ")} が他のプロセスに使われています:\n` + sh(`ss -ltnp | grep -E ':(${still.join("|")}) '`))
  process.exit(1)
}
