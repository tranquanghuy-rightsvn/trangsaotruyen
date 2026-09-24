/**
 * Worker Trang Sao Truyen.
 *
 * Gánh 3 việc mà file tĩnh không làm được:
 *   1. D1 — nội dung chương (Static Assets chỉ chứa 20.000 file)
 *   2. D1 — đếm lượt xem (bảng xếp hạng ngày/tuần/tháng)
 *   3. D1 — comment + đánh giá (rating/nominations trang chi tiết)
 *
 * VÌ SAO D1 chứ không R2 cho nội dung chương: R2 là thứ DUY NHẤT trong cả stack này đòi
 * phương thức thanh toán, kể cả khi chỉ dùng trong hạn mức free 10GB. D1 free 5GB không đòi
 * thẻ — đủ cho ~238.000 chương (~790 truyện × 300). Đánh đổi là cái trần đó thấp hơn R2, nên
 * /_api/stats trả kèm dung lượng đã dùng để CMS cảnh báo trước khi chạm (xem docs/CMS.md).
 *
 * Ngoài API, Worker còn render TRANG CHƯƠNG: GET /truyen/:slug/chuong-:n — một route duy
 * nhất phục vụ mọi URL chương, đọc D1 rồi ghép vào template html/_tpl/chapter.html (do
 * scripts/build.py sinh, đã resolve sẵn header/footer/menu thể loại).
 *
 * Phần còn lại của site (trang chủ, phân loại, chi tiết truyện) là file tĩnh do tầng Static
 * Assets phục vụ trực tiếp, KHÔNG đi qua code này.
 */

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

// Site và API cùng một Worker nên cùng origin -> trình duyệt không cần CORS. Nhưng khi test
// từ file:// hoặc localhost thì có, và thiếu header ở đó tạo ra một buổi debug rất vô nghĩa.
// Chỉ mở cho endpoint CÔNG KHAI; endpoint admin không bao giờ được gọi từ trình duyệt.
const CORS_PUBLIC = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

const COMMENT_COOLDOWN_SEC = 20;
const COMMENT_MAX_LEN = 2000;
const COMMENT_NAME_MAX = 60;
const IMPORT_BATCH_MAX = 25;   // phải khớp IMPORT_BATCH_MAX bên GAS Code.js
const VIEWS_KEEP_DAYS = 40;    // > 30 để cửa sổ "tháng" luôn đủ dữ liệu

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } });
}

function err(message, status = 400, extra = {}) {
  return json({ error: message }, status, extra);
}

/** So sánh token theo thời gian hằng số — so sánh bằng === sẽ thoát sớm ở byte đầu khác
 * nhau, về lý thuyết đo được độ lệch thời gian để dò token. Rẻ, nên làm. */
function safeEqual(a, b) {
  const A = new TextEncoder().encode(String(a || ""));
  const B = new TextEncoder().encode(String(b || ""));
  if (A.length !== B.length) return false;
  let diff = 0;
  for (let i = 0; i < A.length; i++) diff |= A[i] ^ B[i];
  return diff === 0;
}

function isAdmin(request, env) {
  return !!env.ADMIN_TOKEN && safeEqual(request.headers.get("X-Admin-Token"), env.ADMIN_TOKEN);
}

/** Ngày theo giờ VN (UTC+7). Dùng offset cố định thay vì Intl timezone: VN không có DST nên
 * +7 luôn đúng, và tránh phụ thuộc dữ liệu timezone của runtime. */
