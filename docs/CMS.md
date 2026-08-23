# CMS Trăng Sao Truyện — GAS + Cloudflare Worker

Tài liệu quyết định riêng của dự án này. Kiến thức chung (pattern, gotcha lặp lại được cho mọi
dự án theo mô hình này) nằm trong skill `free-cms-static-site-pipeline`, không nhân bản vào đây.

## 1. Kiến trúc

Quy mô mục tiêu: **~2.000 truyện × ~300 chương ≈ 600.000 chương (~13,2 GB)**. Con số này loại
bỏ mọi phương án 1 tầng:

| Nếu để nội dung chương ở… | Con số thật | Giới hạn | Kết quả |
|---|---|---|---|
| File tĩnh trong deployment | 600.000 file | 20.000 (CF free) / 100.000 (paid) | ✗ vượt 30× / **vượt 6× kể cả trả tiền** |
| Git (client fetch) | 13,2 GB + 600.000 file | GitHub nên <1GB, mạnh <5GB | ✗ vượt 2,6× ceiling, git bò |
| Google Sheets | 600.000 dòng | đủ ô, nhưng GAS 6 phút không đọc nổi | ✗ |
| Cloudflare R2 | 600.000 object | không giới hạn số object | ⚠️ **đòi phương thức thanh toán** |
| **Cloudflare D1** | ~238.000 chương | 5 GB (free) | ✓ **không cần thẻ** |

### Vì sao D1 chứ không R2 — ràng buộc "miễn phí hoàn toàn, không cần thẻ"

Rà cả stack, **R2 là thứ duy nhất đòi phương thức thanh toán**, kể cả khi chỉ dùng trong hạn mức
free 10 GB:

| Mảnh | Cần thẻ? |
|---|---|
| GitHub (repo + Actions) | ❌ |
| Google (GAS + Sheets + Gmail) | ❌ |
| Cloudflare Workers + Static Assets | ❌ |
| Cloudflare D1 | ❌ |
| Cloudflare R2 | ✅ ← bỏ |

Nên nội dung chương nằm trong **D1**. Đánh đổi duy nhất là **trần thấp hơn: 5 GB thay vì 10 GB**
→ khoảng **238.000 chương (~790 truyện × 300)**. Với dự án bắt đầu từ 0 truyện, đó là runway rất
dài; 600.000 chương là trần cuối cùng của mô hình, không phải yêu cầu ngày đầu.

**Đường di cư khi thật sự chạm 5 GB** — chỉ sửa `worker/src/index.js`, **`gas/Code.js` không đổi
một dòng**: GAS nói chuyện với Worker qua HTTP, chưa bao giờ nói chuyện trực tiếp với tầng lưu
trữ. Đúng lý do đã đặt Worker vào giữa. Hai lựa chọn lúc đó: chuyển sang R2 (10 GB free, cần
thẻ), hoặc Workers Paid ($5/tháng, hạn mức D1 tăng mạnh).

**Không được để chạm trần trong im lặng** — chạm là lưu chương mới thất bại. Hai lớp báo:
`syncStatsFromWorker()` gửi mail cho chủ script ở mốc 80/90/95% (tối đa 1 mail/tuần mỗi mốc, nếu
không sẽ thành spam 1 mail/ngày và bị bỏ qua), và tab Cài đặt có nút xem dung lượng + số chương
còn chứa được.

```
   ┌──────────────── GAS (CMS + auth OTP) ────────────────┐
   │  Sheet "Users" ── CHỈ auth. Không chứa nội dung.     │
   └──┬────────────────────────────────────┬──────────────┘
      │ GitHub Contents API                 │ HTTPS + X-Admin-Token
      ▼                                     ▼
 repo git (metadata + ảnh bìa)      ┌─ Cloudflare Worker ─────────────┐
  data/site-config.json            │  D1 chapters ← nội dung chương  │
  data/stories.json  ◄─ commit CHỐT │  D1 views_*  ← lượt xem         │
                                    │  D1 comments ← bình luận        │
  data/truyen/<slug>/story.json    └────┬────────────────────────────┘
  data/truyen/<slug>/chapters.json      │ GAS trigger 02:00 mỗi ngày
  html/assets/truyen/<slug>-500x750.webp│ GET /_api/stats → ghi stories.json
      │                                 │
      ▼ GitHub Actions: scripts/build.py ◄┘
  html/ (~2.030 file) ──► Cloudflare Workers Static Assets
```

**Tầng 1 — tĩnh, trong git (~2.030 file):** trang chủ (1) + trang thể loại (~25) + trang chi
tiết truyện (2.000) + trang tĩnh (~5). Đúng 10% của giới hạn 20.000 file → full rebuild mỗi
lần, không cần build tăng dần.

