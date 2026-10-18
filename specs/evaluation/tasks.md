# 評価 タスク一覧

## Phase 1: 判定

- 対応: D-1, D-2
- [ ] T-1.1: 辞書の JSON を作成する。
- [ ] T-1.2: 正規化と辞書による判定を実装する。
- [ ] T-1.3: 代表的な30文の試験データと、種別の追加のテストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/evaluation/judge.test.ts`

## Phase 2: 確定と返信

- 対応: D-3, D-4, D-8
- [ ] T-2.1: 結果の確定（作成・評価待ちと計画の閉じ）を実装する。
- [ ] T-2.2: 返信の文面を実装する。
- [ ] T-2.3: 返信の処理（判定・聞き直し・フォームの案内）を実装し、通知の受信へ登録する。
- 検証: `npx vitest run tests/evaluation/finalize.test.ts tests/evaluation/answer.test.ts`

## Phase 3: 期限切れとフォーム

- 対応: D-5, D-6, D-7
- [ ] T-3.1: 評価の期限切れの締めを実装し、定期実行へ登録する。
- [ ] T-3.2: フォームの回答の受理 API と、受理の内容の公開 API を実装し、経路表へ登録する。
- 検証: `npx vitest run tests/evaluation/expire.test.ts tests/evaluation/form.test.ts`
