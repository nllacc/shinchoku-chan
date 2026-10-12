import http from "node:http"
import { NodeOAuthClient } from "@atproto/oauth-client-node"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PW_PATH)

const SCOPE = process.env.TEST_SCOPE
const redirect = "http://127.0.0.1:3000/cb"
const store = () => { const m = new Map(); return { get: async k => m.get(k), set: async (k, v) => void m.set(k, v), del: async k => void m.delete(k) } }
const client = new NodeOAuthClient({
  clientMetadata: {
    client_id: `http://localhost?redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent(SCOPE)}`,
    client_name: "poc", redirect_uris: [redirect], scope: SCOPE,
    grant_types: ["authorization_code", "refresh_token"], response_types: ["code"],
    application_type: "native", token_endpoint_auth_method: "none", dpop_bound_access_tokens: true,
  },
  stateStore: store(), sessionStore: store(),
  plcDirectoryUrl: "http://localhost:2582",
  allowHttp: true,
})
const cbPromise = new Promise(res => {
  const srv = http.createServer((req, rsp) => { rsp.end("done"); res(new URL(req.url, "http://127.0.0.1:3000").searchParams); srv.close() })
  srv.listen(3000, "127.0.0.1")
})
const url = await client.authorize("http://localhost:2583", { scope: SCOPE })
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(url.toString())
await page.waitForTimeout(1500)
console.log("PAGE1:", (await page.innerText("body")).replace(/\s+/g, " ").slice(0, 300))
await page.screenshot({ path: "/tmp/oauth1.png" })
// ログイン
await page.getByRole("button", { name: "Sign in" }).click()
await page.waitForTimeout(1000)
await page.screenshot({ path: "/tmp/oauth1b.png" })
await page.locator("input").first().fill("alice.test")
await page.locator("input[type=password]").fill("hunter2hunter2")
await page.locator("button[type=submit]").first().click()
await page.waitForTimeout(2000)
console.log("PAGE2:", (await page.innerText("body")).replace(/\s+/g, " ").slice(0, 600))
await page.screenshot({ path: "/tmp/oauth2.png" })
const accept = page.getByRole("button", { name: /authorize|accept|allow/i }).first()
await accept.click()
const params = await cbPromise
await browser.close()
const { session } = await client.callback(params)
console.log("GRANTED SCOPE:", (await session.getTokenInfo()).scope)
const did = session.did
async function call(nsid, body, ct = "application/json") {
  const r = await session.fetchHandler(`/xrpc/${nsid}`, { method: "POST", headers: { "content-type": ct }, body: ct === "application/json" ? JSON.stringify(body) : body })
  return `${r.status} ${(await r.text()).slice(0, 160)}`
}
const rec = (col, rkey) => call("com.atproto.repo.createRecord", { repo: did, collection: col, record: { $type: col, createdAt: new Date().toISOString(), text: "x" }, validate: false })
console.log("create task      :", await rec("com.example.shinchoku.task"))
console.log("create progress  :", await rec("com.example.shinchoku.progress"))
console.log("create bot.receipt (should deny):", await rec("com.example.shinchoku.bot.receipt"))
console.log("create feed.post :", await rec("app.bsky.feed.post"))
console.log("upload blob png  :", await call("com.atproto.repo.uploadBlob", Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==", "base64"), "image/png"))
console.log("delete none      :", await call("com.atproto.repo.deleteRecord", { repo: did, collection: "com.example.shinchoku.task", rkey: "nonexist" }))
process.exit(0)
