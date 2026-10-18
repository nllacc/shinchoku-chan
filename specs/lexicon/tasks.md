# 独自lexicon タスク一覧

## Phase 1: 名前空間と共通定義

- 対応: D-1, D-2
- [ ] T-1.1: TypeScript・vitest・@atproto/lexicon を導入し、`tests/lexicon/` を作成する。
- [ ] T-1.2: `src/lexicon/nsid.ts` に接頭辞とコレクション識別子を定義する。
- [ ] T-1.3: `lexicons/` に共通定義（指標・時間帯）の JSON と `lexicons/registry.ts` を作成する。
- [ ] T-1.4: `scripts/rename-namespace.mjs` を作成し、一括変更と公開後の中止を単体テストで確認する。
- 検証: `npx vitest run tests/lexicon/nsid.test.ts tests/lexicon/rename.test.ts`

## Phase 2: ユーザー側レコード

- 対応: D-3
- [ ] T-2.1: 作業（作業名を含む）・進捗報告・結果報告の lexicon JSON を `lexicons/` に作成する。
- [ ] T-2.2: `src/lexicon/types.ts` にユーザー側3種の型を定義する。
- [ ] T-2.3: 上限長で埋めたレコードのサイズ上限テストを、受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lexicon/userRecords.test.ts`

## Phase 3: Bot側レコード

- 対応: D-4, D-5
- [ ] T-3.1: 受理・確認依頼の lexicon JSON を作成する。
- [ ] T-3.2: 受領証・取消・評価の lexicon JSON を作成する。
- [ ] T-3.3: `src/lexicon/types.ts` に Bot 側5種の型を追加する。
- [ ] T-3.4: 更新日時の項目がないこと、未知の status を許容することをテストする。
- 検証: `npx vitest run tests/lexicon/botRecords.test.ts`

## Phase 4: 数値変換と検証

- 対応: D-6, D-7
- [ ] T-4.1: `src/lexicon/numeric.ts` を実装し、表の3例を単体テストにする。
- [ ] T-4.2: `src/lexicon/validate.ts` の構造検証を実装する。
- [ ] T-4.3: 識別子ごとの意味規則（作業名の規則を含む）を実装し、理由コードごとにテストする。
- [ ] T-4.4: 上限長の作業レコードを1000回検証する性能テストを追加する。
- 検証: `npx vitest run tests/lexicon/numeric.test.ts tests/lexicon/validate.test.ts tests/lexicon/perf.test.ts`

## Phase 5: 互換性検査

- 対応: D-8
- [ ] T-5.1: `scripts/check-lexicon-compat.mjs` に比較処理を実装する。
- [ ] T-5.2: `--update` でスナップショットを書き出し、`lexicons.lock.json` を生成する。
- [ ] T-5.3: 許容する変更と違反する変更の全種類を単体テストにする。
- 検証: `npx vitest run tests/lexicon/compat.test.ts`
