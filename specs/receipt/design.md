# 受理と再確認 設計書

## 1. 構成

| パス                     | 責務                                            |
| ------------------------ | ----------------------------------------------- |
| `src/receipt/routes.ts`  | 受理依頼のAPI経路                               |
| `src/receipt/enroll.ts`  | 作業の受理                                      |
| `src/receipt/anchor.ts`  | 起点投稿の検証                                  |
| `src/receipt/windows.ts` | 通知窓の決定（朝昼夕の変換と1日作業の自動選択） |
| `src/receipt/submit.ts`  | 進捗報告と結果報告の受理                        |
| `src/receipt/expire.ts`  | 期限切れの受領証の作成                          |
| `src/receipt/recheck.ts` | 受理済みレコードの再確認と取消                  |
| `src/receipt/botRepo.ts` | Bot のリポジトリへの書き込み                    |

## 2. 関係図・ワークフロー

受理処理の依存方向を示す。

```mermaid
flowchart LR
  routes -->|enrollTask receiptRoutes| enroll
  routes -->|submitReport| submit
  enroll -->|verifyAnchor| anchor
  enroll -->|decideWindows autoWindow| windows
  enroll -->|writeBotRecord| botRepo
  submit -->|writeBotRecord| botRepo
  expire -->|writeBotRecord| botRepo
  recheck -->|writeBotRecord| botRepo
  enroll --> ext_platform["実行基盤"]
  submit --> ext_platform
  recheck --> ext_platform
  expire --> ext_platform
  botRepo --> ext_botpds["BotのPDS"]
  ext_tick["定期実行"] -->|expireCheckins| expire
  ext_tick -->|recheckRecords| recheck
  ext_web["Web"] --> routes
```

報告の受理の流れと、拒否される場合の分岐を示す。

```mermaid
sequenceDiagram
  participant ext_web as Web
  participant submit
  participant ext_pds as ユーザーのPDS
  participant botRepo
  ext_web->>submit: submitReport
  submit->>ext_pds: レコードの取得とCID照合
  alt 期限切れ
    submit-->>ext_web: 410 expired
  else 参照が不整合
    submit-->>ext_web: 422 mismatch
  else 証跡画像が不足
    submit-->>ext_web: 422 evidence-missing
  else 二重の受理
    submit-->>ext_web: 409 duplicate
  else 受理できる
    submit->>botRepo: writeBotRecord
    submit-->>ext_web: 200 accepted
  end
```

## 3. 設計項目

### D-1: API経路 (FR-12, NFR-2)

```ts
export const receiptRoutes: Route[] = [
  { method: "POST", path: "/api/enroll", handler: enrollHandler },
  { method: "POST", path: "/api/submit", handler: submitHandler },
  { method: "GET", path: "/api/checkin", handler: checkinHandler },
]
```

| 経路             | 入力               | 成功の応答                                                                                            |
| ---------------- | ------------------ | ----------------------------------------------------------------------------------------------------- |
| POST /api/enroll | { taskUri }        | 200 { taskId, startedAt, endsAt, windows }                                                            |
| POST /api/submit | { recordUri }      | 200 { status: "accepted", receiptUri }                                                                |
| GET /api/checkin | ?id=<確認依頼のid> | 200 { now, did, kind, status, expiresAt, taskRef, checkinRef, metric, evidenceRequired, taskSummary } |

taskRef と checkinRef は uri と cid の組である。metric は名称・単位・小数桁数・開始値・ゴール値を持つ。認証は要求しない。偽造できるのは本人のリポジトリへの書き込みだけで、不正な依頼は検証で拒否される。同じ依頼は D1 の一意制約（task_uri、checkin_id）で1回に絞り、2回目以降は最初の結果を返す。

### D-2: 作業の受理 (FR-1, FR-3, FR-4, FR-12)

