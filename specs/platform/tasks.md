# 実行基盤 タスク一覧

## Phase 1: Worker の骨格

- 対応: D-1, D-2, D-3, D-4
- [ ] T-1.1: fetch と scheduled の入口、経路表、共通の応答形式を実装する。
- [ ] T-1.2: 処理の登録と順次実行を実装し、毎分の cron を wrangler の設定に加える。
- [ ] T-1.3: システムオプションの読み込みと検証を実装する。
- [ ] T-1.4: 日本時間の変換を実装し、受け入れ条件のタグ付き単体テストを追加する。
- 検証: `npx vitest run tests/platform/worker.test.ts tests/platform/options.test.ts tests/platform/time.test.ts`

## Phase 2: 保存先とキー

- 対応: D-8, D-9
- [ ] T-2.1: 保存先の契約と、メモリによる実装を作成する。
- [ ] T-2.2: D1 のスキーマと D1 による実装を作成する。
- [ ] T-2.3: 同じ契約の試験を両方の実装に対して実行する。
- [ ] T-2.4: Bot のレコードのキーの導出を実装する。
- 検証: `npx vitest run tests/platform/store.test.ts tests/platform/rkey.test.ts`

## Phase 3: 外部サービスと運用

- 対応: D-5, D-6, D-7, D-12
- [ ] T-3.1: DID の解決と公開レコードの取得、CID の照合を実装する。
- [ ] T-3.2: Bot のセッションの取得・更新・再ログインを実装する。
- [ ] T-3.3: DID の一覧から同時進行数の上限を引き当てる関数を実装する。
- [ ] T-3.4: Bot の自己ラベルを確認するスクリプトを実装する。
- 検証: `npx vitest run tests/platform/pds.test.ts tests/platform/botSession.test.ts tests/platform/entitlement.test.ts`

## Phase 4: 通知と投稿

- 対応: D-10, D-11
- [ ] T-4.1: 投稿の組み立て（facet のバイト範囲と返信の参照）と作成を実装する。
- [ ] T-4.2: 通知の取得、処理済みの排除、回答と登録への振り分けを実装する。
- [ ] T-4.3: 受け入れ条件のタグ付きテストを、実際の通知の形のデータで追加する。
- 検証: `npx vitest run tests/platform/post.test.ts tests/platform/inbox.test.ts`
