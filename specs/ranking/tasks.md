# ランキング タスク一覧

## Phase 1: 評価の確定

- 対応: D-1, D-2, D-3
- [ ] T-1.1: `src/ranking/finalize.ts` に評価の入力の組み立てを実装し、取消の除外をテストする。
- [ ] T-1.2: `finalizeTasks` を実装し、1回5件の上限と再試行をテストする。
- [ ] T-1.3: 再評価を実装し、評価のレコードの追加とランキングの更新をテストする。
- 検証: `npx vitest run tests/ranking/finalize.test.ts tests/ranking/reevaluate.test.ts`

## Phase 2: 一覧と詳細の取得

- 対応: D-4, D-5, D-6
- [ ] T-2.1: `src/ranking/query.ts` に取得のクエリと続きの取得を実装する。
- [ ] T-2.2: 同点を含む並びでの区切りの境界と、昇順・降順をテストする。
- [ ] T-2.3: `src/ranking/detail.ts` に詳細を実装する。
- [ ] T-2.4: `src/ranking/routes.ts` に API の経路を登録し、読み取り行数と CPU 時間をテストする。
- 検証: `npx vitest run tests/ranking/query.test.ts tests/ranking/detail.test.ts tests/ranking/routes.test.ts`

## Phase 3: 再構築

- 対応: D-7
- [ ] T-3.1: `src/ranking/rebuild.ts` に再構築を実装する。
- [ ] T-3.2: データベースを空にして再構築し、一覧が一致することを通しで確認する。
- 検証: `npx vitest run tests/ranking/rebuild.test.ts`