**Tầng 2 — Worker:** một route `/truyen/:slug/chuong-:n` phục vụ mọi URL chương — đọc D1 bằng
đúng khoá chính `(slug, n)` (**1 row read**, không quét bảng — đã kiểm bằng `EXPLAIN QUERY PLAN`),
ghép template, trả **HTML thật** status 200. Google không phân biệt được với trang tĩnh.

### Vì sao index chương (`chapters.json`) vẫn nằm trong git
Trang chi tiết truyện chứa danh sách 300 link chương — **bộ xương link nội bộ** để Google tìm
ra 600.000 URL chương. Không thể để JS render runtime. File nhẹ (~18KB/truyện). Chỉ **nội
dung** chương ở D1.

### Hệ quả: thêm chương vẫn kéo theo 1 lần build
| | Có ngay | Chờ CI (~2 phút) |
|---|---|---|
| Trang chương `/truyen/x/chuong-42` | ✓ ghi D1 là sống | |
| Danh sách chương trên `/truyen/x/` | | ✓ HTML tĩnh, phải build lại |

CMS nói đúng điều này (`showChapterSyncAlert`), không hứa "xong ngay" chung chung. Muốn bỏ độ
trễ: cho Worker inject danh sách chương bằng `HTMLRewriter` — quyết định ở bước dựng template.

## 2. Lượt xem và đánh giá — đếm thật, không gõ tay

Site có bảng xếp hạng theo ngày/tuần/tháng và dòng "Đánh giá 4.8/5 từ 3.3K lượt". Nếu để admin
gõ tay thì thực tế không ai cập nhật 2.000 truyện → bảng xếp hạng đóng băng ở số gõ lần đầu.
Nên cả hai đều là **số dẫn xuất**, không có ô nhập trong CMS:

```
mỗi pageview  ──► Worker POST /_api/view  ──► D1 views_daily   (ĐÚNG 1 write)
mỗi comment   ──► Worker POST /_api/comment ─► D1 comments      (rating + nominations)
                                                    │
     GAS trigger 02:00 ── GET /_api/stats ──────────┘
              └──► ghi data/stories.json (1 commit) ──► 1 lần build/ngày
```

**1 write/pageview là ràng buộc thiết kế, không phải tình cờ.** D1 free cho 100k write/ngày;
ghi thêm một bảng tổng ở mỗi request là tự chia đôi ngân sách đó. Nên bảng tổng
(`views_archive`) **chỉ cron ghi**. Mốc 100k write/ngày cũng trùng mốc 100k request/ngày của
Workers free — lên Workers Paid ($5/tháng) kéo cả hai lên cùng lúc, không sinh trần mới.

**Vì sao ghi vào `stories.json` chứ không từng `story.json`:** cập nhật 2.000 file mỗi ngày =
2.000 commit/ngày. Ghi 1 file index = 1 commit = 1 build/ngày. `build.py` đọc lượt xem/đánh giá
từ index này cho **cả** trang chủ, trang phân loại **lẫn** trang chi tiết; `story.json` chỉ giữ
field biên tập (giới thiệu, tag).

**Vì sao GAS chạy trigger chứ không phải cron của Worker:** GAS đã giữ `GITHUB_TOKEN` và đã có
`ghPutFile_`. Cho Worker tự ghi GitHub là nhân bản quyền ghi repo sang hệ thống thứ hai — thêm
một nơi để lộ token, thêm một bản logic phải đồng bộ.

`syncStatsFromWorker()` **không ghi file khi không có gì đổi** — ghi đè nội dung y nguyên vẫn
tạo commit mới và trigger 1 lần build vô nghĩa (2.030 trang) mỗi ngày.

### Bẫy đã vá: `saveStory` từng xoá sạch lượt xem
`indexMetaOf_()` dựng lại meta từ đầu → mọi field dẫn xuất về 0. Sửa một chữ trong phần giới
thiệu là mất 2 triệu lượt xem. Giờ nó nhận tham số `previous` và **giữ lại**
`views/day_views/week_views/month_views/rating/nominations`. Thêm field dẫn xuất mới về sau phải
thêm vào đúng chỗ đó.

### Comment hiện ngay, không qua hàng chờ
Site truyện không ai ngồi duyệt tay cả ngày — để hàng chờ nghĩa là comment không bao giờ xuất
hiện. Chặn spam ở Worker: **honeypot** (field ẩn `website`, bot điền là bị loại âm thầm — trả
200 chứ không báo lỗi, báo lỗi là dạy bot cách vượt) + **rate-limit 1 comment/20 giây theo IP**.
Tab Bình luận trong CMS là nơi dọn hậu kỳ; ưu tiên **Ẩn** (giữ lại đối chiếu) hơn Xóa.

