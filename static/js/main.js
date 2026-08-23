'use strict';

/* =============================================================
   TRĂNG SAO TRUYỆN — main.js
   Chỉ còn phần TƯƠNG TÁC. Toàn bộ nội dung (danh sách truyện, danh sách chương,
   bảng xếp hạng, nội dung chương) đã được render sẵn thành HTML thật:
     - trang tĩnh  -> scripts/build.py sinh từ data/
     - trang chương -> Worker render từ D1
   File này KHÔNG chứa dữ liệu truyện và KHÔNG dựng danh sách nào.

   Lý do: các link đó là bộ xương link nội bộ để Google tìm ra 600.000 URL chương —
   để JS dựng thì mất crawl budget và có nguy cơ mất hẳn điều hướng khi JS/JSON lỗi.
   ============================================================= */

const PAGE = document.body.dataset.page || '';

/* ---------------------------------------------------------------
   1. LƯU TRỮ CỤC BỘ
   --------------------------------------------------------------- */

const Store = {
  KEYS: {
    SITE_THEME: 'tst_site_theme',   // 'light' | 'dark'
    READER_BG: 'tst_reader_bg',     // 'white' | 'cream' | 'dark'
    FONT_SIZE: 'tst_font_size',     // số px
    READING_POS: 'tst_reading_pos', // { [slug]: chapterNum }
    FAVORITES: 'tst_favorites'      // [slug, ...]
  },

  // Mọi truy cập localStorage đều bọc try/catch: cửa sổ riêng tư và một số webview
  // ném lỗi ngay ở bước đọc, không phải chỉ trả về null.
  _get(k, fallback) {
    try { const v = localStorage.getItem(k); return v === null ? fallback : v; }
    catch (e) { return fallback; }
  },
  _set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  _getJSON(k, fallback) {
    try { return JSON.parse(localStorage.getItem(k)) || fallback; }
    catch (e) { return fallback; }
  },

  getSiteTheme() { return this._get(this.KEYS.SITE_THEME, 'light'); },
  setSiteTheme(v) { this._set(this.KEYS.SITE_THEME, v); },

  getReaderBg() { return this._get(this.KEYS.READER_BG, 'white'); },
  setReaderBg(v) { this._set(this.KEYS.READER_BG, v); },

  getFontSize() { return parseInt(this._get(this.KEYS.FONT_SIZE, '18'), 10) || 18; },
  setFontSize(v) { this._set(this.KEYS.FONT_SIZE, String(v)); },

  getReadingPos(slug) { return this._getJSON(this.KEYS.READING_POS, {})[slug] || null; },
  setReadingPos(slug, n) {
    const all = this._getJSON(this.KEYS.READING_POS, {});
    all[slug] = n;
    this._set(this.KEYS.READING_POS, JSON.stringify(all));
  },

  getFavorites() { return this._getJSON(this.KEYS.FAVORITES, []); },
  isFavorite(slug) { return this.getFavorites().indexOf(slug) !== -1; },
  toggleFavorite(slug) {
    let favs = this.getFavorites();
    favs = favs.indexOf(slug) !== -1 ? favs.filter(s => s !== slug) : favs.concat([slug]);
    this._set(this.KEYS.FAVORITES, JSON.stringify(favs));
    return favs.indexOf(slug) !== -1;
  }
};

// Áp theme TRƯỚC khi vẽ để không nháy trắng rồi mới sang tối.
document.documentElement.setAttribute('data-theme', Store.getSiteTheme());

/* ---------------------------------------------------------------
   2. TIỆN ÍCH
   --------------------------------------------------------------- */

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function formatCount(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'K';
  return String(n);
}

/** "12 phút trước". Tính ở client chứ không nhúng vào HTML lúc build — nhúng sẽ làm mỗi lần
 * build ra HTML khác nhau (mất tính idempotent) và số hiển thị đứng im tới lần build sau. */
function timeAgo(iso) {
  const t = Date.parse(iso);
  if (!t) return '';
  const mins = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (mins < 60) return mins + ' phút trước';
  const h = Math.floor(mins / 60);
  if (h < 24) return h + ' giờ trước';
  return Math.floor(h / 24) + ' ngày trước';
}

function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = x => String(x).padStart(2, '0');
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
}

