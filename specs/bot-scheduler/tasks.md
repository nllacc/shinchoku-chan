# Bot通知 タスク一覧

## Phase 1: 乱数と計画

- 対応: D-1, D-2
- [ ] T-1.1: `src/bot/rng.ts` に乱数の抽象と本番用の実装を作成する。
- [ ] T-1.2: `src/bot/plan.ts` に配分の関数を実装し、設計の2例を単体テストにする。
- [ ] T-1.3: `planDay` を実装し、冪等性・持ち越しの更新・優先の通知時刻をテストする。
- 検証: `npx vitest run tests/bot/rng.test.ts tests/bot/plan.test.ts`

## Phase 2: 選出

- 対応: D-3
- [ ] T-2.1: `src/bot/select.ts` に重み付きの無作為抽出を実装する。
- [ ] T-2.2: `selectForTrigger` を実装し、優先作業の必須選出と枠の拡張をテストする。
- [ ] T-2.3: 持ち越し 0 日と 3 日の選出比を 10000 回で確認する統計テストを追加する。
- 検証: `npx vitest run tests/bot/select.test.ts tests/bot/stats.test.ts`

## Phase 3: 発行と返信

- 対応: D-4, D-6
- [ ] T-3.1: `src/bot/messages.ts` に文例と文面の生成を実装する。
- [ ] T-3.2: `src/bot/reply.ts` に起点投稿への返信を実装する。
- [ ] T-3.3: `src/bot/dispatch.ts` に確認依頼の発行と、返信の再試行を実装する。
- 検証: `npx vitest run tests/bot/messages.test.ts tests/bot/reply.test.ts tests/bot/dispatch.test.ts`

## Phase 4: 結果確認と定期実行

- 対応: D-5, D-7
- [ ] T-4.1: `src/bot/resultSlot.ts` に結果確認の時刻を実装し、設計の3例を単体テストにする。
- [ ] T-4.2: `runDueJobs` を実装し、定期実行へ登録する。
- [ ] T-4.3: 1回の実行で処理する件数と読む行数の上限をテストする。
- [ ] T-4.4: ローカルの PDS と Worker で、計画から返信までを通しで確認する。
- 検証: `npx vitest run tests/bot/resultSlot.test.ts tests/bot/runDueJobs.test.ts tests/bot/integration.test.ts`
