#!/usr/bin/env python3
"""
Nap du lieu mau tu scripts/mock-data.json (mock 35 truyen) vao data/ de co dau vao cho
build.py.

Snapshot nay duoc trich tu ban main.js GOC (client-render tu mock) truoc khi main.js duoc
viet lai. Dat trong scripts/ chu khong phai templates/: day la DAU VAO cua script nay, khong
phai ban thiet ke tham khao - templates/ co the bi xoa bat cu luc nao.

CHAY MOT LAN, luc khoi tao du an. Sau khi CMS da co du lieu that thi KHONG chay lai - script
nay ghi de data/stories.json va data/truyen/**, se xoa sach cong sua cua CMS.

NOI DUNG chuong KHONG nap o day: noi dung nam trong D1 cua Worker, khong nam trong git. Script
chi sinh INDEX chuong (so + tieu de) de trang chi tiet truyen co danh sach chuong ma render.
Muon co noi dung that thi nhap qua CMS (tab Nhap hang loat).
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NOW = "2026-08-23T10:00:00+07:00"

def load_mock():
    p = ROOT / "scripts" / "mock-data.json"
    if not p.exists():
        sys.exit("Khong tim thay %s - khong seed duoc nua." % p)
    return json.loads(p.read_text(encoding="utf-8"))


def write(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def main():
    mock = load_mock()
    novels, labels, pool = mock["NOVELS"], mock["GENRE_LABELS"], mock["POOL"]

    # ---- site-config.json ----
    write(ROOT / "data" / "site-config.json", {
        "site_name": "Trăng Sao Truyện",
        "site_description": "Kho truyện ngôn tình, tiên hiệp, huyền huyễn, trinh thám, kinh dị cập nhật mỗi ngày.",
        "site_about": "Trăng Sao Truyện là trang đọc truyện online miễn phí, giao diện thân thiện, cập nhật nhanh chóng.",
        "domain": "https://trangsaotruyen.com/",
        "genres": [{"slug": s, "name": n} for s, n in labels.items()],
        "contact": {"email": "bientruyen7@gmail.com", "phone": ""},
        "ga": "",
    })

    index = []
    for nv in novels:
        slug = nv["slug"]
        # Anh bia: mock chi co 1 anh that, con lai roi ve picsum. Sau nay CMS bat buoc anh bia
        # that nen truong hop picsum se tu mat dan.
        cover = nv.get("coverImage") or "https://picsum.photos/seed/%s/500/750" % slug

        # Index chuong: tieu de sinh theo dung cong thuc cua mock (getChapters trong main.js)
        # de ban doi chieu duoc voi ban tinh cu.
        titles = pool.get(nv["genres"][0]) or pool["hien-dai"]
        chapters = [{"n": i,
                     "title": "Chương %d: %s" % (i, titles[(i - 1) % len(titles)]),
                     "updated_at": NOW}
                    for i in range(1, nv["chapterCount"] + 1)]
        write(ROOT / "data" / "truyen" / slug / "chapters.json", chapters)

        detail = {
            "id": nv["id"], "slug": slug, "title": nv["title"], "author": nv["author"],
            "genres": nv["genres"], "tags": nv["tags"], "status": nv["status"],
            "description": nv["description"], "cover": cover, "hot": nv["hot"],
            "chapter_count": len(chapters), "created_at": NOW, "updated_at": NOW,
        }
        write(ROOT / "data" / "truyen" / slug / "story.json", detail)

        meta = {k: detail[k] for k in ("id", "slug", "title", "author", "genres", "status",
                                      "chapter_count", "cover", "hot", "created_at", "updated_at")}
        # So dan xuat: binh thuong do syncStatsFromWorker() ghi tu D1. O day lay tu mock de
        # bang xep hang co so ma sap - se bi ghi de bang so THAT ngay khi Worker chay.
        meta.update(views=nv["views"], day_views=nv["dayViews"], week_views=nv["weekViews"],
                    month_views=nv["monthViews"], rating=nv["rating"], nominations=nv["nominations"])
        index.append(meta)

    write(ROOT / "data" / "stories.json", index)
    total = sum(s["chapter_count"] for s in index)
    print("Da seed %d truyen, %d chuong (chi index, khong co noi dung)" % (len(index), total))
    print("  data/site-config.json, data/stories.json, data/truyen/<slug>/{story,chapters}.json")

if __name__ == "__main__":
    main()