function qs(name) { return new URLSearchParams(location.search).get(name); }

/** Badge "New" cho truyện cập nhật dưới 1 giờ. Build không nhúng được (phụ thuộc thời điểm),
 * nên build chỉ ghi data-updated và đây là chỗ gắn badge. */
function markNewBadges() {
  document.querySelectorAll('[data-updated]').forEach(el => {
    const t = Date.parse(el.dataset.updated);
    if (!t || Date.now() - t > 3600000) return;
    const line = el.querySelector('.category-row-title-line');
    if (line && !line.querySelector('.row-badge-new')) {
      const b = document.createElement('span');
      b.className = 'row-badge row-badge-new';
      b.textContent = 'New';
      line.appendChild(b);
    }
  });
}

/* ---------------------------------------------------------------
   3. HEADER: tìm kiếm, dropdown, menu mobile, dark mode
   --------------------------------------------------------------- */

function initHeader() {
  // --- dropdown ---
  // CSS là `.nav-dropdown-menu.is-open { display: block }` — class phải nằm trên MENU, KHÔNG
  // phải trên thẻ cha `.nav-dropdown`. Gắn sai chỗ thì `is-open` vẫn được thêm, DOM vẫn đổi,
  // nhưng menu không bao giờ hiện ra. Đây là bug thật đã gặp: chỉ lộ khi mở trên trình duyệt,
  // không lộ qua đọc code hay kiểm HTML.
  const menus = document.querySelectorAll('.nav-dropdown-menu, .section-filter-menu');
  function closeAllMenus() { menus.forEach(m => m.classList.remove('is-open')); }

  document.querySelectorAll('.nav-dropdown-toggle, .section-filter-toggle').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const menu = btn.nextElementSibling;
      if (!menu) return;
      const wasOpen = menu.classList.contains('is-open');
      closeAllMenus();
      menu.classList.toggle('is-open', !wasOpen);
    });
  });
  document.addEventListener('click', closeAllMenus);

  // --- menu mobile ---
  const menuToggle = document.querySelector('.menu-toggle');
  if (menuToggle) {
    menuToggle.addEventListener('click', e => {
      e.stopPropagation();
      document.querySelector('.main-nav').classList.toggle('is-open');
      menuToggle.classList.toggle('is-active');   // CSS đổi 3 vạch thành dấu X
    });
  }

  // --- dark mode ---
  const themeItems = document.querySelectorAll('.theme-toggle-item');
  function paintTheme() {
    const dark = Store.getSiteTheme() === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    themeItems.forEach(it => {
      const icon = it.querySelector('.theme-toggle-icon');
      const label = it.querySelector('.theme-toggle-label');
      if (icon) icon.textContent = dark ? '☀️' : '🌙';
      if (label) label.textContent = dark ? 'Chế độ sáng' : 'Chế độ tối';
    });
  }
  themeItems.forEach(it => it.addEventListener('click', () => {
    Store.setSiteTheme(Store.getSiteTheme() === 'dark' ? 'light' : 'dark');
    paintTheme();
  }));
  paintTheme();

  initSearch();
}

/** Tìm kiếm đọc /data/search-index.json (build.py sinh: slug + tên + tác giả + số chương).
 * Tải LAZY khi người dùng gõ lần đầu, không tải sẵn lúc mở trang — 2.000 truyện là ~250KB,
 * đa số khách không dùng ô tìm kiếm. */
function initSearch() {
  const input = document.querySelector('.search-input');
  const results = document.querySelector('.search-results');
  if (!input || !results) return;

  let index = null;
  let loading = null;

  function load() {
    if (index) return Promise.resolve(index);
    if (!loading) {
      loading = fetch('/data/search-index.json')
        .then(r => r.ok ? r.json() : [])
        .then(j => { index = j; return j; })
        .catch(() => { index = []; return index; });
    }
    return loading;
  }

  // Bỏ dấu để "tieng noi" khớp "Tiếng Nói" — người dùng gõ không dấu là chuyện bình thường.
  function fold(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd');
  }

  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const q = fold(input.value.trim());
      if (q.length < 2) { results.innerHTML = ''; results.classList.remove('is-open'); return; }
      load().then(list => {
        const hits = list.filter(n => fold(n.t).indexOf(q) !== -1 || fold(n.a).indexOf(q) !== -1)
          .slice(0, 8);
        results.innerHTML = hits.length
          ? hits.map(n =>
              '<a class="search-result-row" href="/truyen/' + encodeURIComponent(n.s) + '/">' +
              '<span class="search-result-title">' + esc(n.t) + '</span>' +
              '<span class="search-result-meta">' + esc(n.a) + ' · ' + n.c + ' chương</span></a>'
            ).join('')
          : '<div class="search-empty">Không tìm thấy truyện nào.</div>';
        results.classList.add('is-open');
      });
    }, 180);
  });

  input.closest('form').addEventListener('submit', e => e.preventDefault());
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-box')) results.classList.remove('is-open');
  });
}

