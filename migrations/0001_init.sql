-- 保存先の論理配置（platform の設計）を D1 で実現するスキーマ
CREATE TABLE bot_session (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_jwt TEXT NOT NULL, refresh_jwt TEXT NOT NULL, expires_at INTEGER NOT NULL
);

CREATE TABLE entitlements (
  did TEXT PRIMARY KEY, plan TEXT NOT NULL, flags TEXT NOT NULL, valid_until INTEGER
);

CREATE TABLE plans (
  day_start INTEGER PRIMARY KEY, triggers TEXT NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY, did TEXT NOT NULL, handle TEXT NOT NULL,
  task_uri TEXT NOT NULL UNIQUE, task_cid TEXT NOT NULL,
  anchor_uri TEXT NOT NULL, anchor_cid TEXT NOT NULL,
  enrollment_uri TEXT NOT NULL, enrollment_cid TEXT NOT NULL, pds TEXT NOT NULL,
  title TEXT NOT NULL, summary TEXT NOT NULL, goal TEXT NOT NULL,
  metric_name TEXT NOT NULL, metric_unit TEXT NOT NULL,
  scale INTEGER NOT NULL, start_value INTEGER NOT NULL, goal_value INTEGER NOT NULL,
  duration_days INTEGER NOT NULL, daily_target INTEGER NOT NULL, windows TEXT NOT NULL,
  started_at INTEGER NOT NULL, ends_at INTEGER NOT NULL,
  evidence_required INTEGER NOT NULL, priority INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'ended', 'withdrawn')),
  result_state TEXT NOT NULL DEFAULT 'none' CHECK (result_state IN ('none', 'issued', 'accepted', 'expired')),
  last_notified_day INTEGER, notified_windows INTEGER NOT NULL DEFAULT 0,
  progress_issued INTEGER NOT NULL DEFAULT 0, checked_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX tasks_did_status ON tasks (did, status);
CREATE INDEX tasks_status_ends ON tasks (status, ends_at);
CREATE INDEX tasks_status_checked ON tasks (status, checked_at);

CREATE TABLE open_checkins (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL, did TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('progress', 'result')), seq INTEGER,
  checkin_uri TEXT NOT NULL, checkin_cid TEXT NOT NULL, reply_uri TEXT,
  issued_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX open_checkins_expires ON open_checkins (expires_at);

CREATE TABLE reports (
  checkin_id TEXT PRIMARY KEY, task_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('progress', 'result')),
  receipt_uri TEXT NOT NULL, receipt_cid TEXT NOT NULL, record_uri TEXT NOT NULL, record_cid TEXT NOT NULL,
  value INTEGER NOT NULL, received_at INTEGER NOT NULL, note TEXT, revoked TEXT,
  checked_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX reports_checked ON reports (checked_at);
CREATE INDEX reports_task ON reports (task_id, received_at);

CREATE TABLE evaluations (
  task_id TEXT PRIMARY KEY, handle TEXT NOT NULL, summary TEXT NOT NULL, duration_days INTEGER NOT NULL,
  score_hundredths INTEGER NOT NULL, final_rate_permille INTEGER NOT NULL, missing_count INTEGER NOT NULL,
  algorithm TEXT NOT NULL, evaluation_uri TEXT, finalized_at INTEGER NOT NULL,
  stale INTEGER NOT NULL DEFAULT 0, visible INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX evaluations_score ON evaluations (visible, score_hundredths DESC, finalized_at DESC, task_id DESC);
CREATE INDEX evaluations_rate ON evaluations (visible, final_rate_permille DESC, finalized_at DESC, task_id DESC);
CREATE INDEX evaluations_stale ON evaluations (stale);
