# 実行基盤 タスク一覧

## Phase 1: Worker と保存先

- 対応: D-1, D-4, D-8, D-9, D-12
- [x] T-1.1: `wrangler.toml` と `src/worker/index.ts`、`src/platform/env.ts` を作成する。
- [x] T-1.2: `src/worker/router.ts` に経路表と共通の応答形式を実装し、`src/platform/time.ts` に日本時間の変換を実装する。
- [x] T-1.3: `src/platform/store.ts` に保存先の契約と行の型、保存先の選択を実装する。
- [x] T-1.4: `src/platform/memoryStore.ts` に契約の実装を作る。
- [x] T-1.5: `migrations/0001_init.sql` と `src/platform/d1Store.ts` を作成し、ローカルの D1 へ適用して表と索引を確認する。
- [x] T-1.6: 契約の試験を作り、memoryStore と d1Store の両方で成功することと、1 操作の外部通信が 1 回以下であることを確認する。
- 検証: `npx vitest run tests/platform/router.test.ts tests/platform/time.test.ts tests/platform/storeContract.test.ts`

## Phase 2: 定期実行とオプション

- 対応: D-2, D-3
- [x] T-2.1: `src/worker/tick.ts` に処理の登録と順次実行を実装する。
- [x] T-2.2: `src/platform/options.ts` に既定値・環境変数の読み出し・検証を実装する。
- [x] T-2.3: 処理が空の定期実行の CPU 時間と読み取り行数を測るテストを追加する。
- 検証: `npx vitest run tests/platform/tick.test.ts tests/platform/options.test.ts`

## Phase 3: 資格・キー

- 対応: D-7, D-11
- [x] T-3.1: `src/platform/entitlement.ts` に資格の読み出しと無料フラグを実装する。
- [x] T-3.2: `src/platform/rkey.ts` にキーの導出を実装し、同じ入力で同じ値になることをテストする。
- 検証: `npx vitest run tests/platform/entitlement.test.ts tests/platform/rkey.test.ts`

## Phase 4: PDS・Bot・行の作成

- 対応: D-5, D-6, D-10
- [ ] T-4.1: `src/platform/pds.ts` に DID の解決と公開レコードの取得を実装する。
- [ ] T-4.2: CID の再計算と照合を実装し、実 PDS のレコードと改変したレコードでテストする。
- [ ] T-4.3: `src/platform/botSession.ts` にセッションの再利用と更新を実装する。
- [ ] T-4.4: `src/platform/rows.ts` にレコードから行を作る関数を実装し、同じレコードから同じ行ができることをテストする。
- 検証: `npx vitest run tests/platform/pds.test.ts tests/platform/botSession.test.ts tests/platform/rows.test.ts`

## Phase 5: 運用スクリプト

- 対応: D-13
- [ ] T-5.1: `scripts/store-migrate.mjs` に書き出し・取り込み・照合を実装する。
- [ ] T-5.2: 書き出した全行を memoryStore へ取り込み、件数と内容の一致と再実行の冪等性をテストする。
- [ ] T-5.3: `scripts/bot-profile.mjs` に自己ラベルの確認と設定を実装し、終了コードをテストする。
- 検証: `npx vitest run tests/platform/migrate.test.ts tests/platform/botProfile.test.ts`