/* ---------------------------------------------------------------
   4. TRANG CHỦ
   --------------------------------------------------------------- */

// Trang chủ không còn việc riêng: dropdown lọc theo thể loại đã do initHeader() xử lý chung
// với các dropdown khác (cùng một cơ chế `....-menu.is-open`).
function initHomePage() {}

/* ---------------------------------------------------------------
   5. TRANG PHÂN LOẠI — sắp xếp lại các dòng ĐÃ render, không fetch dữ liệu
   --------------------------------------------------------------- */

function initCategoryPage() {
  const list = document.querySelector('.category-list');
  if (!list) return;

  // ?so-chuong= và ?sort= là bộ lọc phía client trên đúng những dòng của trang này. Không
  // nạp thêm dữ liệu: mỗi trang phân loại chỉ có 40 dòng, lọc/sắp xếp trong DOM là đủ.
  const rows = Array.from(list.querySelectorAll('.category-row'));
  const chapCount = row => {
    const m = (row.querySelector('.category-row-chapter') || {}).textContent || '';
    return parseInt(m.replace(/\D/g, ''), 10) || 0;
  };

  const range = qs('so-chuong');
  if (range) {
    rows.forEach(r => {
      const c = chapCount(r);
      const ok = range === 'under20' ? c < 20
        : range === '20to50' ? (c >= 20 && c <= 50)
        : range === 'over100' ? c > 100 : true;
      r.hidden = !ok;
    });
  }

  const sort = qs('sort');
  if (sort === 'new') {
    rows.slice().sort((a, b) =>
      Date.parse(b.dataset.updated || 0) - Date.parse(a.dataset.updated || 0)
    ).forEach(r => list.appendChild(r));
  } else if (sort === 'hot') {
    rows.slice().sort((a, b) =>
      (b.querySelector('.row-badge-hot') ? 1 : 0) - (a.querySelector('.row-badge-hot') ? 1 : 0)
    ).forEach(r => list.appendChild(r));
  }

  const visible = rows.filter(r => !r.hidden).length;
  if (!visible) {
    const empty = document.createElement('li');
    empty.className = 'category-row';
    empty.innerHTML = '<em>Không có truyện nào khớp bộ lọc này.</em>';
    list.appendChild(empty);
  }
}

/* ---------------------------------------------------------------
   6. TRANG CHI TIẾT TRUYỆN
   --------------------------------------------------------------- */

const CHAPTERS_PER_PAGE = 50;

function initDetailPage() {
  const slug = location.pathname.replace(/^\/truyen\/|\/$/g, '');

  // --- xem thêm mô tả ---
  const desc = document.querySelector('.detail-description');
  const descToggle = document.querySelector('.detail-desc-toggle');
  if (desc && descToggle) {
    // Mô tả ngắn thì không cần nút — ẩn đi thay vì để một nút không làm gì.
    if (desc.scrollHeight <= desc.clientHeight + 4) {
      descToggle.hidden = true;
    } else {
      descToggle.addEventListener('click', () => {
        const open = desc.classList.toggle('is-expanded');
        descToggle.textContent = open ? '« Thu gọn' : 'Xem thêm »';
      });
    }
  }

  // --- yêu thích ---
  const favBtn = document.querySelector('.btn-favorite');
  if (favBtn) {
    const paint = on => { favBtn.textContent = (on ? '♥' : '♡') + ' Yêu thích truyện';
                          favBtn.classList.toggle('is-active', on); };
    paint(Store.isFavorite(slug));
    favBtn.addEventListener('click', () => paint(Store.toggleFavorite(slug)));
  }

  // --- tab bảng xếp hạng: cả 3 danh sách đã render sẵn, chỉ ẩn/hiện ---
  const tabs = document.querySelectorAll('.hot-tab');
  tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('is-active'));
    tab.classList.add('is-active');
    document.querySelectorAll('.hot-rank-list').forEach(ul => {
      ul.hidden = ul.dataset.period !== tab.dataset.period;
    });
  }));

  initChapterPagination(slug);
  initCommentSection(slug);
}

