# 独自lexicon タスク一覧

## Phase 1: スキーマと識別子

- 対応: D-1, D-2, D-3, D-4
- [ ] T-1.1: 共通定義 defs とユーザー側の task と answer の JSON を作成する。
- [ ] T-1.2: Bot 側の acceptance と result の JSON を作成する。
- [ ] T-1.3: 名前空間と識別子の定数、各レコードの型を作成する。
- 検証: `npx vitest run tests/lexicon/schema.test.ts`

## Phase 2: 検証

- 対応: D-5
- [ ] T-2.1: 構造検証と意味規則の検証関数を実装する。
- [ ] T-2.2: 受け入れ条件ごとのタグ付き単体テストと、検証時間・大きさの測定テストを追加する。
- 検証: `npx vitest run tests/lexicon/validate.test.ts`

## Phase 3: 互換性検査

- 対応: D-6
- [ ] T-3.1: 公開済みスナップショットと比較する互換性検査のスクリプトを実装する。
- [ ] T-3.2: 必須項目の追加・型の変更・任意項目の追加のテストを追加する。
- 検証: `npx vitest run tests/lexicon/compat.test.ts`
