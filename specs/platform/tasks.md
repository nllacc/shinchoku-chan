# 実行基盤 タスク一覧

## Phase 1: Worker とスキーマ

- 対応: D-1, D-7
- [ ] T-1.1: `wrangler.toml` と `src/worker/index.ts`、`src/platform/env.ts` を作成する。
- [ ] T-1.2: `src/worker/router.ts` に経路表と共通の応答形式を実装する。
- [ ] T-1.3: `migrations/0001_init.sql` を作成し、ローカルの D1 へ適用して表と索引を確認する。
- 検証: `npx vitest run tests/platform/router.test.ts tests/platform/schema.test.ts`

## Phase 2: 定期実行とオプション

- 対応: D-2, D-3, D-9
- [ ] T-2.1: `src/worker/tick.ts` に処理の登録と順次実行を実装する。
- [ ] T-2.2: `src/platform/options.ts` に既定値・検証・読み出しを実装する。
- [ ] T-2.3: `src/platform/quota.ts` に使用量の記録と警告を実装する。
- [ ] T-2.4: 処理が空の定期実行の CPU 時間と読み取り行数を測るテストを追加する。
- 検証: `npx vitest run tests/platform/tick.test.ts tests/platform/options.test.ts tests/platform/quota.test.ts`

## Phase 3: 時刻と資格

- 対応: D-4, D-8
- [ ] T-3.1: `src/platform/time.ts` に日本時間の日境界と窓の変換を実装する。
- [ ] T-3.2: `src/platform/entitlement.ts` に資格の読み出しと無料フラグを実装する。
- 検証: `npx vitest run tests/platform/time.test.ts tests/platform/entitlement.test.ts`

## Phase 4: PDS と Bot

- 対応: D-5, D-6
- [ ] T-4.1: `src/platform/pds.ts` に DID の解決と公開レコードの取得を実装する。
- [ ] T-4.2: CID の再計算と照合を実装し、実 PDS のレコードと改変したレコードでテストする。
- [ ] T-4.3: `src/platform/botSession.ts` にセッションの再利用と更新を実装する。
- 検証: `npx vitest run tests/platform/pds.test.ts tests/platform/botSession.test.ts`
