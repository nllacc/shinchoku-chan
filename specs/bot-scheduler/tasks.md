# Bot通知 タスク一覧

## Phase 1: 乱数・計画・ウォームアップ

- 対応: D-1, D-2
- [ ] T-1.1: `src/bot/rng.ts` に乱数の抽象と本番用・固定値の実装を作成する。
- [ ] T-1.2: `src/bot/plan.ts` に配分の関数を実装し、設計の2例を単体テストにする。
- [ ] T-1.3: `warmupLimit` を実装し、設計の例の日数と単調増加を単体テストにする。
- [ ] T-1.4: `ensurePlan` を実装し、同じ日の再実行と並行実行で計画が変わらないこと、優先の通知時刻を保存先の試験実装でテストする。
- 検証: `npx vitest run tests/bot/rng.test.ts tests/bot/plan.test.ts tests/bot/warmup.test.ts`

## Phase 2: 選出

- 対応: D-3
- [ ] T-2.1: `src/bot/select.ts` に重み付きの無作為抽出と持ち越し日数の計算を実装する。
- [ ] T-2.2: `selectForTrigger` を実装し、優先作業の必須選出・枠の拡張・ウォームアップ中の1人をテストする。
- [ ] T-2.3: 持ち越し 0 日と 3 日の選出比を 10000 回で確認する統計テストを追加する。
- 検証: `npx vitest run tests/bot/select.test.ts tests/bot/stats.test.ts`

## Phase 3: 発行・返信・文例

- 対応: D-4, D-5, D-6, D-9
- [ ] T-3.1: `src/bot/messages.ts` に文例と文面の生成を実装し、作業名が本文に入ることをテストする。
- [ ] T-3.2: `src/bot/issue.ts` に確認依頼の作成と登録を実装し、作成済みからの登録のやり直しをテストする。
- [ ] T-3.3: `src/bot/reply.ts` に起点投稿への返信と返信の間隔を実装し、間隔の範囲と予算切れをテストする。
- [ ] T-3.4: `src/bot/cheer.ts` に応援の文面と通常投稿を実装し、1人のときと無効設定のときに投稿されないことをテストする。
- 検証: `npx vitest run tests/bot/messages.test.ts tests/bot/issue.test.ts tests/bot/reply.test.ts tests/bot/cheer.test.ts`

## Phase 4: 結果確認と定期実行

- 対応: D-7, D-8
- [ ] T-4.1: `src/bot/resultSlot.ts` に結果確認の時刻を実装し、設計の3例を単体テストにする。
- [ ] T-4.2: `src/bot/dispatch.ts` に `runDueJobs` を実装し、定期実行へ登録する。
- [ ] T-4.3: 1回の実行で処理する件数・読む行数・所要時間の上限をテストする。
- [ ] T-4.4: ローカルの PDS と Worker で、計画から返信までを通しで確認する。
- 検証: `npx vitest run tests/bot/resultSlot.test.ts tests/bot/dispatch.test.ts tests/bot/integration.test.ts`