function vnDay(date = new Date(), offsetDays = 0) {
  const t = date.getTime() + 7 * 3600 * 1000 - offsetDays * 86400 * 1000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Nam hien tai theo gio VN, dang 'YYYY'. Dung cho cua so "nam nay" o /_api/stats. */
function vnYear(date = new Date()) {
  return vnDay(date).slice(0, 4);
}

/** Slug do GAS sinh (slugify_) chỉ gồm a-z0-9 và '-'. Ép lại ở đây để một slug méo không
 * bao giờ trở thành khoá D1 lạ hay tham số truy vấn bất thường. */
function cleanSlug(s) {
  const out = String(s || "").toLowerCase();
  return /^[a-z0-9-]{1,120}$/.test(out) ? out : "";
}

/** Ngày 'YYYY-MM-DD' do client gửi (bộ lọc "Tùy chỉnh" trên CMS) — ép định dạng chặt để
 * không lọt chuỗi lạ vào truy vấn D1. Rỗng/sai dạng -> "" (coi như không lọc). */
function cleanDay_(s) {
  const out = String(s || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : "";
}

// ==================== Admin API (GAS gọi vào) ====================

async function handleAdmin(request, env, parts, method) {
  // parts: đã bỏ "_api" ở đầu
  const [resource, a, b] = parts;

  // /_api/chapter/<slug>/<n>
  if (resource === "chapter") {
    const slug = cleanSlug(a);
    const n = Number(b);
    if (!slug || !Number.isInteger(n) || n < 1) return err("slug hoặc số chương không hợp lệ");
    if (method === "GET") {
      // Tra cứu bằng đúng khoá chính (slug, n) -> 1 row read, không quét bảng.
      const row = await env.DB.prepare(
        "SELECT n, title, content, updated_at FROM chapters WHERE slug = ? AND n = ?"
      ).bind(slug, n).first();
      if (!row) return err("not found", 404);
      return json(row);
    }
    if (method === "PUT") {
      const body = await request.json().catch(() => null);
      if (!body || !body.content) return err("thiếu content");
      const ts = body.updated_at || new Date().toISOString();
      // created_at chi dat luc INSERT (VALUES ?6), ON CONFLICT KHONG dong toi cot nay nen
      // sua chuong cu giu nguyen created_at goc - xem chu thich trong schema.sql.
      await env.DB.prepare(
        "INSERT INTO chapters (slug, n, title, content, updated_at, created_at) VALUES (?1,?2,?3,?4,?5,?5) " +
        "ON CONFLICT(slug, n) DO UPDATE SET title=?3, content=?4, updated_at=?5"
      ).bind(slug, n, body.title || `Chương ${n}`, body.content, ts).run();
      return json({ ok: true });
    }
    if (method === "DELETE") {
      await env.DB.prepare("DELETE FROM chapters WHERE slug = ? AND n = ?").bind(slug, n).run();
      return json({ ok: true });
    }
    return err("method not allowed", 405);
  }

  // /_api/chapters/<slug> — ghi hàng loạt. Đây là lý do import 25 chương chỉ mất 1 request
  // thay vì 25: GAS bị giới hạn 6 phút/lần chạy, mỗi round-trip HTTP tốn hàng trăm ms.
  if (resource === "chapters" && method === "POST") {
    const slug = cleanSlug(a);
    if (!slug) return err("slug không hợp lệ");
    const body = await request.json().catch(() => null);
    const list = body && Array.isArray(body.chapters) ? body.chapters : null;
    if (!list || !list.length) return err("thiếu chapters");
    if (list.length > IMPORT_BATCH_MAX) return err(`tối đa ${IMPORT_BATCH_MAX} chương mỗi lượt`);

    for (const c of list) {
      const n = Number(c.n);
      if (!Number.isInteger(n) || n < 1) return err(`số chương không hợp lệ: ${c.n}`);
      if (!c.content) return err(`chương ${n} không có nội dung`);
    }
    // D1.batch chạy cả 25 câu trong MỘT transaction — đây là điểm D1 hơn hẳn R2 ở chỗ này:
    // R2 không có ghi nhiều key kiểu atomic, lỗi giữa batch để lại nửa vời. Ở đây lỗi là
    // rollback sạch, và nhập lại vẫn idempotent (upsert theo khoá slug+n).
    const now = new Date().toISOString();
    await env.DB.batch(list.map((c) => env.DB.prepare(
      "INSERT INTO chapters (slug, n, title, content, updated_at, created_at) VALUES (?1,?2,?3,?4,?5,?5) " +
      "ON CONFLICT(slug, n) DO UPDATE SET title=?3, content=?4, updated_at=?5"
    ).bind(slug, Number(c.n), c.title || `Chương ${c.n}`, c.content, c.updated_at || now)));
    return json({ ok: true, written: list.length });
  }

  // /_api/story/<slug> — xoá mọi chương của một truyện.
  if (resource === "story" && method === "DELETE") {
    const slug = cleanSlug(a);
    if (!slug) return err("slug không hợp lệ");
    // Tất cả trong 1 transaction. Với R2 việc này là vòng lặp list-rồi-delete theo cursor
    // (R2 list trả tối đa 1000 key/lượt) và không atomic — D1 gọn hơn hẳn ở đây.
    // Dọn luôn views/comments: để lại sẽ làm bảng xếp hạng tính cả truyện không còn tồn tại.
    const res = await env.DB.batch([
      env.DB.prepare("DELETE FROM chapters     WHERE slug = ?").bind(slug),
      env.DB.prepare("DELETE FROM views_daily  WHERE slug = ?").bind(slug),
      env.DB.prepare("DELETE FROM views_archive WHERE slug = ?").bind(slug),
      env.DB.prepare("DELETE FROM views_monthly WHERE slug = ?").bind(slug),
      env.DB.prepare("DELETE FROM comments     WHERE slug = ?").bind(slug),
    ]);
    return json({ ok: true, deleted: (res[0] && res[0].meta && res[0].meta.changes) || 0 });
  }

  // /_api/stats — GAS gọi mỗi ngày (trigger theo giờ) để ghi số vào data/stories.json.
  // GAS là nơi duy nhất giữ GITHUB_TOKEN và đã có sẵn logic ghi repo — không nhân bản
  // quyền ghi GitHub sang Worker chỉ để làm đúng việc này.
  if (resource === "stats" && method === "GET") {
    const today = vnDay();
    const d1 = vnDay(new Date(), 1);
    const d7 = vnDay(new Date(), 7);
    const d30 = vnDay(new Date(), 30);
    const year = vnYear();            // 'YYYY'
    const yearStart = `${year}-01-01`;
    const url = new URL(request.url);
    const rangeFrom = cleanDay_(url.searchParams.get("from"));
    const rangeTo = cleanDay_(url.searchParams.get("to"));

    // Lấy slug từ UNION của CẢ BA bảng, không chỉ views_daily. Truyện cũ 40 ngày không ai
    // đọc sẽ bị cron dọn hết dòng khỏi views_daily — nếu chỉ JOIN từ đó, nó biến mất khỏi
    // kết quả, GAS ghi views=0 và xoá sạch lượt xem all-time của truyện đó trên site.
    // GROUP BY slug o moi bang: views_daily/views_archive gio co NHIEU dong moi slug (1
    // dong / chuong) - phai gop lai truoc khi JOIN, neu khong COALESCE(a.n,0) chi lay 1 chuong.
    //   year_views = phan con trong views_daily cua nam nay + phan da bi cron don sang
    //   views_monthly cua chinh nam do. KHONG cong views_archive vao: archive giu TOAN BO
    //   lich su khong con chieu thoi gian, cong vao la bien "nam nay" thanh "all-time".
    //   views_monthly chi nhan dong do cron chuyen ra khoi views_daily, nen hai ve khong
    //   bao gio dem trung mot luot xem.
    const views = await env.DB.prepare(`
      WITH slugs AS (
        SELECT slug FROM views_daily
        UNION SELECT slug FROM views_archive
        UNION SELECT slug FROM views_monthly
      ),
      d AS (
        SELECT slug,
               SUM(n)                                    AS recent,
               SUM(CASE WHEN day  = ?1 THEN n END)       AS day_views,
               SUM(CASE WHEN day >= ?2 THEN n END)       AS week_views,
               SUM(CASE WHEN day >= ?3 THEN n END)       AS month_views,
               SUM(CASE WHEN day >= ?4 THEN n END)       AS year_views
        FROM views_daily GROUP BY slug
      ),
      a AS (
        SELECT slug, SUM(n) AS n FROM views_archive GROUP BY slug
      ),
      m AS (
        SELECT slug, SUM(n) AS n FROM views_monthly
        WHERE substr(month, 1, 4) = ?5 GROUP BY slug
      )
      SELECT s.slug                                AS slug,
             COALESCE(a.n, 0) + COALESCE(d.recent, 0) AS total,
             COALESCE(d.day_views, 0)              AS day_views,
             COALESCE(d.week_views, 0)             AS week_views,
             COALESCE(d.month_views, 0)            AS month_views,
             COALESCE(d.year_views, 0) + COALESCE(m.n, 0) AS year_views
      FROM slugs s
      LEFT JOIN a ON a.slug = s.slug
      LEFT JOIN d ON d.slug = s.slug
      LEFT JOIN m ON m.slug = s.slug
    `).bind(d1, d7, d30, yearStart, year).all();

    const ratings = await env.DB.prepare(`
      SELECT slug, COUNT(*) AS nominations, ROUND(AVG(rating), 1) AS rating
      FROM comments
      WHERE status = 'ok' AND rating IS NOT NULL
      GROUP BY slug
    `).all();

    const blank = () => ({
      views: 0, day_views: 0, week_views: 0, month_views: 0, year_views: 0,
      rating: null, nominations: 0,
    });
    const byslug = {};
    for (const r of views.results) {
      byslug[r.slug] = Object.assign(blank(), {
        views: r.total, day_views: r.day_views, week_views: r.week_views,
        month_views: r.month_views, year_views: r.year_views,
      });
    }
    for (const r of ratings.results) {
      byslug[r.slug] = byslug[r.slug] || blank();
      byslug[r.slug].rating = r.rating;
      byslug[r.slug].nominations = r.nominations;
    }
    // Dung luong da dung: KHONG duoc de cham tran trong im lang (xem d1Usage/d1LimitBytes).
    const usage = await d1Usage(env);

    // Chuong MOI (khong tinh chuong SUA): dua vao created_at, chi dat luc INSERT dau tien -
    // updated_at doi ca khi sua chuong cu nen khong dung duoc cho so nay. Da la full-table-scan
    // (nhu usage o tren) nen khong lam nang them dang ke.
    //   GROUP BY slug (khong phai 1 dong tong): CMS phai cat duoc con so nay theo chu so huu
    //   truyen - editor chi duoc thay chuong moi cua CHINH truyen minh tao. Tong toan site
    //   cong lai o JS ben duoi, admin van co so cu.
    const chaptersNewRows = await env.DB.prepare(`
      SELECT slug,
        SUM(CASE WHEN substr(created_at,1,10) = ?1 THEN 1 ELSE 0 END)  AS day_new,
        SUM(CASE WHEN substr(created_at,1,10) >= ?2 THEN 1 ELSE 0 END) AS week_new,
        SUM(CASE WHEN substr(created_at,1,10) >= ?3 THEN 1 ELSE 0 END) AS month_new,
        SUM(CASE WHEN substr(created_at,1,10) >= ?4 THEN 1 ELSE 0 END) AS year_new
      FROM chapters GROUP BY slug
    `).bind(d1, d7, d30, yearStart).all();

    const chaptersNew = { day: 0, week: 0, month: 0, year: 0 };
    const chaptersNewBySlug = {};
    for (const r of chaptersNewRows.results) {
      chaptersNew.day += r.day_new || 0;
      chaptersNew.week += r.week_new || 0;
      chaptersNew.month += r.month_new || 0;
      chaptersNew.year += r.year_new || 0;
      // Chi giu truyen CO chuong moi trong nam - tuyet dai da so truyen cu se la 0000 va
      // khong dang cho vao payload (GAS ghi map nay xuong site-config.json).
      if (r.year_new) {
        chaptersNewBySlug[r.slug] = {
          day: r.day_new || 0, week: r.week_new || 0,
          month: r.month_new || 0, year: r.year_new || 0,
        };
      }
    }

    const out = {
      as_of: today,
      stories: byslug,
      chapters_new: {
        day: chaptersNew.day, week: chaptersNew.week,
        month: chaptersNew.month, year: chaptersNew.year,
        by_slug: chaptersNewBySlug,
      },
      usage: usage,
    };

    // "Tùy chỉnh" tren dashboard CMS: chi tinh khi CA from/to hop le. Chi doc duoc trong
    // VIEWS_KEEP_DAYS ngay gan nhat - qua nguong do cac ngay cu da bi cron don sang
    // views_archive (mat do chi tiet theo ngay), CMS tu bao ro thay vi im lang tra so sai.
    if (rangeFrom && rangeTo && rangeFrom <= rangeTo) {
      const rangeViews = await env.DB.prepare(
        "SELECT slug, SUM(n) AS n FROM views_daily WHERE day >= ?1 AND day <= ?2 GROUP BY slug"
      ).bind(rangeFrom, rangeTo).all();
      // GROUP BY slug chu khong COUNT(*) tong: giong chapters_new o tren, CMS phai cat duoc
      // theo chu so huu truyen thi editor moi xem duoc dung phan cua minh.
      const rangeChapters = await env.DB.prepare(
        "SELECT slug, COUNT(*) AS n FROM chapters " +
        "WHERE substr(created_at,1,10) >= ?1 AND substr(created_at,1,10) <= ?2 GROUP BY slug"
      ).bind(rangeFrom, rangeTo).all();
      const custom = {
        from: rangeFrom, to: rangeTo, total_views: 0, stories: {},
        chapters_new: 0, chapters_new_by_slug: {},
      };
      for (const r of rangeViews.results) {
        custom.stories[r.slug] = r.n || 0;
        custom.total_views += r.n || 0;
      }
      for (const r of rangeChapters.results) {
        custom.chapters_new_by_slug[r.slug] = r.n || 0;
        custom.chapters_new += r.n || 0;
      }
      out.custom = custom;
    }

    return json(out);
  }

  // /_api/usage — nhẹ, CMS gọi khi mở tab Cài đặt. Tách khỏi /_api/stats vì stats là truy vấn
  // tổng hợp nặng (quét views_daily + comments), không đáng gọi chỉ để xem dung lượng.
  if (resource === "usage" && method === "GET") {
    return json(await d1Usage(env));
  }

  // /_api/chapter-views/<slug> — luot xem TUNG CHUONG cua 1 truyen. CMS goi khi admin mo tab
  // Chuong. KHONG nhet vao /_api/stats (chay moi ngay, commit repo): so nay theo tung chuong
  // co the len toi hang tram dong/truyen, khong dang commit - lay khi can thi hon.
  //   chap = 0 trong D1 = luot khong ro chuong (client cu / du lieu truoc migration
  //   2026-08-29). KHONG tra ve rieng: CHIA DEU vao cac chuong that, phan du don vao cac
  //   chuong dau (n nho nhat). Tong khong doi.
  if (resource === "chapter-views" && method === "GET") {
    const slug = cleanSlug(a);
    if (!slug) return err("slug không hợp lệ");
    const [viewRows, chapRows] = await Promise.all([
      env.DB.prepare(`
        SELECT chap, SUM(n) AS n FROM (
          SELECT chap, n FROM views_daily   WHERE slug = ?1
          UNION ALL
          SELECT chap, n FROM views_archive WHERE slug = ?1
        ) GROUP BY chap
      `).bind(slug).all(),
      env.DB.prepare("SELECT n FROM chapters WHERE slug = ?1 ORDER BY n").bind(slug).all(),
    ]);

    const known = new Map();   // chap (>=1) -> luot xem da biet chuong
    let unknown = 0;           // luot xem chap = 0
    for (const r of viewRows.results) {
      if (r.chap === 0) unknown += r.n || 0;
      else known.set(r.chap, (known.get(r.chap) || 0) + (r.n || 0));
    }

    // Tap chuong = hop cua (chuong dang co trong bang chapters) va (chuong tung co luot xem
    // - phong khi chuong da bi xoa nhung van con luot doc lich su).
    const chapSet = new Set(chapRows.results.map((r) => r.n));
    for (const k of known.keys()) chapSet.add(k);
    const chapNums = [...chapSet].sort((x, y) => x - y);

    let total = unknown;
    let chapters = [];
    if (chapNums.length) {
      const base = Math.floor(unknown / chapNums.length);
      const rem = unknown % chapNums.length;   // don vao `rem` chuong dau tien
      chapters = chapNums.map((n, i) => {
        total += known.get(n) || 0;
        return { n, views: (known.get(n) || 0) + base + (i < rem ? 1 : 0) };
      });
    }
    return json({ slug, chapters, total });
  }

  // /_api/moderate — danh sách comment mới nhất để admin soát (CMS gọi).
  if (resource === "moderate" && method === "GET") {
    const url = new URL(request.url);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 100));
    const res = await env.DB.prepare(
      "SELECT id, slug, name, rating, body, created_at, status FROM comments ORDER BY id DESC LIMIT ?"
    ).bind(limit).all();
    return json({ comments: res.results });
  }

  // /_api/comment/<id> — admin ẩn (PATCH) hoặc xoá hẳn (DELETE) một comment.
  if (resource === "comment" && a) {
    const id = Number(a);
    if (!Number.isInteger(id) || id < 1) return err("id không hợp lệ");
    if (method === "DELETE") {
      await env.DB.prepare("DELETE FROM comments WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }
    if (method === "PATCH") {
      const body = await request.json().catch(() => ({}));
      const status = body.status === "ok" ? "ok" : "hidden";
      await env.DB.prepare("UPDATE comments SET status = ? WHERE id = ?").bind(status, id).run();
      return json({ ok: true, status });
    }
    return err("method not allowed", 405);
  }

  return err("not found", 404);
}

// ==================== Public API (site tĩnh gọi vào) ====================

async function handlePublic(request, env, parts, method, ctx) {
  const [resource, a] = parts;

  // POST /_api/view  {slug, n} — mỗi pageview ĐÚNG 1 write D1 (upsert 1 dòng). Free tier cho
  // 100k write/ngày; ghi thêm bảng tổng ở đây là tự chia đôi ngân sách đó, nên bảng tổng
  // chỉ được cron ghi (xem scheduled()).
  //   n = số chương đang đọc. Thiếu / không hợp lệ -> 0 ("không rõ chương"): client cũ chưa
  //   gửi n vẫn đếm được, chỉ không tách được theo chương. Thêm chiều `chap` KHÔNG làm tăng
  //   số write — vẫn là 1 dòng upsert.
  if (resource === "view" && method === "POST") {
    // Từ 2026-09-24 lượt xem được đếm NGAY lúc Worker render trang chương (handleChapterPage)
    // - bớt 1 request Worker/lượt đọc, tức gấp đôi số chương đọc được trong quota 100k/ngày.
    // Giữ endpoint trả ok cho trang chương cũ còn trong cache trình duyệt (main.js cũ vẫn
    // gọi), KHÔNG ghi gì nữa - ghi thì lượt đó bị đếm 2 lần.
    return json({ ok: true }, 200, CORS_PUBLIC);
  }

  // GET /_api/comments/<slug>
  if (resource === "comments" && method === "GET") {
    const slug = cleanSlug(a);
    if (!slug) return err("slug không hợp lệ", 400, CORS_PUBLIC);
    const res = await env.DB.prepare(
      "SELECT id, name, rating, body, created_at FROM comments " +
      "WHERE slug = ? AND status = 'ok' ORDER BY id DESC LIMIT 50"
    ).bind(slug).all();
    const agg = await env.DB.prepare(
      "SELECT COUNT(*) AS nominations, ROUND(AVG(rating), 1) AS rating FROM comments " +
      "WHERE slug = ? AND status = 'ok' AND rating IS NOT NULL"
    ).bind(slug).first();
    // Kèm tổng lượt xem: trang truyện vốn đã gọi endpoint này để tải bình luận, nên hiện
    // lượt xem "trực tiếp" không tốn thêm request Worker nào. Lỗi thì trả null -> trang giữ số
    // tĩnh do build.py ghi sẵn.
    const views = await storyViews(env, ctx, slug).catch(() => null);
    return json({
      comments: res.results,
      rating: agg ? agg.rating : null,
      nominations: agg ? agg.nominations : 0,
      views: views,
    }, 200, CORS_PUBLIC);
  }

  // POST /_api/comment  {slug, name, rating, body, website}
  if (resource === "comment" && method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body) return err("payload không hợp lệ", 400, CORS_PUBLIC);

    // Honeypot: field ẩn bằng CSS, người thật luôn để trống. Bot form-filler tự điền.
    // Trả 200 "ok" chứ không báo lỗi — báo lỗi là dạy bot biết cách vượt qua.
    if (String(body.website || "").trim()) return json({ ok: true }, 200, CORS_PUBLIC);

    const slug = cleanSlug(body.slug);
    const name = String(body.name || "").trim().slice(0, COMMENT_NAME_MAX);
    const text = String(body.body || "").trim().slice(0, COMMENT_MAX_LEN);
    let rating = body.rating == null || body.rating === "" ? null : Number(body.rating);
    if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) rating = null;
    if (!slug) return err("slug không hợp lệ", 400, CORS_PUBLIC);
    if (!name) return err("Vui lòng nhập tên", 400, CORS_PUBLIC);
    if (!text) return err("Vui lòng nhập nội dung", 400, CORS_PUBLIC);

    // Rate-limit theo IP: 1 comment / COMMENT_COOLDOWN_SEC. Worker không có CacheService
    // như GAS, nên đọc thẳng D1 (1 read, rẻ hơn nhiều so với ngân sách write).
    const ip = request.headers.get("CF-Connecting-IP") || "";
    if (ip) {
      const since = new Date(Date.now() - COMMENT_COOLDOWN_SEC * 1000).toISOString();
      const recent = await env.DB.prepare(
        "SELECT 1 FROM comments WHERE ip = ? AND created_at > ? LIMIT 1"
      ).bind(ip, since).first();
      if (recent) return err("Bạn vừa gửi bình luận, đợi vài giây rồi thử lại", 429, CORS_PUBLIC);
    }

    // Lưu nguyên văn (KHÔNG escape ở đây) - escape là việc của chỗ hiển thị, làm cả 2 nơi
    // sẽ ra "&amp;lt;" trên trang. Site phải chèn bằng textContent, không phải innerHTML.
    const res = await env.DB.prepare(
      "INSERT INTO comments (slug, name, rating, body, ip, created_at, status) " +
      "VALUES (?, ?, ?, ?, ?, ?, 'ok')"
    ).bind(slug, name, rating, text, ip, new Date().toISOString()).run();
    return json({ ok: true, id: res.meta.last_row_id }, 200, CORS_PUBLIC);
  }

  return err("not found", 404, CORS_PUBLIC);
}