## 3. Ranh giới ghi/đọc — nhầm bảng này là nguồn gốc gần như mọi bug

| Đường dẫn | Ai ghi | Ai đọc | Sửa tay được? |
|---|---|---|---|
| `data/site-config.json` | GAS | `build.py` | **Không** |
| `data/stories.json` | GAS (**commit CHỐT**) | `build.py` | **Không** |
| `data/truyen/<slug>/*.json` | GAS | `build.py` | **Không** |
| `static/assets/truyen/*.webp` | GAS (ảnh bìa) | `build.py` copy | Không cần |
| `static/style/`, `static/js/` | **người, tay** | `build.py` copy | **Có** |
| `layouts/*.html` | **người, tay** | `build.py` | **Có** — đây là chỗ sửa design |
| `templates/` | — | người đọc tham khảo | bản gốc, **không tham gia build, xoá được** |
| **`html/**`** | `build.py` | trình duyệt | **KHÔNG** — gitignore, bị xoá sạch mỗi lần build |
| D1 `chapters` | GAS → Worker | Worker | Không |
| D1 `views_*`, `comments` | Worker | Worker, GAS (`/stats`) | Không |
| `gas/**`, `worker/**` | **người, tay** | runtime | **Có** |

### `html/` là output 100%, không phải nguồn

