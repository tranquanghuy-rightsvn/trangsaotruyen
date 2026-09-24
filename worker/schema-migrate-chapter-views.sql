-- MIGRATION 1 LAN (2026-08-29): dem luot xem theo TUNG CHUONG.
--
-- KHONG chay bang `wrangler d1 execute --remote --file=<file nay>`: `--file` + `--remote` di
-- qua D1 import API, API do stage file qua R2, ma account nay khong bat R2 -> loi auth 10000.
-- Chay bang MOT chuoi --command (di qua query API, khong dung R2), DUY NHAT 1 LAN:
--
--   npx wrangler d1 execute trangsaotruyen --remote --command "ALTER TABLE views_daily RENAME TO views_daily_old; ALTER TABLE views_archive RENAME TO views_archive_old; CREATE TABLE views_daily (slug TEXT NOT NULL, chap INTEGER NOT NULL DEFAULT 0, day TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (slug, chap, day)); CREATE TABLE views_archive (slug TEXT NOT NULL, chap INTEGER NOT NULL DEFAULT 0, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (slug, chap)); INSERT INTO views_daily (slug, chap, day, n) SELECT slug, 0, day, n FROM views_daily_old; INSERT INTO views_archive (slug, chap, n) SELECT slug, 0, n FROM views_archive_old; DROP TABLE views_daily_old; DROP TABLE views_archive_old; CREATE INDEX IF NOT EXISTS idx_views_daily_day ON views_daily(day);"
--
-- Bien:
--   views_daily   PK (slug, day)  ->  PK (slug, chap, day)   + cot chap
--   views_archive PK (slug)       ->  PK (slug, chap)         + cot chap
-- SQLite khong doi duoc PRIMARY KEY bang ALTER -> phai rebuild bang. Row cu khong biet chuong
-- nao nen gan chap = 0 ("khong ro chuong"). Neu 1 lenh loi, D1 rollback het, chay lai an toan.
-- Chay lan 2 loi "no such table: views_daily" o buoc RENAME dau tien -> da migrate roi, bo qua.
--
-- SQL day du (de doi chieu / chay local bang `--file` khong co --remote):

ALTER TABLE views_daily   RENAME TO views_daily_old;
ALTER TABLE views_archive RENAME TO views_archive_old;

CREATE TABLE views_daily (
  slug TEXT    NOT NULL,
  chap INTEGER NOT NULL DEFAULT 0,
  day  TEXT    NOT NULL,
  n    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (slug, chap, day)
);
CREATE TABLE views_archive (
  slug TEXT    NOT NULL,
  chap INTEGER NOT NULL DEFAULT 0,
  n    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (slug, chap)
);

INSERT INTO views_daily   (slug, chap, day, n) SELECT slug, 0, day, n FROM views_daily_old;
INSERT INTO views_archive (slug, chap, n)      SELECT slug, 0, n      FROM views_archive_old;

DROP TABLE views_daily_old;
DROP TABLE views_archive_old;

CREATE INDEX IF NOT EXISTS idx_views_daily_day ON views_daily(day);