// ==================== Dung lượng D1 ====================

/** Trần dung lượng của MỘT database D1. Free: 500 MB/database (5 GB là tổng của CẢ account,
 * không phải của 1 database). Workers Paid: 10 GB/database -> lên gói thì đổi D1_LIMIT_MB
 * trong wrangler.toml thành 10240, không phải sửa code. */
function d1LimitBytes(env) {
  const mb = Number(env.D1_LIMIT_MB) || 500;
  return mb * 1024 * 1024;
}

/** bytes = kích thước THẬT của file database (meta.size_after) - gồm cả bảng view, bình
 * luận, index; đó mới là con số Cloudflare so với trần. content_bytes = riêng nội dung chương. */
async function d1Usage(env) {
  const r = await env.DB.prepare(
    "SELECT COUNT(*) AS chapters, COALESCE(SUM(LENGTH(CAST(content AS BLOB))), 0) AS bytes FROM chapters"
  ).all();
  const row = (r.results && r.results[0]) || {};
  const size = r.meta && r.meta.size_after;
  return {
    chapters: row.chapters || 0,
    content_bytes: row.bytes || 0,
    bytes: Number(size) || row.bytes || 0,
    limit_bytes: d1LimitBytes(env),
  };
}

// ==================== Lượt xem ====================