```ts
export async function enrollTask(
  env: Env,
  taskUri: string,
  now: number,
): Promise<EnrollResult>

export type EnrollResult =
  | {
      ok: true
      taskId: string
      startedAt: number
      endsAt: number
      windows: Window[]
    }
  | { ok: false; status: 409 | 422 | 502; reason: string }
```

| 手順 | 内容                                                                 | 失敗時               |
| ---- | -------------------------------------------------------------------- | -------------------- |
| 1    | taskUri の collection が task であること                             | 422 bad-uri          |
| 2    | task_uri が登録済みなら、保存済みの結果を返す                        | （同じ結果）         |
| 3    | PDS からレコードを取得し CID を照合、構造と意味規則を検証する        | 422 invalid-record   |
| 4    | 起点投稿を検証する                                                   | 422 anchor-invalid   |
| 5    | 進行中の作業数が資格の同時進行数未満であること                       | 409 limit-reached    |
| 6    | 通知窓を決定する                                                     | —                    |
| 7    | startedAt = now、endsAt = now + durationDays × 86400000              | —                    |
| 8    | Bot のリポジトリへ受理レコード（enrollment）を作る。dailyTarget は 1 | 502 bot-write-failed |
| 9    | tasks に行を追加（受理レコードの参照を持つ）。status は active       | —                    |

手順 8 の後に手順 9 が失敗した場合、次の依頼で受理レコードの存在を確認してから手順 9 だけを行う。

### D-3: 起点投稿の検証 (FR-2)

```ts
export async function verifyAnchor(
  env: Env,
  did: string,
  anchor: StrongRef,
): Promise<boolean>
```

| 条件                                                                     | 結果  |
| ------------------------------------------------------------------------ | ----- |
| anchor.uri のリポジトリが did と同じで、collection が app.bsky.feed.post | 続行  |
| 取得した投稿の CID が anchor.cid と一致                                  | 続行  |
| 投稿の facets に Bot の DID へのメンションが含まれる                     | true  |
| 上記のいずれかを満たさない                                               | false |

### D-4: 通知窓の決定 (FR-5)

```ts
export function decideWindows(
  task: { durationDays: number; slot?: Slot },
  startedAt: number,
  endsAt: number,
): Window[] {
  if (task.durationDays >= 2) return [slotToWindow(task.slot!)]
  return [autoWindow(startedAt, endsAt)]
}

export function autoWindow(startedAt: number, endsAt: number): Window
```

autoWindow の手順:

| 手順 | 内容                                                                                 |
| ---- | ------------------------------------------------------------------------------------ |
| 1    | 開始から終了までの各日（日本時間）の朝・昼・夕の範囲を候補にし、開始と終了で切り取る |
| 2    | 切り取った幅が 60 分未満の候補を除く                                                 |
| 3    | 目標時刻 = startedAt + 12 時間                                                       |
| 4    | 目標時刻を含む候補があればそれ、なければ目標時刻に最も近い候補（同距離なら早い方）   |
| 5    | 選んだ候補の朝・昼・夕の窓（切り取る前の範囲）を返す                                 |

| 開始  | 目標    | 選ばれる窓      |
| ----- | ------- | --------------- |
| 07:00 | 19:00   | 夕（960〜1200） |
| 10:00 | 22:00   | 夕（960〜1200） |
| 21:00 | 翌09:00 | 朝（480〜720）  |

### D-5: 報告の受理 (FR-6, FR-7, FR-8, FR-12, NFR-1, NFR-2)

```ts
export async function submitReport(
  env: Env,
  recordUri: string,
  now: number,
): Promise<SubmitResult>
```

