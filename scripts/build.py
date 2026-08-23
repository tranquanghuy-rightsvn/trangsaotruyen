#!/usr/bin/env python3
"""
Sinh site tinh tang 1 tu data/ + layouts/ + static/  ->  html/

KHONG dung thu vien ngoai (chay tren GitHub Actions khong can pip install): chi doc
layouts/*.html voi placeholder {{TOKEN}} roi thay bang str.replace(). Cac khoi lap
(the truyen, dong bang, dong chuong...) cung la file trong layouts/ - de sua design
khong phai mo file .py.

LUU Y VE THU MUC: design SONG nam trong layouts/. Thu muc templates/ chi chua ban goc 7
trang HTML tinh ban dau de doi chieu bang mat - KHONG tham gia build, xoa di build van chay.

CAI GI KHONG sinh o day:
  - Trang chuong /truyen/<slug>/chuong-<n>: Worker render tu D1 luc co request. 600.000
    trang chuong khong the la file tinh (gioi han Cloudflare Static Assets: 20.000 file).
    build.py chi sinh SAN template da resolve san header/footer -> html/_tpl/chapter.html
  - Noi dung chuong: nam trong D1, khong nam trong git.

QUY TAC BAT BUOC - build phai IDEMPOTENT: chay 2 lan lien tiep phai ra HTML y het nhau.
Vi vay khong duoc nhung bat cu gi phu thuoc THOI DIEM build (vd "5 phut truoc", badge New)
- nhung `data-updated` roi de JS tinh o client.
"""
import hashlib
import html as htmllib
import json
import re
import shutil
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
TPL = ROOT / "layouts"   # design SONG (sua tay)
STATIC = ROOT / "static"   # file sua TAY: assets/, style/, js/
OUT = ROOT / "html"        # 100% do build sinh ra - gitignore, khong sua tay bao gio

VN = timezone(timedelta(hours=7))

# So truyen tren 1 trang phan loai. Trang the loai co 2.000 truyen thi phai chia, khong the
# do het vao 1 trang.
PER_PAGE = 40
SITEMAP_MAX_URLS = 50000   # gioi han cua chuan sitemap


# ---------------------------------------------------------------- helpers

def esc(s):
    return htmllib.escape("" if s is None else str(s), quote=True)


def load_json(path, default):
    p = Path(path)
    if not p.exists():
        return default
    return json.loads(p.read_text(encoding="utf-8"))


_tpl_cache = {}

def tpl(name):
    if name not in _tpl_cache:
        f = TPL / name
        if not f.exists():
            raise SystemExit(
                "LOI: khong tim thay %s\n"
                "  layouts/ la design SONG cua site - build khong chay duoc neu thieu.\n"
                "  (templates/ chi la ban goc tham khao, khong lien quan build.)" % f)
        _tpl_cache[name] = f.read_text(encoding="utf-8")
    return _tpl_cache[name]


def render(template, mapping):
    out = template
    for k, v in mapping.items():
        out = out.replace("{{%s}}" % k, v if isinstance(v, str) else str(v))
    return out


_asset_v = None

def asset_version():
    """Hash noi dung CSS+JS, gan vao URL (?v=...) de trinh duyet KHONG phuc vu ban cu sau khi
    deploy. Khong co cai nay thi sua main.js xong, khach cu (va chinh minh luc test) van chay
    ban cu - lo la debug mot bug da sua roi. Da gap that ngay trong lan test dau tien.

    Hash theo NOI DUNG chu khong phai thoi diem build: input khong doi -> version khong doi ->
    build van idempotent va khach khong phai tai lai file khong he thay doi.
    """
    global _asset_v
    if _asset_v is None:
        h = hashlib.md5()
        for f in sorted(STATIC.rglob("*")):
            if f.is_file() and f.suffix in (".css", ".js"):
                h.update(f.relative_to(STATIC).as_posix().encode())
                h.update(f.read_bytes())
        _asset_v = h.hexdigest()[:8]
    return _asset_v


def check_no_tokens(name, text):
    """Token con sot lai la loi that: no se hien nguyen chu {{TOKEN}} tren site. Fail som
    ngay luc build, dung de nguoi dung phat hien tren trang that."""
    left = sorted(set(re.findall(r"\{\{[A-Z_]+\}\}", text)))
    if left:
        raise SystemExit("LOI: %s con token chua thay: %s" % (name, ", ".join(left)))