/** Ghi 1 lượt xem chương. Mỗi pageview = ĐÚNG 1 write D1 (upsert 1 dòng). */
function recordView(env, slug, chap) {
  return env.DB.prepare(
    "INSERT INTO views_daily (slug, chap, day, n) VALUES (?1, ?2, ?3, 1) " +
    "ON CONFLICT(slug, chap, day) DO UPDATE SET n = n + 1"
  ).bind(slug, chap, vnDay()).run();
}

// Bot/crawler/preview link KHÔNG tính là lượt xem. Trước đây view do JS phía client gửi nên
// bot không chạy JS tự nhiên bị loại; giờ đếm ngay lúc render trang chương thì phải lọc tay.
// KHÔNG lọc theo tên app chat (zalo/telegram/whatsapp/...): trình duyệt NHÚNG trong các app đó
// (người đọc bấm link chia sẻ trên Zalo) mang tên app trong UA - lọc là mất view người thật.
// Bot xem trước link của chính các app đó đã có "bot"/"preview" trong UA (TelegramBot,
// Discordbot, SkypeUriPreview...).
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|pagespeed|python|curl|wget|go-http|java\/|okhttp|axios|node-fetch|httpclient|scrapy/i;

function isRealPageview(request) {
  if (request.method !== "GET") return false;
  const ua = request.headers.get("user-agent") || "";
  if (!ua || BOT_UA.test(ua)) return false;
  // Trình duyệt prefetch/prerender trang (Chrome speculation rules, <link rel=prefetch>) —
  // người dùng chưa chắc đã mở.
  const purpose = (request.headers.get("sec-purpose") || request.headers.get("purpose") || "").toLowerCase();
  return !purpose.includes("prefetch") && !purpose.includes("prerender");
}