| 手順 | 内容                                                                                  | 失敗時               |
| ---- | ------------------------------------------------------------------------------------- | -------------------- |
| 1    | recordUri の collection が progress または result                                     | 422 bad-uri          |
| 2    | 記録の参照する確認依頼を D1 から引く。確認依頼がなければ拒否                          | 422 mismatch         |
| 3    | 確認依頼が accepted なら、保存済みの結果を返す                                        | 409 duplicate        |
| 4    | now が確認依頼の expires_at を超えていないこと（Bot の受信時刻で判定）                | 410 expired          |
| 5    | PDS から取得し CID を照合、構造と意味規則を検証する                                   | 422 invalid-record   |
| 6    | リポジトリの DID が確認依頼の did と一致、記録の task.uri と checkin の参照が一致     | 422 mismatch         |
| 7    | collection と確認依頼の kind が一致                                                   | 422 mismatch         |
| 8    | 作業の evidence_required が 1 なら、evidence の blob が存在（getBlob の HEAD で確認） | 422 evidence-missing |
| 9    | Bot のリポジトリへ受領証（accepted）を作る。record・value・receivedAt を固定する      | 502 bot-write-failed |
| 10   | reports に行を追加し、checkins の status を accepted にする                           | —                    |

外部への通信は、DID 文書 1 回、記録の取得 1 回、blob の確認 1 回、Bot の書き込み 1 回、確認依頼の記録の確認 1 回の最大 5 回である。受理時刻の判定には記録の createdAt を使わない。

### D-6: 期限切れ (FR-9)

```ts
export async function expireCheckins(now: number, env: Env): Promise<void>
```

| 項目 | 内容                                                                                                |
| ---- | --------------------------------------------------------------------------------------------------- |
| 対象 | checkins の status が issued で expires_at が now より前の行（索引 checkins_open）。1回に 20 件まで |
| 処理 | 受領証（expired）を Bot のリポジトリへ作り、status を expired にする                                |
| 失敗 | その行は次の定期実行で再試行する                                                                    |

### D-7: 再確認と取消 (FR-10, FR-11)

```ts
export async function recheckRecords(now: number, env: Env): Promise<void>
```

| 項目   | 内容                                                                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 対象   | checked_at が最も古い reports と tasks。checked_at + recheckIntervalHours が now を超えたものを 10 件まで                                                       |
| 取得   | 記録の URI から PDS の公開レコードを取得し、CID を保存済みの record_cid と比較する                                                                              |
| 一致   | checked_at を now に更新する                                                                                                                                    |
| 不一致 | revocation（reason: tampered、target: 受領証）を Bot のリポジトリへ作り、reports.revoked を設定し、その作業の evaluations.stale を 1 にする                     |
| 削除   | 報告の記録が削除されていれば reason: deleted の取消を作り、作業の記録が削除されていれば作業を取り下げる（tasks.status = withdrawn、受理レコードへの取消を作る） |

### D-8: Bot リポジトリへの書き込み (FR-4, FR-8, FR-9, FR-10)

```ts
export async function writeBotRecord(
  env: Env,
  collection: CollectionNsid,
  record: object,
): Promise<StrongRef>
```

| 項目   | 内容                                                            |
| ------ | --------------------------------------------------------------- |
| 検証   | 書き込む前に validateRecord で構造と意味規則を検証する          |
| 認証   | getBotAgent のセッションで com.atproto.repo.createRecord を呼ぶ |
| 書込先 | Bot のリポジトリのみ。更新（putRecord）は呼ばない               |
| 戻り値 | 作成したレコードの uri と cid                                   |

## 4. エラー処理

| 事象                             | 処理                                                            |
| -------------------------------- | --------------------------------------------------------------- |
| ユーザーの PDS に到達できない    | 502 と retryable true を返す                                    |
| Bot のリポジトリへの書き込み失敗 | 502 を返し、D1 を更新しない。次の依頼または定期実行で再試行する |
| 期限切れ                         | 410 を返す                                                      |
| 検証の失敗                       | 422 と理由コードを返す                                          |
| 二重の受理                       | 409 を返し、保存済みの結果を添える                              |
| 再確認中の PDS の一時的な失敗    | その行は更新せず、次の定期実行で再試行する                      |
