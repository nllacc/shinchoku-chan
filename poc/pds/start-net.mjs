import { TestNetworkNoAppView } from "@atproto/dev-env"
const net = await TestNetworkNoAppView.create({ pds: { port: 2583, inviteRequired: false }, plc: { port: 2582 } })
const res = await fetch(`${net.pds.url}/xrpc/com.atproto.server.createAccount`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "alice@test.com", handle: "alice.test", password: "hunter2hunter2" }) })
console.log("READY", net.pds.url, res.status, await res.text())
setInterval(() => {}, 1 << 30)