/** Tổng lượt xem all-time của 1 truyện (= cột `total` của /_api/stats). Cache 60s ở edge:
 * trang truyện nào đông người mở thì D1 cũng chỉ bị hỏi tối đa 1 lần/phút/data center.
 * Cache API chỉ chạy trên custom domain (không chạy trên *.workers.dev) — lỗi thì bỏ qua cache. */
async function storyViews(env, ctx, slug) {
  const key = new Request(`https://views.cache/${slug}`);
  let cache = null;
  try { cache = caches.default; } catch (e) {}
  if (cache) {
    const hit = await cache.match(key).catch(() => null);
    if (hit) return Number(await hit.text()) || 0;
  }
  // views_daily PK (slug, chap, day) và views_archive PK (slug, chap) đều bắt đầu bằng slug
  // -> chỉ đọc đúng các dòng của truyện này, không quét bảng.
  const row = await env.DB.prepare(
    "SELECT (SELECT COALESCE(SUM(n), 0) FROM views_daily WHERE slug = ?1) + " +
    "(SELECT COALESCE(SUM(n), 0) FROM views_archive WHERE slug = ?1) AS total"
  ).bind(slug).first();
  const total = row ? Number(row.total) || 0 : 0;
  if (cache) {
    const put = cache.put(key, new Response(String(total), {
      headers: { "cache-control": "public, max-age=60" },
    })).catch(() => {});
    if (ctx) ctx.waitUntil(put);
  }
  return total;
}