/** Phân trang danh sách chương: TOÀN BỘ <li> đã nằm trong HTML (bộ xương link nội bộ cho
 * SEO) — hàm này chỉ ẩn/hiện, KHÔNG bao giờ tạo hay xoá link. */
function initChapterPagination(slug) {
  const list = document.querySelector('.chapter-bullet-list');
  const pager = document.querySelector('.chapter-pagination');
  if (!list || !pager) return;
  const items = Array.from(list.querySelectorAll('li[data-chapter]'));
  if (items.length <= CHAPTERS_PER_PAGE) return;

  const pages = Math.ceil(items.length / CHAPTERS_PER_PAGE);
  let page = 1;

  // Mở đúng trang chứa chương đang đọc dở — với truyện 620 chương, mở ra trang 1 rồi bắt
  // người đọc bấm 12 lần là vô nghĩa.
  const pos = Store.getReadingPos(slug);
  if (pos) {
    const i = items.findIndex(li => Number(li.dataset.chapter) === Number(pos));
    if (i >= 0) page = Math.floor(i / CHAPTERS_PER_PAGE) + 1;
  }

  function paint() {
    const from = (page - 1) * CHAPTERS_PER_PAGE;
    items.forEach((li, i) => { li.hidden = i < from || i >= from + CHAPTERS_PER_PAGE; });
    const btn = (label, target, cls) =>
      '<button type="button" class="chapter-page-btn' + (cls || '') + '" data-page="' + target + '">' +
      label + '</button>';
    let html = '';
    if (page > 1) html += btn('‹', page - 1);
    for (let p = 1; p <= pages; p++) {
      if (p === page) html += btn(p, p, ' is-active');
      else if (p <= 2 || p >= pages - 1 || Math.abs(p - page) <= 2) html += btn(p, p);
      else if (Math.abs(p - page) === 3) html += '<span class="chapter-page-ellipsis">…</span>';
    }
    if (page < pages) html += btn('›', page + 1);
    pager.innerHTML = html;
  }

  pager.addEventListener('click', e => {
    const b = e.target.closest('[data-page]');
    if (!b) return;
    page = Number(b.dataset.page);
    paint();
    list.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  paint();
}

/* ---------------------------------------------------------------
   7. BÌNH LUẬN — qua Worker API, không còn localStorage
   --------------------------------------------------------------- */

function initCommentSection(slug) {
  const section = document.querySelector('.comment-section');
  if (!section) return;
  const listEl = section.querySelector('.comment-list');
  const textarea = section.querySelector('.comment-textarea');
  const charCount = section.querySelector('.comment-char-count');
  const submitBtn = section.querySelector('.comment-submit-btn');
  const refreshBtn = section.querySelector('.comment-refresh-btn');
  const summary = section.querySelector('.comment-summary');
  const picker = section.querySelector('.comment-star-picker');
  let rating = 5;

  if (picker) {
    const stars = picker.querySelectorAll('.star-btn');
    const paint = () => stars.forEach(s =>
      s.classList.toggle('is-on', Number(s.dataset.value) <= rating));
    stars.forEach(s => s.addEventListener('click', () => {
      rating = Number(s.dataset.value); picker.dataset.rating = rating; paint();
    }));
    paint();
  }

  if (textarea && charCount) {
    const upd = () => { charCount.textContent = textarea.value.length + '/500'; };
    textarea.addEventListener('input', upd); upd();
  }

  function render(data) {
    if (summary) {
      summary.textContent = data.nominations
        ? data.nominations + ' bình luận · ' + (data.rating || '—') + '/5'
        : 'Chưa có bình luận';
    }
    if (!listEl) return;
    if (!data.comments || !data.comments.length) {
      listEl.innerHTML = '<p class="comment-empty">Chưa có bình luận nào. Hãy là người đầu tiên!</p>';
      return;
    }
    // esc() ở đây là BẮT BUỘC: Worker lưu comment nguyên văn (không escape ở tầng lưu),
    // escape là việc của chỗ hiển thị. Escape cả 2 nơi sẽ ra "&amp;lt;" trên trang.
    listEl.innerHTML = data.comments.map(c =>
      '<article class="comment-item">' +
      '<div class="comment-item-head">' +
      '<span class="comment-author">' + esc(c.name) + '</span>' +
      (c.rating ? '<span class="comment-stars">' + '★'.repeat(c.rating) + '☆'.repeat(5 - c.rating) + '</span>' : '') +
      '<span class="comment-date">' + esc(fmtDate(c.created_at)) + '</span>' +
      '</div><p class="comment-body">' + esc(c.body) + '</p></article>'
    ).join('');
  }

  function load() {
    if (listEl) listEl.innerHTML = '<p class="comment-empty">Đang tải bình luận...</p>';
    fetch('/_api/comments/' + encodeURIComponent(slug))
      .then(r => r.ok ? r.json() : { comments: [] })
      .then(render)
      .catch(() => {
        if (listEl) listEl.innerHTML =
          '<p class="comment-empty">Không tải được bình luận. Thử lại sau.</p>';
      });
  }

  if (refreshBtn) refreshBtn.addEventListener('click', load);

  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const nameEl = section.querySelector('.comment-name-input');
      const body = textarea ? textarea.value.trim() : '';
      if (!body) { textarea && textarea.focus(); return; }
      submitBtn.disabled = true;
      fetch('/_api/comment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: slug,
          name: (nameEl && nameEl.value.trim()) || 'Khách',
          rating: rating,
          body: body,
          // Honeypot: field ẩn bằng CSS, người thật luôn để trống. Worker loại âm thầm.
          website: (section.querySelector('.comment-hp') || {}).value || ''
        })
      })
        .then(r => r.json().then(j => ({ ok: r.ok, j })))
        .then(({ ok, j }) => {
          if (!ok) throw new Error(j.error || 'Gửi thất bại');
          if (textarea) { textarea.value = ''; textarea.dispatchEvent(new Event('input')); }
          load();
        })
        .catch(err => alert(err.message))
        .finally(() => { submitBtn.disabled = false; });
    });
  }

  load();
}

