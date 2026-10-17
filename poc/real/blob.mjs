// 画像の形式・容量・MIME の扱いを実 PDS で確かめる
// 実行: node --env-file=.env poc/real/blob.mjs <画像のあるディレクトリ>
import { readFileSync } from "node:fs"
const dir = process.argv[2]
const PDS = "https://bsky.social"
const s = await (await fetch(`${PDS}/xrpc/com.atproto.server.createSession`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: process.env.SKYSHARE_E2E_IDENTIFIER, password: process.env.SKYSHARE_E2E_APP_PASSWORD }) })).json()
const up = async (label, bytes, mime) => {
  const r = await fetch(`${PDS}/xrpc/com.atproto.repo.uploadBlob`, { method: "POST", headers: { "content-type": mime, authorization: `Bearer ${s.accessJwt}` }, body: bytes })
  const j = await r.json().catch(() => ({}))
  console.log(label.padEnd(36), r.status, j.blob ? `mime=${j.blob.mimeType} size=${j.blob.size}` : JSON.stringify(j).slice(0, 120))
}
const jpg = readFileSync(`${dir}/big.jpg`), webp = readFileSync(`${dir}/big.webp`), small = readFileSync(`${dir}/small.webp`)
console.log("サイズ: jpg", jpg.length, "webp", webp.length)
await up("jpeg (約1MB)", jpg, "image/jpeg")
await up("webp (約1MB)", webp, "image/webp")
await up("webp (小)", small, "image/webp")
await up("jpeg の中身を image/png と宣言", jpg, "image/png")
await up("5MB のバイト列 (image/jpeg)", Buffer.concat([jpg, Buffer.alloc(5_000_000)]), "image/jpeg")