// ==================== Trang chương (HTML, không phải API) ====================

// Template được cache ở module scope: isolate sống qua nhiều request nên hầu hết request
// không phải fetch lại. Isolate bị recycle thì lần đầu fetch lại — chấp nhận được.
let CHAPTER_TPL = null;

async function chapterTemplate(request, env) {
  if (CHAPTER_TPL) return CHAPTER_TPL;
  const url = new URL("/_tpl/chapter.html", request.url);
  const res = await env.ASSETS.fetch(new Request(url, { method: "GET" }));
  if (!res.ok) throw new Error("Chưa có /_tpl/chapter.html — chạy scripts/build.py rồi deploy lại");
  CHAPTER_TPL = await res.text();
  return CHAPTER_TPL;
}

function fillTemplate(tpl, map) {
  let out = tpl;
  for (const k in map) out = out.replaceAll(`{{${k}}}`, map[k]);
  return out;
}

function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Trả HTML THẬT, status 200, URL riêng cho từng chương — Google không phân biệt được với
 * trang tĩnh. Đây là cách một route phục vụ 600.000 URL mà không cần 600.000 file. */
async function handleChapterPage(request, env, ctx, slug, n) {
  // Đọc bằng đúng khoá chính (slug, n): 1 row read, không quét bảng.
  const row = await env.DB.prepare(
    "SELECT n, title, content FROM chapters WHERE slug = ? AND n = ?"
  ).bind(slug, n).first();
  if (!row) return null;   // để caller trả 404 của site

  // Đếm lượt xem NGAY TẠI ĐÂY thay vì để JS gọi thêm POST /_api/view: request render này đằng
  // nào cũng tốn, gộp vào thì mỗi lượt đọc chỉ còn 1 request Worker. waitUntil: ghi D1 chạy
  // sau khi đã trả trang, người đọc không phải chờ. Trình duyệt tải lại trong 60s lấy từ
  // cache của nó (max-age=60 bên dưới) nên không bị đếm lặp.
  if (isRealPageview(request)) ctx.waitUntil(recordView(env, slug, n).catch(() => {}));

  // Chương trước/sau: lấy số liền kề THẬT trong D1, không giả định n-1/n+1 tồn tại (chương
  // có thể bị xoá ở giữa, hoặc truyện bắt đầu từ số khác 1).
  const [prev, next, story] = await Promise.all([
    env.DB.prepare("SELECT n FROM chapters WHERE slug = ? AND n < ? ORDER BY n DESC LIMIT 1").bind(slug, n).first(),
    env.DB.prepare("SELECT n FROM chapters WHERE slug = ? AND n > ? ORDER BY n ASC LIMIT 1").bind(slug, n).first(),
    // Tên truyện lấy từ file tĩnh do build.py sinh — không nhân bản metadata truyện vào D1.
    env.ASSETS.fetch(new Request(new URL(`/truyen/${slug}/chapters.json`, request.url)))
      .then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);

  const tpl = await chapterTemplate(request, env);
  const origin = new URL(request.url).origin;
  const canonical = `${origin}/truyen/${slug}/chuong-${n}/`;
  // Tên truyện lấy từ chapters.json (build.py ghi vào). Dự phòng là slug — chỉ xảy ra khi
  // file tĩnh chưa được build/deploy, và khi đó tên có mất dấu cũng không đáng lo.
  const novelTitle = (story && story.title) || slug.replace(/-/g, " ");
  const total = (story && Array.isArray(story.chapters)) ? story.chapters.length : 0;

  const html = fillTemplate(tpl, {
    SLUG: escHtml(slug),
    CHAPTER_N: String(n),
    NOVEL_TITLE: escHtml(novelTitle),
    CHAPTER_TITLE: escHtml(row.title),
    TITLE: escHtml(`${row.title} - ${novelTitle}`),
    DESCRIPTION: escHtml(`Đọc ${row.title} của truyện ${novelTitle}` +
      (total ? ` (${total} chương)` : "") + " online miễn phí."),
    CANONICAL: escHtml(canonical),
    BREADCRUMB: escHtml(row.title),
    CONTENT: row.content,   // đã escape ở GAS (textToParagraphs_) - escape lại sẽ ra "&amp;lt;"
    PREV_HREF: prev ? `/truyen/${slug}/chuong-${prev.n}/` : "#",
    PREV_DISABLED: prev ? "" : " is-disabled",
    NEXT_HREF: next ? `/truyen/${slug}/chuong-${next.n}/` : "#",
    NEXT_DISABLED: next ? "" : " is-disabled",
  });

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // max-age=60: trình duyệt tải lại trong 1 phút lấy từ cache của nó -> không tốn request
      // Worker, không bị đếm view lặp. LƯU Ý: s-maxage KHÔNG có tác dụng ở đây - route này là
      // run_worker_first nên mọi request đều chạy Worker (Cloudflare không cache trước Worker).
      "cache-control": "public, max-age=60, s-maxage=300",
    },
  });
}

