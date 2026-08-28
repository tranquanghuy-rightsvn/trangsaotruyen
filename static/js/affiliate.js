'use strict';

/* =============================================================
   TRĂNG SAO TRUYỆN — affiliate.js
   Toàn bộ hành vi affiliate của site, đọc cấu hình từ /data/affiliate.json
   (file do CMS (Google Apps Script) sinh ra — xem gas/Code.js: saveAffiliate).

   4 kịch bản, bật/tắt độc lập bằng cách để số giây / tỉ lệ = 0:
     1. Xoay link  — mỗi `rotate_sec` giây chọn ngẫu nhiên lại 1 link trong danh sách.
     2. Chuyển chương — đổi chương (bấm nút hoặc phím mũi tên trái/phải) có
        `next_chapter_rate`% hiện bảng tài trợ.
     3. Ở lại web  — sau `click_delay_sec` giây, cú chạm/click kế tiếp mở link (tab mới).
     4. Lần đầu vào web — sau `first_visit_delay_sec` giây thì hiện banner (hoặc nhảy link).

   File này CỐ Ý tách khỏi main.js: tắt tính năng chỉ cần bỏ 1 thẻ <script> trong
   layouts/_head.html, và mọi thứ ở đây đều bọc trong try/catch + IIFE để một lỗi
   cấu hình không kéo đổ phần đọc truyện.
   ============================================================= */