`build.py` **xoá sạch `html/` rồi sinh lại từ đầu** mỗi lần chạy. Đây không phải sự cẩu thả:
nếu chỉ ghi đè, truyện đã xoá qua CMS sẽ vẫn truy cập được vô thời hạn trên site và Google tiếp
tục index nội dung đã xoá (gotcha #19). Xoá sạch là cách duy nhất chắc chắn không còn file mồ
côi — và làm được vì `html/` không chứa gì sửa tay:

```
layouts/    design (sửa tay)  ─┐
static/     CSS/JS/ảnh (tay)  ─┼─► scripts/build.py ─► html/  (gitignore)
data/       nội dung (CMS)    ─┘

templates/  bản gốc để THAM KHẢO — không nằm trong luồng này, xoá được bất cứ lúc nào
```

**Hệ quả cần nhớ: ảnh bìa CMS ghi vào `static/assets/truyen/`, KHÔNG phải `html/`.** Ghi vào
`html/` thì lần build kế tiếp mất ảnh. URL công khai vẫn là `/assets/truyen/<slug>-500x750.webp`
vì build copy `static/` → `html/`.

`data/stories.json` là **file duy nhất CI theo dõi**, nên GAS luôn ghi nó **sau cùng** trong mọi
thao tác. Trigger theo cả `data/**` sẽ chạy build ở commit dở dang.

## 4. File

### `gas/` — **KHÔNG nằm trong git** (gitignore từ đầu)
Đây là code backend (logic phân quyền, cấu trúc dữ liệu, cách publish). Hệ quả:
`git diff`/`git status` **không cho biết file nào trong `gas/` vừa đổi** — sau mỗi lần sửa phải
tự đối chiếu bảng này rồi `clasp push` + Deploy → New version.

| File | Dòng | Nội dung |
|---|---|---|
| `Code.js` | ~990 | Auth OTP, phân quyền, CRUD truyện/chương, nhập hàng loạt, đồng bộ thống kê, kiểm duyệt comment, GitHub API, Worker API |
| `js.html` | ~1.400 | Boot cache, bảng + phân trang, editor, tách chương, crop bìa, tab bình luận |
| `app.html` | ~290 | Markup CMS — chỉ trả về qua `boot(token)` |
| `index.html` | ~78 | Login + 3 modal (confirm / alert / progress) |
| `css.html` | ~95 | CSS |
| `appsscript.json` | 10 | `executeAs: USER_DEPLOYING` |

### Trong git
| Đường dẫn | Nội dung |
|---|---|
| `layouts/*.html` | **Design SỐNG.** `home/category/story/chapter/page-*/404` + partial `_header`/`_footer`/`_head` + khối lặp `_card-*`/`_row-*`. Sửa design là sửa ở đây |
| `templates/` | **Chỉ để tham khảo, KHÔNG tham gia build** — bản gốc 7 trang HTML tĩnh + `_ref-main.js` (bản client-render cũ). Xoá cả thư mục thì build vẫn chạy (đã kiểm) |
| `scripts/mock-data.json` | 35 truyện mẫu — **đầu vào** của `seed_from_mock.py`, không phải tài liệu tham khảo |
| `static/` | CSS, JS, ảnh, icon — sửa tay |
| `data/` | Nội dung: `site-config.json`, `stories.json`, `truyen/<slug>/{story,chapters}.json` |
| `scripts/build.py` | Sinh site tĩnh. Không dùng thư viện ngoài |
| `scripts/seed_from_mock.py` | Nạp `scripts/mock-data.json` vào `data/`. **Chạy một lần**, chạy lại sẽ ghi đè dữ liệu CMS |
| `worker/src/index.js` | Worker: trang chương + D1 chương/lượt xem/bình luận + cron dọn |
| `worker/schema.sql` | Schema D1 |
| `wrangler.toml`, `package.json` | Cấu hình deploy |
| `.github/workflows/build.yml` | CI: build + deploy, **không** commit `html/` |
| `docs/CMS.md` | File này |

### Ai render cái gì

| Trang | Ai render | Số lượng |
|---|---|---|
| Trang chủ, phân loại, chi tiết truyện, trang tĩnh, 404 | `build.py` → file tĩnh | ~2.030 ở quy mô 2.000 truyện |
| **Trang chương** `/truyen/<slug>/chuong-<n>/` | **Worker**, đọc D1 + ghép `html/_tpl/chapter.html` | 1 route cho mọi URL |

`build.py` sinh sẵn `html/_tpl/chapter.html` (đã resolve header/footer/menu thể loại, chỉ còn
token của từng chương) vì Worker không đọc được `layouts/` — nó chỉ thấy `html/` qua binding
`ASSETS`, không thấy `layouts/`. Worker cache template ở module scope nên hầu hết request không phải fetch lại.

`wrangler.toml` khai `run_worker_first = ["/_api/*", "/truyen/*/chuong-*"]`. **Cố ý không đưa cả
`/truyen/*`**: trang chi tiết truyện là file tĩnh — cho nó đi qua Worker nghĩa là mỗi lượt xem
trang truyện cũng tính 1 request Worker (free tier 100k/ngày).

### Toàn bộ link chương nằm trong HTML thật

Trang chi tiết truyện chứa **tất cả** `<li><a href="/truyen/x/chuong-N/">` — 620 chương thì
trang nặng ~95 KB. JS chỉ **ẩn/hiện** theo trang, không bao giờ tạo hay xoá link. Đây là bộ
xương link nội bộ để Google tìm ra các URL chương; để JS dựng thì tốn crawl budget và mất hẳn
điều hướng khi JS/JSON lỗi.

Ngược lại, dropdown danh sách chương **trong trang đọc** thì fetch
`/truyen/<slug>/chapters.json` khi bấm — nhúng 620 link vào cả 620 trang chương là 37 KB giống
hệt nhau nhân 620 lần, và không cần cho SEO vì trang chi tiết đã có đủ.

### Build phải idempotent

Chạy `build.py` hai lần liên tiếp **phải** ra HTML y hệt nhau (đã kiểm bằng hash). Vì vậy
**không được nhúng bất cứ gì phụ thuộc thời điểm build**: "12 phút trước" và badge *New* chỉ
được ghi ra `data-updated="<iso>"`, JS tính ở client. Nhúng trực tiếp sẽ làm mỗi lần build ra
HTML khác nhau (churn vô nghĩa) và con số hiển thị đứng im tới lần build sau.

## 5. Script Properties (GAS)

| Key | Bắt buộc | Ghi chú |
|---|---|---|
| `GITHUB_TOKEN` | ✅ | PAT, scope `repo` (fine-grained: Contents read/write) |
| `GITHUB_OWNER` | ✅ | `thanhthien0706` |
| `GITHUB_REPO` | ✅ | `trang-sao-truyen` |
| `GITHUB_BRANCH` | ✅ | `master` |
| `WORKER_API_URL` | chương | `https://trangsaotruyen.com/_api` — **không** có `/` ở cuối |
| `WORKER_API_TOKEN` | chương | trùng Worker Secret `ADMIN_TOKEN` |
| `SPREADSHEET_ID` | ❌ | **tự tạo** lần đầu, không điền tay |

Thiếu `GITHUB_*` → lỗi rõ ràng ngay (`requireCfg_`). Thiếu `WORKER_API_*` → **quản lý truyện
vẫn chạy đủ**, chỉ nội dung chương / bình luận báo lỗi rõ ràng và tab liên quan hiện banner.
Đây là chủ ý: dùng được CMS trước khi dựng Worker.

## 6. API của Worker

GAS không nói chuyện với tầng lưu trữ, chỉ nói chuyện với Worker qua HTTP. Nhờ vậy đổi D1 ↔ R2 về
sau không cần sửa GAS. (Và nếu có dùng R2: nó đòi ký AWS SigV4 — ~80 dòng ký tay trong Apps
Script, rất dễ sai và cực khó debug; Worker có binding sẵn nên GAS chỉ cần POST.)

**Admin** (header `X-Admin-Token`, GAS gọi):

| Method | Đường dẫn | Body | Trả về |
|---|---|---|---|
| `GET` | `/_api/chapter/<slug>/<n>` | — | `{n,title,content,updated_at}` \| **404** |
| `PUT` | `/_api/chapter/<slug>/<n>` | `{n,title,content,updated_at}` | `{ok}` |
| `DELETE` | `/_api/chapter/<slug>/<n>` | — | `{ok}` |
| `POST` | `/_api/chapters/<slug>` | `{chapters:[…]}` ≤25 | `{ok,written}` |
| `DELETE` | `/_api/story/<slug>` | — | `{ok,deleted}` — xoá chương **và** views/comments của truyện, trong 1 transaction |
| `GET` | `/_api/usage` | — | `{chapters,bytes,limit_bytes}` |
| `GET` | `/_api/stats` | — | `{as_of, stories:{…}, usage:{chapters,bytes,limit_bytes}}` |
| `GET` | `/_api/moderate?limit=` | — | `{comments:[…]}` |
| `PATCH` | `/_api/comment/<id>` | `{status:"ok"\|"hidden"}` | `{ok,status}` |
| `DELETE` | `/_api/comment/<id>` | — | `{ok}` |

**Công khai** (site tĩnh gọi, có CORS):

| Method | Đường dẫn | Body | Ghi chú |
|---|---|---|---|
| `POST` | `/_api/view` | `{slug}` | 1 write D1 |
| `GET` | `/_api/comments/<slug>` | — | `{comments, rating, nominations}` |
| `POST` | `/_api/comment` | `{slug,name,rating,body,website}` | `website` = honeypot, để trống |

- `content` là chuỗi `<p>…</p>` **đã escape HTML** phía GAS (`textToParagraphs_`).
- Comment lưu **nguyên văn**, không escape — escape là việc của chỗ hiển thị. Site phải chèn
  bằng `textContent`, **không** `innerHTML`; escape cả 2 nơi sẽ ra `&amp;lt;` trên trang.
- Khoá chương: `chapters(slug, n)`. GAS coi **404 = chưa có**, không phải lỗi.
- Dung lượng tính bằng `LENGTH(CAST(content AS BLOB))`, **không** `LENGTH()`: `LENGTH()` trả số
  **ký tự**, với tiếng Việt có dấu sẽ báo thiếu ~1/3 (đã đo: 37 ký tự = 49 byte).
- `GET /_api/stats` lấy slug từ **UNION** của `views_daily` và `views_archive`: truyện 40 ngày
  không ai đọc bị cron dọn hết dòng khỏi `views_daily`, nếu chỉ JOIN từ đó nó biến mất khỏi kết
  quả → GAS ghi `views=0` và xoá sạch lượt xem all-time. Lỗi này đã được test và vá.

## 7. Nhập hàng loạt

620 chương × 1–3s round-trip = vài ngày ngồi bấm nếu nhập từng cái. Nhập hàng loạt là **tính
năng bắt buộc**, không phải nice-to-have.

- Client tự chia batch **25 chương** và gọi `importChapters()` liên tiếp — mỗi batch là 1 request
  độc lập, nên **không request nào phải xử lý 600 chương**. Đây là cách né giới hạn 6 phút/lần
  chạy của GAS, không phải tối ưu tốc độ.
- Mỗi batch: 1 POST bulk (Worker ghi 25 chương bằng `D1.batch` — **một transaction**, lỗi là
  rollback sạch; R2 không có ghi nhiều key kiểu atomic nên lỗi giữa batch sẽ để lại nửa vời) +
  1 lần ghi `chapters.json`.
- **Chỉ batch cuối** ghi `stories.json` → cả lần nhập 620 chương trigger **đúng 1** lần build.
- Dừng/mất mạng giữa đường: phần đã nhập còn nguyên, nhập lại chỉ bù phần thiếu (idempotent vì
  upsert theo khoá `(slug, n)`).
- 2 chế độ: dán 1 khối tách theo dòng `Chương N: Tiêu đề`, hoặc tải nhiều `.txt` (số lấy từ chữ
  số cuối trong tên file). Có bước **xem trước** cảnh báo trùng số / chương rỗng / sẽ ghi đè.

## 8. Bất biến — đừng phá

| Thứ | Vì sao |
|---|---|
| `slug` truyện | URL công khai + tên file ảnh bìa + **khoá D1 của cả 300 chương**. Chặn ở cả server (`saveStory`) và client (`disabled`). |
| `n` (số chương) | URL `/chuong-<n>` + khoá D1. Đổi tiêu đề thì được, đổi số thì xoá rồi tạo lại. |
| `slug` thể loại | truyện lưu `genres:["hien-dai"]`. Đổi slug = mọi truyện trỏ sai. Đổi **tên hiển thị** thì tự do. |

Đổi URL thật sự: xoá bản ghi cũ, tạo mới. Không sửa tại chỗ.

## 9. Phân quyền

`root > admin > editor` (bỏ hẳn `viewer` — không có hành vi phân biệt được).

| | editor | admin | root |
|---|---|---|---|
| Thêm/sửa truyện, chương, nhập hàng loạt | ✓ | ✓ | ✓ |
| **Xoá truyện** (xoá cả trăm chương trong D1) | ✗ | ✓ | ✓ |
| Bình luận, người dùng, thể loại, cài đặt | ✗ | ✓ | ✓ |

- **Chủ script luôn là `root` ngầm định** — dù sheet `Users` bị xoá sạch vẫn vào được.
  `requestOtp` cũng tự cho chủ script qua, nếu không sẽ tự khoá mình ra khỏi CMS ngay lần đầu.
- `root` **chỉ** sửa được bằng tay trong Sheet, không bao giờ qua CMS.
- Ẩn nút trên UI **không phải bảo mật** — mọi hàm đều tự `requireRole_` ở server.

## 10. Checklist cài đặt

### A. GAS (làm được ngay, không cần Cloudflare)
1. `npm i -g @google/clasp` → `clasp login`
2. `clasp create --type webapp --title "Trang Sao Truyen CMS" --rootDir gas` → `clasp push`
3. Project Settings → Script Properties: điền 4 key `GITHUB_*` (mục 5)
4. Chạy tay 1 hàm bất kỳ trong editor để Google xin quyền (Sheets + Gmail + external request).
   **Thêm dịch vụ Google mới về sau phải chạy lại bước này**, nếu không sẽ gặp
   "insufficient permission" dù code đúng.
5. Deploy → New deployment → Web app → Execute as **Me** → Who has access **Anyone**
6. Mở `/exec` → đăng nhập bằng email chủ script → nhận OTP qua Gmail
7. Tab Cài đặt → thêm thể loại (`hien-dai`, `co-trang`, `tien-hiep`, `huyen-huyen`,
   `trinh-tham`, `kinh-di`) → Lưu
8. Tab Truyện → tạo 1 truyện thử + ảnh bìa → kiểm repo đã có `data/stories.json`,
   `data/truyen/<slug>/story.json`, `html/assets/truyen/<slug>-500x750.webp`

### B. Cloudflare (mở khoá phần chương + lượt xem + bình luận)
**Không cần phương thức thanh toán** — chỉ dùng Workers + Static Assets + D1, đều là free tier
không đòi thẻ. Cần **Node ≥ 20** (wrangler 4); máy đang có Node 18 → `nvm install 20 && nvm use 20`.

1. `npm install` (cài wrangler cục bộ)
2. `npx wrangler login`
3. `npx wrangler d1 create trangsaotruyen` → dán `database_id` vào `wrangler.toml`
   (đang là `PASTE_DATABASE_ID_HERE`)
4. `npm run db:init` (áp `worker/schema.sql` lên D1 remote)
5. `npx wrangler secret put ADMIN_TOKEN` → dán một chuỗi random dài
6. `npx wrangler deploy`
7. GAS Script Properties: `WORKER_API_URL` = `https://<worker>.workers.dev/_api` (đổi sang
   `https://trangsaotruyen.com/_api` sau khi gắn Custom Domain), `WORKER_API_TOKEN` = token bước 5
8. Deploy lại GAS (New version) → mở tab Chương, banner cảnh báo phải mất
9. Chạy tay `installDailyStatsTrigger()` trong editor GAS → đặt trigger 02:00 mỗi ngày

### C. Build và xem tại máy (không cần Cloudflare)

`build.py` không dùng thư viện ngoài, nên chỉ cần Python 3:

```
npm run preview      # build rồi mở http://localhost:8080
```

Xem được **mọi trang tĩnh**: trang chủ, phân loại, chi tiết truyện (đủ danh sách chương), trang
tĩnh, 404. **Trang chương sẽ 404** vì nội dung nằm trong D1 — muốn thử cả trang chương thì cần
Cloudflare (mục B) rồi `npm run dev` (wrangler dev), và phải nhập ít nhất 1 chương qua CMS.

Các lệnh khác:

| Lệnh | Việc |
|---|---|
| `npm run build` | Sinh lại `html/` từ `data/` + `layouts/` + `static/` |
| `npm run seed` | Nạp lại 35 truyện mẫu vào `data/` — **ghi đè**, đừng chạy khi CMS đã có dữ liệu thật |
| `npm run dev` | build + `wrangler dev` (chạy cả Worker + D1 local) |
| `npm run deploy` | build + `wrangler deploy` (thường để CI làm) |

**Sửa design thì sửa trong `layouts/` và `static/`, không sửa trong `html/`** — lần build kế tiếp
xoá sạch `html/`.

`templates/` là bản gốc 7 trang HTML tĩnh ban đầu, giữ để đối chiếu bằng mắt. Nó **không tham gia
build** — xoá cả thư mục thì `npm run build` vẫn chạy (đã kiểm bằng cách xoá thật rồi build lại).
Xem `templates/README.md`.

**Mỗi lần sửa code GAS sau đó**: `clasp push` → Deploy → **Manage deployments → Edit → New
version**. Dùng "New deployment" sẽ sinh URL `/exec` MỚI và bản cũ vẫn chạy song song — tưởng
đã deploy mà đang xem bản cũ. Console log `[TST CMS] client build: …` cho biết bản nào đang chạy.

## 11. Kế hoạch chia nhỏ `stories.json` (làm ở mốc ~5.000 truyện, KHÔNG làm bây giờ)

`data/stories.json` là **một file duy nhất** và GAS đọc + ghi lại **toàn bộ** file mỗi lần lưu
bất kỳ truyện/chương nào:

| Số truyện | stories.json | GAS chuyển mỗi lần Lưu |
|---|---|---|
| 500 | 273 KB | 749 KB |
| **2.000** | **1,1 MB** | **2,9 MB** |
| 5.000 | 2,7 MB | 7,3 MB |
| 10.000 | 5,3 MB | 14,6 MB |

Không giới hạn cứng nào bị vượt — nó chỉ **chậm dần**. Không gói trả tiền nào sửa được vì đây là
quyết định kiến trúc, không phải hạn mức.

### Chia theo thể loại là trục SAI

1. **Truyện thuộc nhiều thể loại.** Trong dữ liệu mẫu, 4/35 truyện (11%) có >1 thể loại. Một
   truyện sẽ nằm ở 2 shard → lưu phải ghi 2 file, và **đổi thể loại phải xoá khỏi shard cũ +
   thêm vào shard mới**. Sót bước xoá thì truyện xuất hiện 2 lần ở trang phân loại hoặc mất hẳn
   khỏi trang chủ — im lặng, không báo lỗi (đúng lớp bug ở gotcha #3).
2. **Nó làm chậm đúng chỗ đang nhanh.** CMS `boot()` cần *toàn bộ* danh sách để vẽ bảng:

| | Hiện tại | Chia theo thể loại |
|---|---|---|
| `boot()` đọc index | **1** GitHub GET | **25** GET (~5–10s) |
| Sync thống kê hằng ngày | **1** commit | **25** commit |
| Lưu 1 truyện | 1,1 MB | ~44 KB ✓ |

Được một, mất hai. Nếu **buộc** phải chia theo khoá thì chia theo **bucket của `id`**
(`data/stories/000.json` = id 0–199…): `id` bất biến nên truyện không bao giờ chuyển shard, hết
hẳn vấn đề (1).

### Trục ĐÚNG: tách theo tần suất ghi, không theo thể loại

Vấn đề thật không phải kích thước mà là **số lần ghi lại cả file**:

| Ghi lại toàn bộ `stories.json` | Tần suất |
|---|---|
| Thêm 1 chương (`touchStoryIndex_`) | **mỗi chương** |
| Sửa tiêu đề 1 chương | mỗi lần sửa |
| Sync thống kê từ D1 | 1 lần/ngày |
| Sửa/thêm truyện | mỗi lần Lưu |

Ba dòng đầu **không liên quan gì đến nội dung biên tập**. File đang trộn hai loại dữ liệu lệch
nhau hàng trăm lần về tần suất ghi:

| | Field | Đổi khi nào |
|---|---|---|
| **Biên tập** | slug, title, author, genres, cover, status, hot | admin sửa truyện — **hiếm** |
| **Dẫn xuất** | chapter_count, updated_at, views, day/week/month_views, rating, nominations | mỗi chương, mỗi ngày — **liên tục** |

Tách theo trục này: entry nhỏ **36%** (560 → 362 byte), nhưng cái đáng giá là **thêm 1 chương
không còn ghi lại file index**. Hình dạng đích:

```
data/stories.json                 biên tập — chỉ ghi khi admin sửa truyện
data/truyen/<slug>/chapters.json  18 KB/truyện — ghi khi đổi chương, thành CI trigger
data/_stats.json                  số dẫn xuất — ghi 1 lần/ngày, chương không bao giờ chạm
```

**Phương án thay thế: chuyển index sang D1.** GAS ghi 1 dòng thay vì ghi lại 1,1 MB — hằng số
mãi mãi; `build.py` đọc index qua `/_api/stories`. Đổi lại: index không còn trong git (mất
`git diff` đọc được bằng mắt, mất git làm bản sao lưu) và build phụ thuộc Worker còn sống.

### Hai điều phải nói rõ

- **Không giảm số lần build.** Trang chi tiết vẫn phải build lại khi có chương mới, nên số build
  (~22/ngày với repo private) không đổi. Việc này chỉ bỏ được 2,9 MB chuyển mỗi lần đăng chương.
- **`chapter_count` chưa có lời giải gọn.** Nó là số dẫn xuất, nhưng bảng truyện trong CMS cần
  nó *ngay* — không chờ được sync hằng ngày, cũng không thể đọc 2.000 file `chapters.json`. Phải
  nghĩ thêm khi làm thật.

**Vì sao không làm bây giờ:** ở 0–500 truyện, một file đơn giản hơn hẳn, `git diff` đọc được
bằng mắt, mọi bug lộ ngay. Playbook có nguyên tắc "đừng tối ưu sớm" — chỉ nâng khi thực tế chạm.

## 12. Trạng thái hiện tại & việc còn lại

### Dữ liệu: TRẮNG
`data/stories.json` = `[]`, `data/truyen/` rỗng. Không có truyện mẫu nào — bạn nhập truyện thật
qua CMS từ đầu. `data/site-config.json` **được giữ**: đó là cấu hình (tên site, domain, 6 thể
loại), không phải nội dung; xoá hết thể loại thì CMS chặn tạo truyện ngay ("Chọn ít nhất 1 thể
loại"). Muốn trắng hẳn thì sửa `genres` thành `[]`.

Muốn dựng lại 35 truyện mẫu để thử: `npm run seed` (ghi đè `data/`, chỉ dùng khi chưa có dữ
liệu thật). Nguồn ở `scripts/mock-data.json`.

### Đã kiểm trên trình duyệt thật (Chrome)
Trang chủ, phân loại (kèm `?so-chuong=`/`?sort=`), chi tiết truyện, trang đọc chương. Đã xác
nhận chạy: dropdown header, dark mode + lưu lựa chọn, tìm kiếm (bỏ dấu, theo tên & tác giả),
phân trang 620 chương, 3 tab bảng xếp hạng, thu gọn mô tả, yêu thích, thanh cỡ chữ/màu nền,
dropdown 620 chương tự cuộn tới chương đang đọc, lưu vị trí đọc. **0 lỗi JS.**

### CHƯA kiểm được
- **Mobile**: không thu nhỏ được viewport trong phiên test, nên responsive chưa xác nhận. CSS
  mobile là của bản gốc (commit "fix device mobile") và các sửa đổi đều là rule bổ sung, nên
  rủi ro thấp — nhưng chưa có bằng chứng.
- **GAS runtime**: 2.942 dòng chưa chạy lần nào trong Apps Script.
- **Worker runtime**: chưa deploy. Trang chương chỉ được kiểm bằng cách render template thủ
  công đúng như Worker làm.
- **CI**: chưa chạy.

### Việc còn lại
- [ ] Deploy: mục 10.A (GAS) + 10.B (Cloudflare) — chưa có `clasp`, chưa có `database_id`,
      Node đang v18 (cần ≥20)
- [ ] Nhập truyện + chương thật qua CMS. Trang chương trả 404 tới khi D1 có nội dung
- [ ] Custom Domain `trangsaotruyen.com` — đổi nameserver **và** gán domain vào Worker (2 việc
      độc lập với deploy). Kiểm: `dig +short trangsaotruyen.com NS @1.1.1.1` và
      `curl -sI https://trangsaotruyen.com/ | grep -i server`
- [ ] Kiểm responsive trên máy thật
- [ ] Quyết định: khối **"Truyện Cùng Tác Giả"** ở trang chi tiết hiện lấp thêm truyện của tác
      giả KHÁC cho đủ 8 dòng (giữ nguyên hành vi bản gốc). Trên site thật tiêu đề này thành
      sai — nên đổi tiêu đề, hoặc chỉ hiện truyện cùng tác giả thật và ẩn khối khi không có
- [ ] Theo dõi dung lượng D1: chạm 5 GB thì di cư sang R2 hoặc Workers Paid — chỉ sửa
      `worker/src/index.js`, GAS không đổi
- [ ] `scripts/mock-data.json` + `seed_from_mock.py` + `templates/`: xoá được khi không cần nữa