// ==================== Entrypoint ====================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    // Trang chương: /truyen/<slug>/chuong-<n>[/]
    if (parts[0] === "truyen" && parts.length === 3 && /^chuong-\d+$/.test(parts[2])) {
      const slug = cleanSlug(parts[1]);
      const n = Number(parts[2].slice(7));
      if (slug && Number.isInteger(n) && n >= 1) {
        try {
          const page = await handleChapterPage(request, env, ctx, slug, n);
          if (page) return page;
        } catch (e) {
          return new Response("Lỗi render trang chương: " + (e && e.message), {
            status: 500, headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }
      }
      // Không có chương đó -> trả 404 THẬT của site (không phải 200 với nội dung rỗng, cũng
      // không phải nội dung trang chủ - Google sẽ index nhầm).
      const nf = await env.ASSETS.fetch(new Request(new URL("/404.html", request.url)));
      return new Response(nf.body, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
    }

    // Mọi path còn lại (trừ /_api/*) nhường cho tầng Static Assets.
    if (parts[0] !== "_api") return env.ASSETS.fetch(request);

    const method = request.method.toUpperCase();
    if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_PUBLIC });

    const rest = parts.slice(1);
    const PUBLIC = { view: 1, comments: 1 };
    const isPublicRoute = PUBLIC[rest[0]] || (rest[0] === "comment" && method === "POST");

    try {
      if (isPublicRoute) return await handlePublic(request, env, rest, method, ctx);
      if (!isAdmin(request, env)) return err("unauthorized", 401);
      return await handleAdmin(request, env, rest, method);
    } catch (e) {
      // Trả message thật cho admin (GAS cần đọc để hiển thị), che với public.
      const detail = isAdmin(request, env) ? String(e && e.message ? e.message : e) : "internal error";
      return err(detail, 500, isPublicRoute ? CORS_PUBLIC : {});
    }
  },

  /** Cron mỗi ngày 01:00 VN: dồn các ngày quá cũ vào views_archive rồi xoá khỏi views_daily.
   * Nhờ vậy mỗi pageview vẫn chỉ tốn 1 write, mà views_daily không phình vô hạn và truy vấn
   * xếp hạng luôn quét ít dòng. Từ 2026-08-29 mỗi dòng tách theo (slug, chap) nên số dòng
   * tối đa = (số truyện × số chương từng đọc trong 40 ngày), vẫn bị chặn bởi cửa sổ 40 ngày;
   * views_archive gộp về (slug, chap) — cỡ tổng số chương của toàn site. */
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      const cutoff = vnDay(new Date(), VIEWS_KEEP_DAYS);
      // Cung mot tap dong sap bi xoa, gop theo HAI chieu khac nhau:
      //   views_archive  (slug, chap)  -> tong all-time, dung cho "Luot xem" tren site
      //   views_monthly  (slug, month) -> giu lai chieu THOI GIAN de con tinh duoc "nam nay"
      // Bo chieu `chap` o bang thang: so dong = so truyen x so thang, thay vi x so chuong.
      const [old, byMonth] = await Promise.all([
        env.DB.prepare(
          "SELECT slug, chap, SUM(n) AS n FROM views_daily WHERE day < ? GROUP BY slug, chap"
        ).bind(cutoff).all(),
        env.DB.prepare(
          "SELECT slug, substr(day,1,7) AS month, SUM(n) AS n FROM views_daily " +
          "WHERE day < ? GROUP BY slug, month"
        ).bind(cutoff).all(),
      ]);
      if (!old.results.length) return;

      const stmts = old.results.map((r) =>
        env.DB.prepare(
          "INSERT INTO views_archive (slug, chap, n) VALUES (?1, ?2, ?3) " +
          "ON CONFLICT(slug, chap) DO UPDATE SET n = n + ?3"
        ).bind(r.slug, r.chap, r.n)
      );
      for (const r of byMonth.results) {
        stmts.push(env.DB.prepare(
          "INSERT INTO views_monthly (slug, month, n) VALUES (?1, ?2, ?3) " +
          "ON CONFLICT(slug, month) DO UPDATE SET n = n + ?3"
        ).bind(r.slug, r.month, r.n));
      }
      // Dồn vào archive TRƯỚC, xoá SAU, trong cùng một batch (D1 batch chạy trong 1
      // transaction) - xoá trước rồi archive lỗi là mất số vĩnh viễn.
      stmts.push(env.DB.prepare("DELETE FROM views_daily WHERE day < ?").bind(cutoff));
      await env.DB.batch(stmts);
      console.log(`[cron] dồn ${old.results.length} dòng (${byMonth.results.length} theo tháng), xoá ngày < ${cutoff}`);
    })());
  },
};
