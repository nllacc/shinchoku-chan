# 作業の登録と報告 タスク一覧

## Phase 1: サインイン

- 対応: D-1
- [ ] T-1.1: `public/oauth/client-metadata.json` と `src/web/auth/oauth.ts` を作成する。
- [ ] T-1.2: `src/web/auth/AuthProvider.tsx` を作成し、セッションの復元とサインアウトを実装する。
- [ ] T-1.3: ローカルの PDS と Worker で、サインインと権限の内容を画面から確認する。
- 検証: `npx vitest run tests/web/oauth.test.ts`
- E2E: `tests/e2e/signin.spec.ts` ローカルの PDS でサインインし再読み込みする → サインイン状態が保たれ、サインアウトで解除される

## Phase 2: 書き込みと画像

- 対応: D-2, D-5, D-6
- [ ] T-2.1: `src/web/lib/image.ts` に画像の縮小を実装する。
- [ ] T-2.2: `src/web/lib/records.ts` に起点投稿・作業レコード・報告レコードの作成を実装する。
- [ ] T-2.3: `src/web/lib/api.ts` に API の呼び出しを実装する。
- 検証: `npx vitest run tests/web/records.test.ts tests/web/api.test.ts tests/web/image.test.ts`
- E2E: `tests/e2e/image.spec.ts` 3メガバイトの画像を選ぶ → 1メガバイト以下の画像が添付される

## Phase 3: 登録画面

- 対応: D-3
- [ ] T-3.1: `src/web/pages/NewTask.tsx` に入力項目と検証の表示を実装する。
- [ ] T-3.2: 確定の流れと、失敗後の再開、受理依頼の結果の表示を実装する。
- 検証: `npx vitest run tests/web/newTask.test.tsx`
- E2E: `tests/e2e/register.spec.ts` サインインして作業を登録する → 開始時刻・終了時刻・通知時間帯が表示され、PDS に作業レコードがある

## Phase 4: 報告画面と配信容量

- 対応: D-4, D-7
- [ ] T-4.1: `src/web/pages/Checkin.tsx` に状態ごとの表示と、種別ごとのフォームを実装する。
- [ ] T-4.2: 残り時間の補正と、送信の流れ、期限切れの表示を実装する。
- [ ] T-4.3: 画面ごとの配信容量を検査するスクリプトをビルドに追加する。
- 検証: `npm run build && npx vitest run tests/web/checkin.test.tsx tests/web/size.test.ts`
- E2E: `tests/e2e/checkin.spec.ts` 確認リンクを開き進捗を送信する → 受理されたことが表示される