/* ---------------------------------------------------------------
   8. TRANG ĐỌC CHƯƠNG (Worker render)
   --------------------------------------------------------------- */

function initReaderPage() {
  const slug = document.body.dataset.slug || '';
  const n = Number(document.body.dataset.chuong || 0);
  if (slug && n) Store.setReadingPos(slug, n);

  initReaderSettings();
  initChapterListDropdown();
  initReaderKeyboardNav();
  countView(slug);
}

/** Đếm lượt xem: 1 POST cho mỗi trang chương mở ra. Đây là nguồn duy nhất của bảng xếp hạng
 * ngày/tuần/tháng (Worker ghi vào D1, GAS gom mỗi ngày vào data/stories.json). */
function countView(slug) {
  if (!slug) return;
  fetch('/_api/view', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slug: slug }),
    keepalive: true
  }).catch(() => {});
}

function initReaderSettings() {
  const content = document.querySelector('.reader-content');
  const label = document.querySelector('.font-size-label');

  // `.settings-panel` bị CSS ẩn (`display:none`) và chỉ hiện khi có `.is-open`. Bản gốc có
  // hàm xử lý nút này nhưng HTML lại KHÔNG có nút nào — nên cỡ chữ/màu nền không bao giờ
  // mở được. Đã thêm nút vào layouts/chapter.html, đây là chỗ nối dây.
  const panel = document.querySelector('.settings-panel');
  const panelToggle = document.querySelector('.settings-toggle');
  if (panel && panelToggle) {
    panelToggle.addEventListener('click', e => {
      e.stopPropagation();
      panel.classList.toggle('is-open');
    });
  }

  function applyFont() {
    const size = Store.getFontSize();
    if (content) content.style.fontSize = size + 'px';
    if (label) label.textContent = size + 'px';
  }
  const dec = document.querySelector('.font-decrease');
  const inc = document.querySelector('.font-increase');
  if (dec) dec.addEventListener('click', () => {
    Store.setFontSize(Math.max(14, Store.getFontSize() - 1)); applyFont();
  });
  if (inc) inc.addEventListener('click', () => {
    Store.setFontSize(Math.min(28, Store.getFontSize() + 1)); applyFont();
  });
  applyFont();

  const opts = document.querySelectorAll('.bg-option');
  function applyBg() {
    const bg = Store.getReaderBg();
    document.body.setAttribute('data-reader-bg', bg);
    opts.forEach(o => o.classList.toggle('is-active', o.dataset.bg === bg));
  }
  opts.forEach(o => o.addEventListener('click', () => { Store.setReaderBg(o.dataset.bg); applyBg(); }));
  applyBg();
}

