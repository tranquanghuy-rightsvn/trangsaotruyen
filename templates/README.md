# templates/ — CHỈ ĐỂ THAM KHẢO, không tham gia build

Đây là **bản gốc 7 trang HTML tĩnh** của website trước khi chuyển sang build từ dữ liệu, giữ lại
nguyên văn để đối chiếu design bằng mắt.

**Thư mục này KHÔNG nằm trong luồng build.** `scripts/build.py` không đọc gì ở đây. Xoá cả thư
mục thì `npm run build` vẫn chạy bình thường (đã kiểm bằng cách xoá thật rồi build lại).

## Đừng nhầm với `layouts/`

| Thư mục | Vai trò | Xoá được? |
|---|---|---|
| `layouts/` | **Design SỐNG** — `build.py` đọc để sinh site. Sửa design là sửa ở đây | ❌ build vỡ ngay |
| `templates/` | Bản gốc để tham khảo | ✅ xoá lúc nào cũng được |

## Nội dung

| File | Là gì |
|---|---|
| `_ref-home.html` | Trang chủ gốc |
| `_ref-story.html` | Trang chi tiết truyện gốc (`truyen-chi-tiet/index.html`) |
| `_ref-chapter.html` | Trang đọc chương gốc (`doc-truyen/index.html`) |
| `_ref-category.html` | Trang phân loại gốc |
| `_ref-login.html`, `_ref-signup.html`, `_ref-legal.html` | 3 trang tĩnh gốc |
| `_ref-main.js` | Bản `main.js` cũ (1.197 dòng) — client-render toàn bộ từ dữ liệu mock |

Bản gốc dùng URL kiểu `?slug=x&chuong=42` và render mọi danh sách bằng JS từ mảng `NOVELS`.
Bản hiện tại render sẵn thành HTML thật (`/truyen/<slug>/`) — xem `docs/CMS.md` mục 1 và 4.

Dữ liệu mock 35 truyện đã được tách sang `scripts/mock-data.json` (là **đầu vào** của
`scripts/seed_from_mock.py`, không phải tài liệu tham khảo) nên seed vẫn chạy được sau khi bạn
xoá thư mục này.