def write(path: Path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def cover_url(story):
    c = story.get("cover") or ""
    if c.startswith("http://") or c.startswith("https://"):
        return c            # anh mau (picsum) cua du lieu seed
    return "/" + c.lstrip("/")


def format_count(n):
    n = int(n or 0)
    if n >= 1_000_000:
        return ("%.1f" % (n / 1_000_000)).replace(".0", "").replace(".", ",") + "M"
    if n >= 1000:
        return ("%.1f" % (n / 1000)).replace(".0", "").replace(".", ",") + "K"
    return str(n)


def stars(rating):
    """Giu dung cach render cua ban tinh cu: nua sao dung bang CSS (ky tu nua sao unicode
    khong hien dung tren nhieu font)."""
    r = float(rating or 0)
    full = int(r)
    half = (r - full) >= 0.5
    out = "★" * full
    if half:
        out += ('<span class="star-half"><span class="star-half-bg">☆</span>'
                '<span class="star-half-fg">★</span></span>')
    out += "☆" * (5 - full - (1 if half else 0))
    return out


def status_label(s):
    return "Full" if s == "full" else "Đang ra"


# ---------------------------------------------------------------- khoi lap

def genre_map(config):
    return {g["slug"]: g["name"] for g in config.get("genres", [])}


def card_novel(s):
    badges = ('<span class="badge-ribbon badge-ribbon-full">FULL</span>'
              if s.get("status") == "full" else "")
    return render(tpl("_card-novel.html"), {
        "SLUG": esc(s["slug"]), "TITLE": esc(s["title"]), "COVER": esc(cover_url(s)),
        "BADGES": badges, "UPDATED_AT": esc(s.get("updated_at", "")),
    })


def card_completed(s):
    return render(tpl("_card-completed.html"), {
        "SLUG": esc(s["slug"]), "TITLE": esc(s["title"]), "COVER": esc(cover_url(s)),
        "CHAPTER_COUNT": s.get("chapter_count", 0),
    })


def row_category(s):
    badge = ('<span class="row-badge row-badge-hot">Hot</span>' if s.get("hot") else "")
    return render(tpl("_row-category.html"), {
        "SLUG": esc(s["slug"]), "TITLE": esc(s["title"]), "AUTHOR": esc(s.get("author", "")),
        "COVER": esc(cover_url(s)), "BADGE": badge,
        "CHAPTER_COUNT": s.get("chapter_count", 0),
        "UPDATED_AT": esc(s.get("updated_at", "")),
    })


def row_top_week(s, gmap):
    labels = [gmap.get(g, g) for g in s.get("genres", [])] + list(s.get("tags", []))
    return render(tpl("_row-top-week.html"), {
        "SLUG": esc(s["slug"]), "TITLE": esc(s["title"]),
        "GENRES": esc(", ".join(labels)),
    })


def row_hot_rank(s, rank):
    return render(tpl("_row-hot-rank.html"), {
        "SLUG": esc(s["slug"]), "TITLE": esc(s["title"]), "RANK": rank,
        "RANK_CLASS": str(rank) if rank <= 3 else "other",
    })


def nav_genres(config):
    return "\n".join(
        '                <a href="/phan-loai/%s/">%s</a>' % (esc(g["slug"]), esc(g["name"]))
        for g in config.get("genres", []))


def filter_genres(config):
    out = ['              <a href="/phan-loai/?sort=hot">Tất cả</a>']
    out += ['              <a href="/phan-loai/%s/?sort=hot">%s</a>' % (esc(g["slug"]), esc(g["name"]))
            for g in config.get("genres", [])]
    return "\n".join(out)


_details = {}

def detail_of(slug, fallback=None):
    """story.json cua 1 truyen, cache lai - build_story va genre_tags deu can, doc 2 lan la
    doc 2.000 file x 2 o quy mo that."""
    if slug not in _details:
        _details[slug] = load_json(DATA / "truyen" / slug / "story.json", fallback or {})
    return _details[slug]


def genre_tags(config, stories):
    """Khoi "The Loai Truyen" (o trang chu va sidebar trang phan loai).

    Hien THE LOAI, dang LINK click duoc sang /phan-loai/<slug>/.

    Truoc day khoi nay hien TAG tu do dang <span> - lam theo ban goc. Hai loi:
      1. <span> khong click duoc, nhung nhin y het chip bam duoc -> nguoi dung bam mai
         khong ra gi (bug that, nguoi dung bao).
      2. Noi dung la tag ("tong tai") trong khi tieu de la "The Loai Truyen" - lech han.
    Tag van duoc dung o bang "Top tuan" (ghep cung the loai), khong mat di dau.
    """
    return "".join(
        '<a href="/phan-loai/%s/">%s</a>' % (esc(g["slug"]), esc(g["name"]))
        for g in config.get("genres", []))


# ---------------------------------------------------------------- shell

def shell(config, page_tpl, mapping, title, description, canonical, og_type="website",
          og_image=None):
    domain = (config.get("domain") or "https://trangsaotruyen.com/").rstrip("/")
    site_name = config.get("site_name") or "Trăng Sao Truyện"
    head = render(tpl("_head.html"), {
        "TITLE": esc(title), "DESCRIPTION": esc(description),
        "CANONICAL": esc(domain + canonical), "OG_TYPE": esc(og_type),
        "OG_IMAGE": esc(og_image or (domain + "/assets/image.png")),
        "GA": config.get("ga") or "",
        "ASSET_V": asset_version(),
    })
    header = render(tpl("_header.html"), {"NAV_GENRES": nav_genres(config)})
    footer = render(tpl("_footer.html"), {
        "CONTACT_EMAIL": esc((config.get("contact") or {}).get("email", "")),
        "SITE_NAME": esc(site_name),
        "SITE_ABOUT": esc(config.get("site_about", "")),
        "YEAR": str(datetime.now(VN).year),
    })
    full = dict(mapping)
    full.update(HEAD=head, HEADER=header, FOOTER=footer, ASSET_V=asset_version())
    return render(page_tpl, full)


# ---------------------------------------------------------------- trang

def build_home(config, stories, gmap):
    hot = sorted([s for s in stories if s.get("hot")],
                 key=lambda s: -int(s.get("week_views") or 0))[:12]
    latest = sorted(stories, key=lambda s: s.get("updated_at", ""), reverse=True)[:12]
    completed = sorted([s for s in stories if s.get("status") == "full"],
                       key=lambda s: -int(s.get("views") or 0))[:12]
    top_week = sorted(stories, key=lambda s: -int(s.get("week_views") or 0))[:10]

    sections = []
    for g in config.get("genres", []):
        in_genre = [s for s in stories if g["slug"] in s.get("genres", [])]
        if not in_genre:
            continue
        in_genre.sort(key=lambda s: s.get("updated_at", ""), reverse=True)
        sections.append(render(tpl("_home-genre-section.html"), {
            "GENRE_NAME": esc(g["name"]), "GENRE_SLUG": esc(g["slug"]),
            "CARDS": "".join(card_novel(s) for s in in_genre[:12]),
        }))

    # Site moi (chua co truyen nao) thi 3 khoi nay rong tron - de trong khong loi nao se
    # trong nhu trang bi loi. Day dung la man hinh dau tien nhin thay sau khi deploy.
    def grid(items, fn):
        return ("".join(fn(x) for x in items) if items else
                '<p class="grid-empty">Chưa có truyện nào ở đây. '
                'Thêm truyện đầu tiên trong trang quản trị.</p>')

    page = shell(config, tpl("home.html"), {
        "GRID_HOT": grid(hot, card_novel),
        "GRID_LATEST": grid(latest, card_novel),
        "GRID_COMPLETED": grid(completed, card_completed),
        "GENRE_SECTIONS": "\n".join(sections),
        "TOP_WEEK_ROWS": "".join(row_top_week(s, gmap) for s in top_week),
        "GENRE_TAGS": genre_tags(config, stories),
        "FILTER_GENRES": filter_genres(config),
    },
        title="%s - Đọc Truyện Online Miễn Phí" % (config.get("site_name") or ""),
        description=config.get("site_description", ""), canonical="/")
    check_no_tokens("home", page)
    write(OUT / "index.html", page)
    return 1


def pagination(base, page, pages):
    if pages <= 1:
        return ""
    out = ['<nav class="chapter-pagination" aria-label="Phân trang">']
    if page > 1:
        out.append('<a class="chapter-page-btn" href="%s">‹</a>' % (base if page == 2 else "%s?trang=%d" % (base, page - 1)))
    for p in range(1, pages + 1):
        if p == page:
            out.append('<span class="chapter-page-btn is-active">%d</span>' % p)
        elif p <= 2 or p >= pages - 1 or abs(p - page) <= 2:
            href = base if p == 1 else "%s?trang=%d" % (base, p)
            out.append('<a class="chapter-page-btn" href="%s">%d</a>' % (href, p))
        elif abs(p - page) == 3:
            out.append('<span class="chapter-page-ellipsis">…</span>')
    if page < pages:
        out.append('<a class="chapter-page-btn" href="%s?trang=%d">›</a>' % (base, page + 1))
    out.append("</nav>")
    return "".join(out)


def build_category(config, stories, genre=None):
    """genre=None -> trang /phan-loai/ (tat ca). Nguoc lai -> /phan-loai/<slug>/."""
    if genre:
        subset = [s for s in stories if genre["slug"] in s.get("genres", [])]
        base, title_txt = "/phan-loai/%s/" % genre["slug"], "Truyện %s" % genre["name"]
        desc = "Danh sách truyện %s mới nhất, cập nhật liên tục." % genre["name"]
    else:
        subset = list(stories)
        base, title_txt = "/phan-loai/", "Tất Cả Truyện"
        desc = "Toàn bộ truyện trên %s, sắp xếp theo cập nhật mới nhất." % (config.get("site_name") or "")

    subset.sort(key=lambda s: s.get("updated_at", ""), reverse=True)
    pages = max(1, -(-len(subset) // PER_PAGE))
    count = 0
    for page in range(1, pages + 1):
        chunk = subset[(page - 1) * PER_PAGE: page * PER_PAGE]
        suffix = "" if page == 1 else " - Trang %d" % page
        crumb = esc(title_txt) + (esc(suffix))
        html = shell(config, tpl("category.html"), {
            "CATEGORY_TITLE": esc(title_txt),
            "BREADCRUMB": crumb,
            "ROWS": "".join(row_category(s) for s in chunk) or
                    '<li class="category-row"><em>Chưa có truyện nào trong mục này.</em></li>',
            "GENRE_TAGS": genre_tags(config, stories),
        },
            title="%s%s | %s" % (title_txt, suffix, config.get("site_name") or ""),
            description=desc,
            canonical=base if page == 1 else "%s?trang=%d" % (base, page))
        # Phan trang chen vao sau danh sach (template khong co san cho - de o day cho gon,
        # neu muon doi vi tri thi them token {{PAGINATION}} vao category.html).
        html = html.replace("</ul>\n", "</ul>\n      %s\n" % pagination(base, page, pages), 1)
        check_no_tokens("category %s p%d" % (base, page), html)
        out = OUT / base.strip("/") / ("index.html" if page == 1 else "trang-%d/index.html" % page)
        write(out, html)
        count += 1
    return count


def build_story(config, stories, story, gmap):
    slug = story["slug"]
    # Ghep INDEX truoc roi story.json de len tren:
    #   - views/day/week/month_views/rating/nominations CHI nam trong stories.json (do
    #     syncStatsFromWorker() ghi tu D1) - story.json khong bao gio co cac field nay
    #   - moi field bien tap (description, tags...) lay tu story.json
    # Chi doc story.json se ra views=0 va "Chua co danh gia" tren MOI trang chi tiet du du
    # lieu co that - bug that da gap.
    detail = dict(story)
    detail.update(detail_of(slug, {}))
    chapters = load_json(DATA / "truyen" / slug / "chapters.json", [])
    chapters.sort(key=lambda c: c["n"])

    # TOAN BO link chuong nam trong HTML (khong phan trang phia server): day la bo xuong link
    # noi bo de Google tim ra cac trang chuong. JS chi AN/HIEN theo trang, khong tao link.
    bullets = "".join(
        '<li data-chapter="%d"><a href="/truyen/%s/chuong-%d/">%s</a></li>'
        % (c["n"], esc(slug), c["n"], esc(c["title"])) for c in chapters)

    same_author = [s for s in stories
                   if s.get("author") == detail.get("author") and s["slug"] != slug]
    others = [s for s in stories if s["slug"] != slug and s.get("author") != detail.get("author")]
    side = (same_author + sorted(others, key=lambda s: -int(s.get("views") or 0)))[:8]

    def top_by(field):
        return sorted(stories, key=lambda s: -int(s.get(field) or 0))[:8]
    hot_lists = {"DAY": top_by("day_views"), "MONTH": top_by("month_views"),
                 "ALLTIME": top_by("views")}

    rating = detail.get("rating") or 0
    noms = int(detail.get("nominations") or 0)
    rating_text = ("Đánh giá: %s/5 từ %s lượt" % (("%.1f" % float(rating)).replace(".", ","),
                                                  format_count(noms))
                   if rating else "Chưa có đánh giá")

    genres_html = ", ".join(
        '<a href="/phan-loai/%s/">%s</a>' % (esc(g), esc(gmap.get(g, g)))
        for g in detail.get("genres", []))
    desc_txt = detail.get("description", "") or ""

    page = shell(config, tpl("story.html"), {
        "TITLE": esc(detail["title"]),
        "AUTHOR": esc(detail.get("author", "")),
        "GENRES": genres_html,
        "STATUS": esc(status_label(detail.get("status"))),
        "COVER": esc(cover_url(detail)),
        "RATING_STARS": stars(rating),
        "RATING_TEXT": esc(rating_text),
        "VIEWS": esc(format_count(detail.get("views"))),
        "DESCRIPTION_HTML": esc(desc_txt),
        "BREADCRUMB": esc(detail["title"]),
        "SAME_AUTHOR": "".join(
            '<li><a href="/truyen/%s/">%s</a></li>' % (esc(s["slug"]), esc(s["title"]))
            for s in side),
        "CHAPTER_LIST": bullets or "<li><em>Truyện chưa có chương nào.</em></li>",
        "CHAPTER_PAGINATION": "",
        "HOT_RANK_DAY": "".join(row_hot_rank(x, i + 1) for i, x in enumerate(hot_lists["DAY"])),
        "HOT_RANK_MONTH": "".join(row_hot_rank(x, i + 1) for i, x in enumerate(hot_lists["MONTH"])),
        "HOT_RANK_ALLTIME": "".join(row_hot_rank(x, i + 1) for i, x in enumerate(hot_lists["ALLTIME"])),
        "COMMENT_SUMMARY": esc("%s bình luận" % format_count(noms) if noms else "Chưa có bình luận"),
    },
        title="%s - %s | %s" % (detail["title"], detail.get("author", ""),
                                config.get("site_name") or ""),
        description=(desc_txt[:157] + "...") if len(desc_txt) > 160 else desc_txt,
        canonical="/truyen/%s/" % slug, og_type="book",
        og_image=cover_url(detail) if cover_url(detail).startswith("http")
                 else (config.get("domain", "").rstrip("/") + cover_url(detail)))
    check_no_tokens("story %s" % slug, page)
    write(OUT / "truyen" / slug / "index.html", page)

    # Index chuong dang JSON cho dropdown cua trang doc: nhung 620 link vao MOI trang chuong
    # la 37KB x 620 trang giong het nhau. Trang chi tiet o tren da co du link cho SEO.
    # Mang theo ca TEN TRUYEN: Worker can no cho <title>/<h1> cua trang chuong. Suy ra tu
    # slug se mat dau ("tieng-noi..." -> "Tieng Noi...") - sai chinh ta ngay tren the title.
    write(OUT / "truyen" / slug / "chapters.json",
          json.dumps({"title": detail["title"], "slug": slug,
                      "chapters": [{"n": c["n"], "title": c["title"]} for c in chapters]},
                     ensure_ascii=False, separators=(",", ":")))
    return len(chapters)


def build_static_pages(config):
    n = 0
    for tpl_name, out_dir, title, desc in (
        # Da bo tinh nang tai khoan khoi giao dien (xem docs/CMS.md). KHONG sinh trang
        # login/signup nua - de lai la trang mo coi, Google van index, nguoi dung bam vao
        # mot form khong lam gi ca. Layout goc con o templates/_ref-login.html neu can lam lai.
        ("page-legal.html", "phap-ly", "Pháp lý", "Điều khoản sử dụng và chính sách của %s."),
    ):
        site = config.get("site_name") or ""
        page = shell(config, tpl(tpl_name), {},
                     title="%s | %s" % (title, site),
                     description=desc % site, canonical="/%s/" % out_dir)
        check_no_tokens(out_dir, page)
        write(OUT / out_dir / "index.html", page)
        n += 1
    return n


def build_404(config, stories):
    latest = sorted(stories, key=lambda s: s.get("updated_at", ""), reverse=True)[:6]
    page = shell(config, tpl("404.html"),
                 {"GRID_LATEST": "".join(card_novel(s) for s in latest)},
                 title="Không tìm thấy trang | %s" % (config.get("site_name") or ""),
                 description="Trang bạn tìm không tồn tại.", canonical="/404.html")
    check_no_tokens("404", page)
    write(OUT / "404.html", page)
    return 1


def build_chapter_template(config):
    """Template trang chuong cho WORKER. Resolve san header/footer/menu the loai (thu Worker
    khong doc duoc vi partial nam trong layouts/, khong nam trong html/), giu lai cac token
    rieng cua tung chuong de Worker dien luc co request."""
    domain = (config.get("domain") or "").rstrip("/")
    head = render(tpl("_head.html"), {
        "TITLE": "{{TITLE}}", "DESCRIPTION": "{{DESCRIPTION}}",
        "CANONICAL": "{{CANONICAL}}", "OG_TYPE": "article",
        "OG_IMAGE": esc(domain + "/assets/image.png"), "GA": config.get("ga") or "",
        "ASSET_V": asset_version(),
    })
    header = render(tpl("_header.html"), {"NAV_GENRES": nav_genres(config)})
    footer = render(tpl("_footer.html"), {
        "CONTACT_EMAIL": esc((config.get("contact") or {}).get("email", "")),
        "SITE_NAME": esc(config.get("site_name") or ""),
        "SITE_ABOUT": esc(config.get("site_about", "")),
        "YEAR": str(datetime.now(VN).year),
    })
    out = render(tpl("chapter.html"),
                 {"HEAD": head, "HEADER": header, "FOOTER": footer, "ASSET_V": asset_version()})
    left = sorted(set(re.findall(r"\{\{[A-Z_]+\}\}", out)))
    expect = ["{{BREADCRUMB}}", "{{CANONICAL}}", "{{CHAPTER_N}}", "{{CHAPTER_TITLE}}",
              "{{CONTENT}}", "{{DESCRIPTION}}", "{{NEXT_DISABLED}}", "{{NEXT_HREF}}",
              "{{NOVEL_TITLE}}", "{{PREV_DISABLED}}", "{{PREV_HREF}}", "{{SLUG}}", "{{TITLE}}"]
    if left != expect:
        raise SystemExit("LOI: token cua _tpl/chapter.html khong dung nhu Worker mong doi.\n"
                         "  co   : %s\n  can  : %s" % (left, expect))
    write(OUT / "_tpl" / "chapter.html", out)
    return 1


def build_search_index(stories):
    """Index tim kiem cho o search o header. Chi 3 field -> 35 truyen ~4KB, 2.000 truyen ~250KB
    (JS fetch 1 lan roi cache). Khong nhung vao HTML: khong phai noi dung can Google doc."""
    idx = [{"s": s["slug"], "t": s["title"], "a": s.get("author", ""),
            "c": s.get("chapter_count", 0)}
           for s in sorted(stories, key=lambda x: x["title"])]
    write(OUT / "data" / "search-index.json",
          json.dumps(idx, ensure_ascii=False, separators=(",", ":")))
    return len(idx)


def build_sitemaps(config, stories):
    domain = (config.get("domain") or "https://trangsaotruyen.com/").rstrip("/")
    urls = [("/", None)]
    urls.append(("/phan-loai/", None))
    for g in config.get("genres", []):
        urls.append(("/phan-loai/%s/" % g["slug"], None))
    for s in stories:
        urls.append(("/truyen/%s/" % s["slug"], s.get("updated_at")))
        chapters = load_json(DATA / "truyen" / s["slug"] / "chapters.json", [])
        for c in chapters:
            urls.append(("/truyen/%s/chuong-%d/" % (s["slug"], c["n"]), c.get("updated_at")))
    for p in ("phap-ly",):
        urls.append(("/%s/" % p, None))

    # Gioi han chuan sitemap la 50.000 URL/file. O quy mo 600.000 chuong se can 12+ file,
    # nen chia ngay tu dau thay vi cho den luc vuot moi va.
    chunks = [urls[i:i + SITEMAP_MAX_URLS] for i in range(0, len(urls), SITEMAP_MAX_URLS)]
    files = []
    for i, chunk in enumerate(chunks, 1):
        body = []
        for loc, lastmod in chunk:
            body.append("  <url><loc>%s%s</loc>%s</url>" % (
                domain, loc, "<lastmod>%s</lastmod>" % esc(lastmod[:10]) if lastmod else ""))
        name = "sitemap.xml" if len(chunks) == 1 else "sitemap-%d.xml" % i
        write(OUT / name, '<?xml version="1.0" encoding="UTF-8"?>\n'
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
              + "\n".join(body) + "\n</urlset>\n")
        files.append(name)
    if len(files) > 1:
        write(OUT / "sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n'
              '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
              + "\n".join("  <sitemap><loc>%s/%s</loc></sitemap>" % (domain, f) for f in files)
              + "\n</sitemapindex>\n")
    # Disallow /admin/: trang chuyen huong sang CMS, khong co gi cho Google. Trang do cung
    # co the noindex - dung ca hai cho chac.
    write(OUT / "robots.txt",
          "User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: %s/sitemap.xml\n" % domain)
    return len(urls), len(files)


def clean_generated():
    """Xoa SACH html/ roi sinh lai tu dau.

    Vi sao xoa sach chu khong ghi de: neu chi ghi de, truyen da xoa qua CMS se van truy cap
    duoc vo thoi han tren site va Google tiep tuc index noi dung da xoa. Xoa sach la cach
    duy nhat dam bao khong con file mo coi - va lam duoc vi html/ KHONG chua gi sua tay
    (moi thu sua tay nam trong static/ va layouts/).
    """
    shutil.rmtree(OUT, ignore_errors=True)


def copy_static():
    """static/ -> html/. Day la file nguoi sua tay (CSS, JS, anh, icon) - build chi copy,
    khong bien doi gi."""
    n = 0
    if not STATIC.exists():
        raise SystemExit("LOI: khong tim thay %s (chua co CSS/JS/anh de copy)" % STATIC)
    for src in STATIC.rglob("*"):
        if src.is_dir():
            continue
        dst = OUT / src.relative_to(STATIC)
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        n += 1
    return n


def main():
    config = load_json(DATA / "site-config.json", {})
    stories = load_json(DATA / "stories.json", [])
    gmap = genre_map(config)
    clean_generated()
    n_static_files = copy_static()

    n_home = build_home(config, stories, gmap)
    n_cat = build_category(config, stories, None)
    for g in config.get("genres", []):
        n_cat += build_category(config, stories, g)
    n_story = 0
    n_chap = 0
    for s in stories:
        n_chap += build_story(config, stories, s, gmap)
        n_story += 1
    n_static = build_static_pages(config)
    n_404 = build_404(config, stories)
    build_chapter_template(config)
    n_search = build_search_index(stories)
    n_urls, n_sitemaps = build_sitemaps(config, stories)

    total_files = n_home + n_cat + n_story + n_static + n_404
    print("Da build:")
    print("  trang chu            %4d" % n_home)
    print("  trang phan loai      %4d" % n_cat)
    print("  trang chi tiet truyen%4d  (%d chuong trong index)" % (n_story, n_chap))
    print("  trang tinh           %4d" % n_static)
    print("  404                  %4d" % n_404)
    print("  ------------------------")
    print("  TONG FILE HTML       %4d   (gioi han Cloudflare free: 20.000)" % total_files)
    print("  _tpl/chapter.html       1   (Worker render trang chuong tu day)")
    print("  search-index.json  %6d truyen" % n_search)
    print("  sitemap            %6d URL / %d file" % (n_urls, n_sitemaps))
    print("  copy tu static/    %6d file (CSS/JS/anh - sua tay o static/, khong sua trong html/)"
          % n_static_files)


if __name__ == "__main__":
    main()
