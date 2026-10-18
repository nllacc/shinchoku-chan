// Worker の共通のエラー形式 { error: { kind, message, retryable } } を表す例外
export class ApiError extends Error {
  constructor(
    public status: number,
    public kind: string,
    message: string,
    public retryable: boolean,
  ) {
    super(message)
  }
}

// 応答が成功ならその JSON を、失敗なら ApiError を投げる。通信自体の失敗も、再試行できる ApiError にする
export async function requestJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new ApiError(0, "network", "通信に失敗しました", true)
  }
  if (res.ok) return (await res.json()) as T
  let body: {
    error?: { kind?: string; message?: string; retryable?: boolean }
  } = {}
  try {
    body = await res.json()
  } catch {
    // 本文が JSON でない場合は既定の値を使う
  }
  throw new ApiError(
    res.status,
    body.error?.kind ?? "unknown",
    body.error?.message ?? `エラーが発生しました (${res.status})`,
    body.error?.retryable ?? res.status >= 500,
  )
}