(function () {
  const CFG_URL = '/data/affiliate.json';

  // Mặc định = TẮT. Thiếu file cấu hình / file hỏng thì site chạy y như chưa có tính năng.
  const DEFAULTS = {
    enabled: false,
    links: [],
    rotate_sec: 30,
    next_chapter_rate: 0,
    click_delay_sec: 0,
    click_cooldown_sec: 600,
    first_visit_delay_sec: 0,
    first_visit_mode: 'banner',   // 'banner' | 'redirect'
    max_per_session: 0,           // 0 = không giới hạn
    open_in_new_tab: true,
    chapter_panel: {
      enabled: true, title: '', message: '', image: '',
      button_text: 'Xem ngay', skip_text: 'Bỏ qua, đọc tiếp', auto_continue_sec: 0
    },
    banner: {
      enabled: true, title: '', message: '', image: '',
      button_text: 'Xem ngay', link: '', position: 'center',
      auto_close_sec: 0, repeat_hours: 24
    }
  };

  // sessionStorage = theo TAB (thời gian ở lại, link đang xoay, số lần đã bắn trong phiên).
  const SS = { TIME: 'tst_aff_time', COUNT: 'tst_aff_count', PICK: 'tst_aff_pick' };
  // localStorage = theo TRÌNH DUYỆT (đã thấy banner lần đầu chưa, lần chạm gần nhất).
  const LS = { FIRST: 'tst_aff_first', TAP: 'tst_aff_tap' };

  // Cửa sổ riêng tư và vài webview ném lỗi ngay ở bước ĐỌC storage — bọc hết như main.js.
  function get(store, k, fallback) {
    try { const v = store.getItem(k); return v === null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function set(store, k, v) { try { store.setItem(k, String(v)); } catch (e) {} }
  const ss = (k, d) => get(sessionStorage, k, d);
  const ssSet = (k, v) => set(sessionStorage, k, v);
  const ls = (k, d) => get(localStorage, k, d);
  const lsSet = (k, v) => set(localStorage, k, v);

  const num = (v, d) => (isFinite(Number(v)) ? Number(v) : d);

  let CFG = null;
  let elapsed = 0;        // số giây đã ở lại web trong phiên này
  let tapArmed = false;   // trigger "chạm màn hình" đã lên nòng chưa
  let suppressUntil = 0;  // xem onTap(): chặn 2 kịch bản cùng bắn trên MỘT cú bấm

  /* -----------------------------------------------------------
     Nạp cấu hình
     ----------------------------------------------------------- */

  function normalize(raw) {
    const c = Object.assign({}, DEFAULTS, raw || {});
    c.chapter_panel = Object.assign({}, DEFAULTS.chapter_panel, (raw && raw.chapter_panel) || {});
    c.banner = Object.assign({}, DEFAULTS.banner, (raw && raw.banner) || {});
    // Admin nhập link ngăn nhau bằng ";" — CMS đã tách sẵn thành mảng, nhưng vẫn chấp nhận
    // chuỗi thô để sửa tay data/affiliate.json cũng chạy được.
    if (typeof c.links === 'string') c.links = c.links.split(/[;\r\n]+/);
    c.links = (c.links || []).map(s => String(s).trim()).filter(Boolean);
    c.rotate_sec = Math.max(1, num(c.rotate_sec, 30));
    c.next_chapter_rate = Math.min(100, Math.max(0, num(c.next_chapter_rate, 0)));
    c.click_delay_sec = Math.max(0, num(c.click_delay_sec, 0));
    c.click_cooldown_sec = Math.max(0, num(c.click_cooldown_sec, 0));
    c.first_visit_delay_sec = Math.max(0, num(c.first_visit_delay_sec, 0));
    c.max_per_session = Math.max(0, num(c.max_per_session, 0));
    return c;
  }

  fetch(CFG_URL, { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() : null))
    .then(j => {
      CFG = normalize(j);
      if (!CFG.enabled || !CFG.links.length) return;
      initChapterNav();
      initStayTimer();
      initFirstVisit();
    })
    .catch(() => {});

  /* -----------------------------------------------------------
     1. Xoay link + hạn mức
     ----------------------------------------------------------- */

  /** Link affiliate đang có hiệu lực. Giữ trong sessionStorage kèm hạn dùng nên chuyển
   * trang (chương này sang chương khác) vẫn là CÙNG một link cho tới khi hết `rotate_sec`
   * giây — nếu chọn lại mỗi lần tải trang thì "xoay theo số giây" không còn ý nghĩa. */
  function pickLink() {
    if (!CFG.links.length) return '';
    let saved = null;
    try { saved = JSON.parse(ss(SS.PICK, 'null')); } catch (e) {}
    if (saved && saved.exp > Date.now() && CFG.links.indexOf(saved.url) !== -1) return saved.url;
    const url = CFG.links[Math.floor(Math.random() * CFG.links.length)];
    ssSet(SS.PICK, JSON.stringify({ url: url, exp: Date.now() + CFG.rotate_sec * 1000 }));
    return url;
  }

  function capReached() {
    if (!CFG.max_per_session) return false;
    return Number(ss(SS.COUNT, 0)) >= CFG.max_per_session;
  }

  function countFire() { ssSet(SS.COUNT, Number(ss(SS.COUNT, 0)) + 1); }

  /** Mở link. Mặc định tab mới để KHÔNG cướp trang người dùng đang đọc; trình duyệt chặn
   * popup thì mới đành đi cùng tab. Chỉ gọi trong một cử chỉ thật của người dùng
   * (click/chạm/bấm nút) — ngoài cử chỉ thì window.open bị chặn im lặng. */
  function openLink(url) {
    if (!url) return;
    countFire();
    if (!CFG.open_in_new_tab) { location.href = url; return; }
    const w = window.open(url, '_blank', 'noopener');
    if (!w) location.href = url;
  }

  /* -----------------------------------------------------------
     Popup dùng chung (bảng chuyển chương + banner)
     ----------------------------------------------------------- */

  function closeOverlay(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    document.documentElement.classList.remove('aff-locked');
  }

  /** opts: {title,message,image,buttonText,href,skipText,onSkip,onClose,position,
   *         countdownSec,countdownText,onCountdownEnd} */
  function showOverlay(opts) {
    const ov = document.createElement('div');
    ov.className = 'aff-overlay' + (opts.position === 'bottom' ? ' aff-overlay-bottom' : '');

    const box = document.createElement('div');
    box.className = 'aff-box';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'aff-close';
    close.setAttribute('aria-label', 'Đóng');
    close.textContent = '×';
    box.appendChild(close);

    if (opts.image) {
      const img = document.createElement('img');
      img.className = 'aff-img';
      img.src = opts.image;
      img.alt = '';
      img.loading = 'lazy';
      box.appendChild(img);
    }
    if (opts.title) {
      const h = document.createElement('div');
      h.className = 'aff-title';
      h.textContent = opts.title;
      box.appendChild(h);
    }
    if (opts.message) {
      const p = document.createElement('p');
      p.className = 'aff-msg';
      p.textContent = opts.message;
      box.appendChild(p);
    }

    // Nút chính là thẻ <a target="_blank"> THẬT chứ không phải window.open trong JS:
    // click vào link không bao giờ bị chặn popup, kể cả trên Safari iOS.
    const btn = document.createElement('a');
    btn.className = 'aff-btn';
    btn.href = opts.href || '#';
    btn.target = CFG.open_in_new_tab ? '_blank' : '_self';
    btn.rel = 'nofollow sponsored noopener';
    btn.textContent = opts.buttonText || 'Xem ngay';
    btn.addEventListener('click', () => {
      countFire();
      // Mở tab mới thì tab hiện tại vẫn ở lại -> đưa người đọc sang chương tiếp luôn.
      // Mở cùng tab (open_in_new_tab = false) thì KHÔNG được đụng vào location nữa,
      // nếu không sẽ tranh nhau điều hướng và link affiliate mất tác dụng.
      if (opts.onSkip && CFG.open_in_new_tab) setTimeout(opts.onSkip, 300);
      else if (!opts.onSkip) closeOverlay(ov);
    });
    box.appendChild(btn);

    const note = document.createElement('div');
    note.className = 'aff-note';
    note.textContent = 'Nội dung được tài trợ';
    box.appendChild(note);

    let skip = null;
    if (opts.skipText) {
      skip = document.createElement('button');
      skip.type = 'button';
      skip.className = 'aff-skip';
      skip.textContent = opts.skipText;
      box.appendChild(skip);
    }

    ov.appendChild(box);
    document.body.appendChild(ov);
    document.documentElement.classList.add('aff-locked');

    function done() {
      closeOverlay(ov);
      if (opts.onClose) opts.onClose();
    }
    close.addEventListener('click', done);
    ov.addEventListener('click', e => { if (e.target === ov) done(); });
    if (skip) {
      skip.addEventListener('click', () => {
        closeOverlay(ov);
        if (opts.onSkip) opts.onSkip();
        else if (opts.onClose) opts.onClose();
      });
    }

    // Đếm ngược: bảng chuyển chương thì tự đọc tiếp, banner thì tự đóng.
    let left = Math.max(0, num(opts.countdownSec, 0));
    if (left) {
      const cd = document.createElement('div');
      cd.className = 'aff-countdown';
      box.appendChild(cd);
      const tick = () => {
        cd.textContent = (opts.countdownText || 'Tự động đóng sau {s}s').replace('{s}', left);
        if (left <= 0) {
          clearInterval(timer);
          closeOverlay(ov);
          if (opts.onCountdownEnd) opts.onCountdownEnd();
        }
        left -= 1;
      };
      const timer = setInterval(tick, 1000);
      tick();
    }
    return ov;
  }

  /* -----------------------------------------------------------
     2. Chuyển chương: tỉ lệ % dẫn sang affiliate (nút bấm VÀ phím mũi tên)
     ----------------------------------------------------------- */

  /** Cửa chung của kịch bản chuyển chương: quay xúc xắc, trúng thì hiện bảng và trả về true
   * (nơi gọi có nhiệm vụ CHẶN cú điều hướng gốc lại). Trượt thì trả false — người đọc đi
   * tiếp như bình thường, không hay biết gì. */
  function interceptChapterNav(destHref) {
    if (!destHref || destHref === '#') return false;
    if (capReached()) return false;
    if (Math.random() * 100 >= CFG.next_chapter_rate) return false;
    const url = pickLink();
    if (!url) return false;

    // Cú thao tác này đã "thuộc về" kịch bản chuyển chương. Không có dòng dưới thì cú bấm ở
    // giây thứ 350+ vừa hiện bảng chuyển chương vừa bị onTap() mở thêm 1 tab nữa:
    // stopPropagation() KHÔNG chặn được listener khác cùng gắn trên document.
    suppressUntil = Date.now() + 2000;

    const p = CFG.chapter_panel;
    const go = () => { location.href = destHref; };
    if (!p.enabled) { openLink(url); go(); return true; }
    showOverlay({
      title: p.title, message: p.message, image: p.image,
      buttonText: p.button_text, href: url,
      skipText: p.skip_text || 'Đọc tiếp',
      onSkip: go, onClose: go,
      countdownSec: p.auto_continue_sec,
      countdownText: 'Tự động đọc tiếp sau {s}s',
      onCountdownEnd: go
    });
    return true;
  }

  function initChapterNav() {
    if (!CFG.next_chapter_rate) return;

    // (a) Bấm/chạm nút "Chương trước" / "Chương tiếp" (có cả ở đầu và cuối trang).
    // capture=true: chạy TRƯỚC mọi handler khác, kể cả handler điều hướng của main.js.
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('.btn-next-chapter, .btn-prev-chapter');
      if (!a || a.classList.contains('is-disabled')) return;
      if (!a.getAttribute('href') || a.getAttribute('href') === '#') return;
      if (!interceptChapterNav(a.href)) return;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    // (b) Phím mũi tên trái/phải — main.js (initReaderKeyboardNav) tự nhảy trang bằng
    // location.href nên KHÔNG đi qua nhánh (a). Không bắt riêng ở đây thì người đọc dùng bàn
    // phím sẽ không bao giờ gặp bảng tài trợ, tỉ lệ đặt trong CMS thành ra sai so với thực tế.
    //
    // Bắt ở pha CAPTURE của document rồi stopImmediatePropagation(): listener của main.js gắn
    // ở pha bubble CÙNG trên document, nên sau lệnh này nó không chạy - không có chuyện vừa
    // hiện bảng vừa nhảy trang.
    document.addEventListener('keydown', e => {
      if (e.target.matches && e.target.matches('input, textarea')) return;
      const sel = e.key === 'ArrowLeft' ? '.btn-prev-chapter'
        : e.key === 'ArrowRight' ? '.btn-next-chapter' : null;
      if (!sel) return;
      const a = document.querySelector(sel + ':not(.is-disabled)');
      if (!a || !a.getAttribute('href') || a.getAttribute('href') === '#') return;
      if (!interceptChapterNav(a.href)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
  }

  /* -----------------------------------------------------------
     3. Sau x giây ở lại web: cú chạm kế tiếp mở link
     ----------------------------------------------------------- */

  function initStayTimer() {
    if (!CFG.click_delay_sec) return;
    elapsed = Number(ss(SS.TIME, 0)) || 0;   // cộng dồn qua các trang trong cùng tab
    const tick = () => {
      if (document.hidden) return;           // mở tab nền không tính là "ở lại web"
      elapsed += 1;
      ssSet(SS.TIME, elapsed);
      if (elapsed >= CFG.click_delay_sec) arm();
    };
    setInterval(tick, 1000);
    if (elapsed >= CFG.click_delay_sec) arm();
  }

  function arm() {
    if (tapArmed) return;
    const last = Number(ls(LS.TAP, 0)) || 0;
    if (last && Date.now() - last < CFG.click_cooldown_sec * 1000) return; // còn trong thời gian nghỉ
    tapArmed = true;
    document.addEventListener('click', onTap, true);
    document.addEventListener('touchstart', onTap, true);
  }

  function disarm() {
    tapArmed = false;
    document.removeEventListener('click', onTap, true);
    document.removeEventListener('touchstart', onTap, true);
  }

  /** KHÔNG preventDefault: người dùng bấm gì vẫn được cái đó, link affiliate mở ở tab mới. */
  function onTap(e) {
    if (!tapArmed) return;
    if (Date.now() < suppressUntil) return;                            // kịch bản khác vừa bắn
    if (document.querySelector('.aff-overlay')) return;                // đang có popup mở
    if (e.target.closest && e.target.closest('.aff-overlay')) return;  // đang thao tác trong popup
    if (capReached()) { disarm(); return; }
    disarm();
    lsSet(LS.TAP, Date.now());
    elapsed = 0;
    ssSet(SS.TIME, 0);
    openLink(pickLink());
  }

  /* -----------------------------------------------------------
     4. Lần đầu truy cập: sau x giây thì hiện banner (hoặc nhảy link)
     ----------------------------------------------------------- */

  function initFirstVisit() {
    if (!CFG.first_visit_delay_sec) return;
    const b = CFG.banner;
    const last = Number(ls(LS.FIRST, 0)) || 0;
    const repeatMs = Math.max(0, num(b.repeat_hours, 0)) * 3600000;
    // repeat_hours = 0 -> đúng nghĩa "lần đầu": hiện một lần duy nhất trên máy đó.
    if (last && (!repeatMs || Date.now() - last < repeatMs)) return;

    setTimeout(() => {
      if (capReached()) return;
      lsSet(LS.FIRST, Date.now());
      const url = b.link || pickLink();
      if (!url) return;
      if (CFG.first_visit_mode === 'redirect') { countFire(); location.href = url; return; }
      if (!b.enabled) return;
      showOverlay({
        title: b.title, message: b.message, image: b.image,
        buttonText: b.button_text, href: url,
        position: b.position,
        countdownSec: b.auto_close_sec,
        countdownText: 'Tự động đóng sau {s}s'
      });
    }, CFG.first_visit_delay_sec * 1000);
  }
})();
