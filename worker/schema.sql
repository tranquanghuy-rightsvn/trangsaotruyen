-- Schema D1 cho Trang Sao Truyen.
-- Ap dung: npx wrangler d1 execute trangsaotruyen --remote --file=worker/schema.sql
--
-- MIGRATION 1 LAN (2026-08-26): DB da tao TRUOC cot created_at o bang chapters khong tu co
-- cot nay khi chay lai file nay (CREATE TABLE IF NOT EXISTS la no-op tren bang da ton tai).
-- Chay THEM lenh sau, DUY NHAT 1 LAN, tren DB dang chay:
--   npx wrangler d1 execute trangsaotruyen --remote --command "ALTER TABLE chapters ADD COLUMN created_at TEXT;"
-- Chay lan 2 se loi "duplicate column" - vo hai, nghia la da co roi, bo qua.

-- Noi dung chuong. Day la thu thay the R2 (R2 doi phuong thuc thanh toan, D1 thi khong).
-- Khoa chinh (slug, n) khop dung URL cong khai /truyen/<slug>/chuong-<n> -> doc 1 chuong la
-- DUNG 1 row read, khong can index phu.
-- created_at: gan 1 LAN luc INSERT (= updated_at tai thoi diem do), KHONG dong lai khi
-- UPDATE (xem ON CONFLICT trong index.js - cau UPDATE khong dong cham created_at). Dung de
-- tinh "chuong moi trong ky" o /_api/stats - updated_at doi ca khi SUA chuong cu nen khong
-- dung duoc cho viec nay.
CREATE TABLE IF NOT EXISTS chapters (
  slug       TEXT    NOT NULL,
  n          INTEGER NOT NULL,
  title      TEXT    NOT NULL,
  content    TEXT    NOT NULL,   -- chuoi <p>...</p>, DA escape HTML o phia GAS
  updated_at TEXT    NOT NULL,
  created_at TEXT,
  PRIMARY KEY (slug, n)
);

-- Luot xem theo NGAY. Moi pageview = DUNG 1 write (upsert 1 dong) - khong ghi thanh 2 bang,
-- vi free tier D1 cho 100k write/ngay; ghi 2 lan la tu chia doi ngan sach do.
-- Cua so lon nhat can cho bang xep hang la 30 ngay -> cron giu 40 ngay roi don.
CREATE TABLE IF NOT EXISTS views_daily (
  slug TEXT NOT NULL,
  day  TEXT NOT NULL,            -- 'YYYY-MM-DD' theo gio VN
  n    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (slug, day)
);
CREATE INDEX IF NOT EXISTS idx_views_daily_day ON views_daily(day);

-- Luot xem cua cac ngay DA BI DON khoi views_daily. Chi cron ghi bang nay, khong phai moi
-- request - nen no khong an vao ngan sach write cua luot xem.
CREATE TABLE IF NOT EXISTS views_archive (
  slug TEXT PRIMARY KEY,
  n    INTEGER NOT NULL DEFAULT 0
);

-- Comment + danh gia. rating 1-5; NULL = comment khong kem danh gia (khong tinh vao trung binh).
-- status: 'ok' hien tren site, 'hidden' bi admin an (giu lai de doi chieu, khong xoa han).
CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL,
  name       TEXT NOT NULL,
  rating     INTEGER,
  body       TEXT NOT NULL,
  ip         TEXT,
  created_at TEXT NOT NULL,       -- ISO 8601
  status     TEXT NOT NULL DEFAULT 'ok'
);
CREATE INDEX IF NOT EXISTS idx_comments_slug ON comments(slug, status, id);
CREATE INDEX IF NOT EXISTS idx_comments_recent ON comments(id DESC);
CREATE INDEX IF NOT EXISTS idx_comments_ip ON comments(ip, id);
