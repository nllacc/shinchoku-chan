# タスク受理 タスク一覧

## Phase 1: 解析と計画

- 対応: D-1, D-4
- [ ] T-1.1: 定型の解析を実装し、表現ごとの単体テストを受け入れ条件のタグ付きで追加する。
- [ ] T-1.2: 受理から計画の行を生成し、ずらしの固定性と範囲のテストを追加する。
- 検証: `npx vitest run tests/intake/parse.test.ts tests/intake/plans.test.ts`

## Phase 2: 受理

- 対応: D-2, D-3
- [ ] T-2.1: 受理の検査（範囲・時刻の余裕・同時進行数）を実装する。
- [ ] T-2.2: 受理レコードの作成、計画の登録、確認の投稿を実装する。
- [ ] T-2.3: 同じ起点の再処理で何も増えないことのテストを追加する。
- 検証: `npx vitest run tests/intake/accept.test.ts`

## Phase 3: 経路と再構築

- 対応: D-5, D-6, D-7
- [ ] T-3.1: 返信と確認の文面、メンション経路の処理を実装し、通知の受信へ登録する。
- [ ] T-3.2: フォーム経路の受理 API を実装し、経路表へ登録する。
- [ ] T-3.3: Bot の PDS のレコードから計画の SQL を出力するスクリプトを実装する。
- 検証: `npx vitest run tests/intake/mention.test.ts tests/intake/api.test.ts tests/intake/rebuild.test.ts`
