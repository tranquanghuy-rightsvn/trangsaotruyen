-- Schema D1 cho Trang Sao Truyen.
-- Ap dung: npx wrangler d1 execute trangsaotruyen --remote --file=worker/schema.sql
--
-- MIGRATION 1 LAN (2026-08-26): DB da tao TRUOC cot created_at o bang chapters khong tu co
-- cot nay khi chay lai file nay (CREATE TABLE IF NOT EXISTS la no-op tren bang da ton tai).
-- Chay THEM lenh sau, DUY NHAT 1 LAN, tren DB dang chay:
--   npx wrangler d1 execute trangsaotruyen --remote --command "ALTER TABLE chapters ADD COLUMN created_at TEXT;"
-- Chay lan 2 se loi "duplicate column" - vo hai, nghia la da co roi, bo qua.
--
-- MIGRATION 1 LAN (2026-08-29): dem luot xem theo TUNG CHUONG. DB cu co views_daily PK
-- (slug, day) va views_archive PK (slug) - KHONG co cot `chap`. CREATE TABLE IF NOT EXISTS
-- o duoi la no-op tren bang da ton tai nen phai rebuild TAY, DUY NHAT 1 LAN.
-- LENH day du (1 chuoi --command, KHONG dung --file: --file+--remote di qua D1 import API
-- can R2, ma account nay khong bat R2) nam trong worker/schema-migrate-chapter-views.sql.
-- Chay lan 2 se loi "no such table: views_daily" o buoc RENAME - vo hai, da migrate roi, bo qua.
--
-- MIGRATION 1 LAN (2026-09-22): bang views_monthly cho thong ke "nam nay". Bang MOI hoan
-- toan nen CREATE TABLE IF NOT EXISTS o duoi tu chay duoc, nhung `--file` + `--remote` di
-- qua D1 import API (can R2, account nay khong bat) -> chay bang --command:
--   npx wrangler d1 execute trangsaotruyen --remote --command "CREATE TABLE IF NOT EXISTS views_monthly (slug TEXT NOT NULL, month TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (slug, month));"
-- Chay lai vo hai (IF NOT EXISTS).

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

-- Luot xem theo NGAY, tach theo TUNG CHUONG. Moi pageview = DUNG 1 write (upsert 1 dong) -
-- khong ghi thanh 2 bang, vi free tier D1 cho 100k write/ngay; ghi 2 lan la tu chia doi
-- ngan sach do. Them chieu `chap` KHONG lam tang so write/pageview - van 1 dong upsert.
-- Cua so lon nhat can cho bang xep hang la 30 ngay -> cron giu 40 ngay roi don.
--   chap: so chuong dang doc. 0 = "khong ro chuong" (du lieu truoc migration 2026-08-29,
--         hoac client cu goi /_api/view khong kem so chuong).
--   n:    so luot xem trong dung ngay do, cua dung chuong do.
-- Tong luot xem 1 truyen  = SUM(n) GROUP BY slug (moi query xep hang van chi GROUP BY slug).
-- Tong luot xem 1 chuong  = SUM(n) WHERE slug=? GROUP BY chap (endpoint /_api/chapter-views).
CREATE TABLE IF NOT EXISTS views_daily (
  slug TEXT    NOT NULL,
  chap INTEGER NOT NULL DEFAULT 0,
  day  TEXT    NOT NULL,            -- 'YYYY-MM-DD' theo gio VN
  n    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (slug, chap, day)
);
CREATE INDEX IF NOT EXISTS idx_views_daily_day ON views_daily(day);

-- Luot xem cua cac ngay DA BI DON khoi views_daily, gop lai theo (slug, chap). Chi cron ghi
-- bang nay, khong phai moi request - nen no khong an vao ngan sach write cua luot xem.
CREATE TABLE IF NOT EXISTS views_archive (
  slug TEXT    NOT NULL,
  chap INTEGER NOT NULL DEFAULT 0,
  n    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (slug, chap)
);

-- Luot xem cua cac ngay DA BI DON, gop theo (slug, THANG). Sinh doi voi views_archive: cung
-- mot tap dong nguon, nhung giu lai chieu THOI GIAN de con tinh duoc cua so "nam nay" -
-- views_archive gop het moi nam vao 1 so nen khong dung cho viec do duoc.
-- Bo chieu `chap`: so dong = so truyen x so thang (~12/nam/truyen), thay vi x so chuong.
--   month: 'YYYY-MM' theo gio VN (substr cua cot day).
-- LUU Y: bang nay bat dau duoc ghi tu 2026-09-22. Luot xem cu hon 40 ngay TRUOC moc do da
-- nam trong views_archive khong con chieu ngay -> khong backfill duoc. Con so "nam nay" vi
-- the la "tu khi bat rollup thang", CMS ghi ro dieu nay o Tong quan.
CREATE TABLE IF NOT EXISTS views_monthly (
  slug  TEXT    NOT NULL,
  month TEXT    NOT NULL,           -- 'YYYY-MM' theo gio VN
  n     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (slug, month)
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