/** Dropdown danh sách chương: fetch /truyen/<slug>/chapters.json khi bấm lần đầu.
 * Không nhúng vào HTML: 620 link x 60B = 37KB, giống hệt nhau ở cả 620 trang chương —
 * và không cần cho SEO vì trang chi tiết truyện đã có đủ link dạng HTML thật. */
function initChapterListDropdown() {
  const toggles = document.querySelectorAll('.chapter-list-toggle');
  const drops = document.querySelectorAll('.chapter-list-dropdown');
  if (!toggles.length || !drops.length) return;
  const current = Number(document.body.dataset.chuong || 0);
  let loaded = false;

  function fill(chapters) {
    const slug = document.body.dataset.slug || '';
    const html = chapters.map(c =>
      '<a class="chapter-list-item' + (c.n === current ? ' is-active' : '') +
      '" href="/truyen/' + encodeURIComponent(slug) + '/chuong-' + c.n + '/">' +
      esc(c.title) + '</a>').join('');
    drops.forEach(d => { d.innerHTML = html; });
  }

  /** PHẢI gọi SAU khi dropdown đã hiện. Lúc còn `display:none` thì `offsetTop` và
   * `clientHeight` đều bằng 0, nên scrollTop tính ra 0 — mở danh sách ở chương 500 lại thấy
   * chương 1 ở đầu và phải cuộn tay. Bug thật đã gặp. */
  function scrollActiveIntoView(d) {
    const active = d.querySelector('.chapter-list-item.is-active');
    if (active) d.scrollTop = Math.max(0, active.offsetTop - d.clientHeight / 2);
  }

  function ensure(src) {
    if (loaded) return Promise.resolve();
    loaded = true;
    return fetch(src)
      .then(r => r.ok ? r.json() : null)
      // chapters.json là object {title, slug, chapters} — Worker cần tên truyện trong đó.
      .then(j => fill((j && j.chapters) || []))
      .catch(() => { drops.forEach(d => { d.innerHTML =
        '<div class="chapter-list-empty">Không tải được danh sách chương.</div>'; }); });
  }

  toggles.forEach(t => t.addEventListener('click', e => {
    e.stopPropagation();
    const drop = t.closest('.chapter-nav').querySelector('.chapter-list-dropdown');
    ensure(drop.dataset.chaptersSrc).then(() => {
      const opening = !drop.classList.contains('is-open');
      drop.classList.toggle('is-open', opening);
      if (opening) scrollActiveIntoView(drop);
    });
  }));
  document.addEventListener('click', e => {
    if (!e.target.closest('.chapter-nav')) {
      drops.forEach(d => d.classList.remove('is-open'));
    }
  });
}

function initReaderKeyboardNav() {
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea')) return;
    const sel = e.key === 'ArrowLeft' ? '.btn-prev-chapter'
      : e.key === 'ArrowRight' ? '.btn-next-chapter' : null;
    if (!sel) return;
    const a = document.querySelector(sel + ':not(.is-disabled)');
    if (a && a.getAttribute('href') && a.getAttribute('href') !== '#') location.href = a.href;
  });
}

/* ---------------------------------------------------------------
   9. KHỞI CHẠY
   --------------------------------------------------------------- */

initHeader();
markNewBadges();

if (PAGE === 'home') initHomePage();
else if (PAGE === 'category') initCategoryPage();
else if (PAGE === 'detail') initDetailPage();
else if (PAGE === 'reader') initReaderPage();
