// Bot のレコードのキーの導出。同じ秘密値と入力から常に同じ値を作る
const encoder = new TextEncoder()

async function hmac(secret: string, parts: string[]): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(parts.join("|"))))
}

/** HMAC-SHA-256 の先頭 16 バイトを 22 文字の base64url にする */
export async function deriveRkey(secret: string, parts: string[]): Promise<string> {
  const head = (await hmac(secret, parts)).slice(0, 16)
  return btoa(String.fromCharCode(...head)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}

/** HMAC の先頭 6 バイトを 2 の 48 乗で割った、0 以上 1 未満の値 */
export async function deriveUnit(secret: string, parts: string[]): Promise<number> {
  const head = (await hmac(secret, parts)).slice(0, 6)
  return head.reduce((acc, b) => acc * 256 + b, 0) / 2 ** 48
}

export const enrollmentKey = (secret: string, taskUri: string) =>
  deriveRkey(secret, ["enrollment", taskUri])

export const checkinKey = (
  secret: string,
  enrollmentRkey: string,
  i: { day: string; window: number; kind: "progress" | "result" },
) => deriveRkey(secret, ["checkin", enrollmentRkey, i.day, String(i.window), i.kind])
