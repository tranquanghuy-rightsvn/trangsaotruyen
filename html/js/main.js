'use strict';

/* =============================================================
   TRĂNG SAO TRUYỆN — main.js
   Toàn bộ dữ liệu mẫu (mock data) + logic Vanilla JS cho website.
   Các trang HTML gắn thuộc tính data-page ở thẻ <body> để file này
   biết cần khởi chạy hàm init nào.
   ============================================================= */

// Mỗi trang con nằm trong thư mục riêng (VD: /truyen-chi-tiet/index.html) nên cần
// biết đường dẫn tương đối về gốc /html để dựng link nội bộ cho đúng.
// <body data-root="./"> ở trang chủ, <body data-root="../"> ở các trang con.
const ROOT = document.body.dataset.root || './';
const PAGE_PATH = {
  home: ROOT + 'index.html',
  detail: ROOT + 'truyen-chi-tiet/index.html',
  reader: ROOT + 'doc-truyen/index.html',
  category: ROOT + 'phan-loai/index.html',
  login: ROOT + 'login/index.html',
  signup: ROOT + 'signup/index.html'
};

/* =============================================================
   1. DỮ LIỆU MẪU (MOCK DATA)
   ============================================================= */

const GENRE_LABELS = {
  'hien-dai': 'Ngôn Tình Hiện Đại',
  'co-trang': 'Ngôn Tình Cổ Trang',
  'tien-hiep': 'Tiên Hiệp',
  'huyen-huyen': 'Huyền Huyễn',
  'trinh-tham': 'Trinh Thám',
  'kinh-di': 'Kinh Dị'
};

// Nguồn: mảng truyện mẫu dùng chung cho toàn bộ website
const NOVELS = [
  {
    id: 1, slug: 'tieng-noi-chua-lanh-cua-sep-tong', title: 'Tiếng Nói Chữa Lành Của Sếp Tổng',
    author: 'Lam Tử Nhược', genres: ['hien-dai'], tags: ['Tổng tài', 'Chữa lành', 'Đô thị'],
    status: 'full', chapterCount: 42, rating: 4.8, hot: false, cover: 1, initials: 'CL',
    coverImage: 'assets/truyen/tieng-noi-chua-lanh-cua-sep-tong.png',
    views: 1520000, dayViews: 8200, weekViews: 41000, monthViews: 152000, nominations: 3300,
    updatedMinutesAgo: 12,
    description: 'Một CEO lạnh lùng mang trong mình vết thương lòng sâu kín, tình cờ gặp gỡ cô trợ lý có giọng nói dịu dàng như liều thuốc chữa lành. Giữa những deal làm ăn căng thẳng và bí mật gia tộc, liệu tình yêu có thể hàn gắn những vết nứt trong tim họ?'
  },
  {
    id: 2, slug: 'giam-doc-lanh-lung-va-co-vo-nho', title: 'Giám Đốc Lạnh Lùng Và Cô Vợ Nhỏ',
    author: 'Diệp Chi Thu', genres: ['hien-dai'], tags: ['Tổng tài', 'Hôn nhân trước yêu sau'],
    status: 'full', chapterCount: 156, rating: 4.6, hot: false, cover: 2, initials: 'GĐ',
    views: 2100000, dayViews: 6100, weekViews: 33000, monthViews: 121000, nominations: 2100,
    updatedMinutesAgo: 340,
    description: 'Một cuộc hôn nhân sắp đặt tưởng chừng chỉ là hợp đồng, nhưng càng ở gần nhau, trái tim băng giá của vị giám đốc quyền lực càng dần tan chảy vì cô vợ nhỏ bé nhưng đầy nghị lực.'
  },
  {
    id: 3, slug: 'tong-tai-bi-ban-gai-cu-tan-cong', title: 'Tổng Tài Bị Bạn Gái Cũ Tấn Công',
    author: 'Mộc Tiểu Hề', genres: ['hien-dai'], tags: ['Tổng tài', 'Ngược tâm', 'Đô thị'],
    status: 'ongoing', chapterCount: 18, rating: 4.3, hot: true, cover: 3, initials: 'TT',
    views: 890000, dayViews: 5200, weekViews: 24000, monthViews: 88000, nominations: 1500,
    updatedMinutesAgo: 25,
    description: 'Khi bạn gái cũ quay trở lại tìm cách chia rẽ, vị tổng tài lạnh lùng phải chứng minh trái tim mình đã thuộc về ai. Một câu chuyện tình yêu đầy sóng gió chốn thương trường.'
  },
  {
    id: 4, slug: 'chua-lanh-trai-tim-lanh-gia', title: 'Chữa Lành Trái Tim Lạnh Giá',
    author: 'Hạ Vũ Thần', genres: ['hien-dai'], tags: ['Chữa lành', 'Đô thị'],
    status: 'ongoing', chapterCount: 35, rating: 4.5, hot: false, cover: 4, initials: 'CT',
    views: 610000, dayViews: 2900, weekViews: 15000, monthViews: 55000, nominations: 900,
    updatedMinutesAgo: 1450,
    description: 'Cô bác sĩ tâm lý nhận nhiệm vụ đặc biệt: chữa lành cho vị doanh nhân trẻ tuổi tưởng chừng vô cảm. Nhưng chính cô cũng cần một ai đó chữa lành cho mình.'
  },
  {
    id: 5, slug: 'hon-nhan-chi-la-hop-dong', title: 'Hôn Nhân Chỉ Là Hợp Đồng',
    author: 'Tô Tiểu Mạn', genres: ['hien-dai'], tags: ['Tổng tài', 'Hôn nhân hợp đồng'],
    status: 'full', chapterCount: 210, rating: 4.7, hot: false, cover: 5, initials: 'HN',
    views: 3300000, dayViews: 4100, weekViews: 21000, monthViews: 79000, nominations: 4200,
    updatedMinutesAgo: 4320,
    description: 'Một bản hợp đồng hôn nhân ba năm, tưởng chừng đơn giản như một giao dịch, lại trở thành khởi đầu cho mối tình sâu đậm không ai ngờ tới.'
  },
  {
    id: 6, slug: 'yeu-lai-tu-dau-voi-ceo', title: 'Yêu Lại Từ Đầu Với CEO',
    author: 'Vân Dịch', genres: ['hien-dai'], tags: ['Tổng tài', 'Thanh mai trúc mã'],
    status: 'ongoing', chapterCount: 12, rating: 4.1, hot: false, cover: 6, initials: 'YL',
    views: 210000, dayViews: 1800, weekViews: 9000, monthViews: 30000, nominations: 400,
    updatedMinutesAgo: 60,
    description: 'Sau năm năm xa cách, cô trở về và tình cờ trở thành nhân viên dưới quyền người yêu cũ — nay đã là CEO quyền lực nhất thành phố.'
  },
  {
    id: 7, slug: 'hoang-hau-mot-minh-chuyen-quyen', title: 'Hoàng Hậu Một Mình Chuyên Quyền',
    author: 'Cố Vãn Thư', genres: ['co-trang'], tags: ['Cung đấu', 'Nữ cường'],
    status: 'full', chapterCount: 320, rating: 4.9, hot: true, cover: 7, initials: 'HH',
    views: 5200000, dayViews: 9800, weekViews: 52000, monthViews: 198000, nominations: 6100,
    updatedMinutesAgo: 8,
    description: 'Từ một tú nữ vô danh, nàng từng bước vươn lên trở thành hoàng hậu nắm quyền chuyên chính hậu cung, khiến bao kẻ địch phải run sợ.'
  },
  {
    id: 8, slug: 'xuyen-khong-lam-dai-tieu-thu', title: 'Xuyên Không Làm Đại Tiểu Thư',
    author: 'Nguyệt Hạ Ca', genres: ['co-trang'], tags: ['Xuyên không', 'Nữ cường'],
    status: 'ongoing', chapterCount: 45, rating: 4.4, hot: false, cover: 8, initials: 'XK',
    views: 780000, dayViews: 3300, weekViews: 17000, monthViews: 63000, nominations: 1100,
    updatedMinutesAgo: 200,
    description: 'Xuyên không vào thân xác đại tiểu thư bị ghẻ lạnh, cô quyết tâm dùng trí tuệ hiện đại để lật ngược thế cờ, sống một đời huy hoàng.'
  },
  {
    id: 9, slug: 'cung-dau-thien-ha-de-vuong-so-huu', title: 'Cung Đấu Thiên Hạ Đế Vương Sở Hữu',
    author: 'Tần Vũ Lăng', genres: ['co-trang'], tags: ['Cung đấu', 'Đế vương'],
    status: 'full', chapterCount: 178, rating: 4.6, hot: false, cover: 1, initials: 'CD',
    views: 1950000, dayViews: 4700, weekViews: 23000, monthViews: 85000, nominations: 2600,
    updatedMinutesAgo: 720,
    description: 'Chốn hậu cung ngàn năm sóng gió, nơi một câu nói có thể đổi cả vận mệnh. Nàng phải học cách sinh tồn giữa vòng xoáy quyền lực của bậc đế vương.'
  },
  {
    id: 10, slug: 'dien-van-nu-phu-song-lai', title: 'Điền Văn: Nữ Phụ Sống Lại',
    author: 'Lục Y Nhi', genres: ['co-trang'], tags: ['Điền văn', 'Trọng sinh'],
    status: 'ongoing', chapterCount: 29, rating: 4.5, hot: false, cover: 2, initials: 'ĐV',
    views: 430000, dayViews: 2100, weekViews: 11000, monthViews: 41000, nominations: 700,
    updatedMinutesAgo: 95,
    description: 'Sống lại sau một kiếp bi kịch, nữ phụ quyết định buông bỏ oán hận, về quê làm ruộng, buôn bán nhỏ, sống một cuộc đời điền viên an nhàn hạnh phúc.'
  },
  {
    id: 11, slug: 'vuong-phi-tai-thuong-thien-ha', title: 'Vương Phi Tài Thượng Thiên Hạ',
    author: 'Bạch Dạ Vi', genres: ['co-trang'], tags: ['Xuyên không', 'Cung đấu'],
    status: 'ongoing', chapterCount: 15, rating: 4.2, hot: false, cover: 3, initials: 'VP',
    views: 150000, dayViews: 1200, weekViews: 6000, monthViews: 22000, nominations: 300,
    updatedMinutesAgo: 1900,
    description: 'Một vị vương phi tài trí hơn người, dùng mưu lược của mình để bảo vệ vương phủ trước sóng gió triều đình.'
  },
  {
    id: 12, slug: 'de-vuong-nghich-thien-chi-ton', title: 'Đế Vương Nghịch Thiên Chí Tôn',
    author: 'Thiên Tuyệt', genres: ['tien-hiep'], tags: ['Tu tiên', 'Nghịch thiên'],
    status: 'full', chapterCount: 500, rating: 4.9, hot: true, cover: 4, initials: 'ĐN',
    views: 8100000, dayViews: 12000, weekViews: 68000, monthViews: 250000, nominations: 9200,
    updatedMinutesAgo: 15,
    description: 'Một thiếu niên bình phàm mang trong mình huyết mạch cổ xưa, bước trên con đường tu tiên nghịch thiên cải mệnh, chinh phục cửu giới.'
  },
  {
    id: 13, slug: 'than-y-cuong-phi', title: 'Thần Y Cuồng Phi',
    author: 'Ngôn Tang', genres: ['co-trang'], tags: ['Xuyên không', 'Y thuật'],
    status: 'ongoing', chapterCount: 33, rating: 4.3, hot: false, cover: 5, initials: 'TY',
    views: 320000, dayViews: 1600, weekViews: 8000, monthViews: 29000, nominations: 500,
    updatedMinutesAgo: 500,
    description: 'Thần y hiện đại xuyên không thành vương phi bị phế, mang theo y thuật thần kỳ, từng bước chữa bệnh cứu người, khẳng định vị thế của mình.'
  },
  {
    id: 14, slug: 'tham-tu-lung-danh-va-vu-an-mat-tich', title: 'Thám Tử Lừng Danh Và Vụ Án Mất Tích',
    author: 'Kha Nam', genres: ['trinh-tham'], tags: ['Trinh thám', 'Phá án'],
    status: 'ongoing', chapterCount: 24, rating: 4.6, hot: false, cover: 6, initials: 'TT',
    views: 410000, dayViews: 1900, weekViews: 9500, monthViews: 35000, nominations: 650,
    updatedMinutesAgo: 130,
    description: 'Một vụ mất tích bí ẩn kéo vị thám tử tài ba vào chuỗi manh mối rối ren, nơi mỗi nhân chứng đều che giấu một bí mật riêng.'
  },
  {
    id: 15, slug: 'ngoi-nha-am-anh-cuoi-pho', title: 'Ngôi Nhà Ám Ảnh Cuối Phố',
    author: 'Đêm Trắng', genres: ['kinh-di'], tags: ['Kinh dị', 'Bí ẩn'],
    status: 'ongoing', chapterCount: 16, rating: 4.4, hot: false, cover: 7, initials: 'NN',
    views: 260000, dayViews: 1400, weekViews: 7000, monthViews: 26000, nominations: 480,
    updatedMinutesAgo: 45,
    description: 'Căn nhà cuối con phố nhỏ mang một lời nguyền từ nhiều năm trước. Những ai chuyển đến đó đều không tránh khỏi những hiện tượng rùng rợn không lời giải thích.'
  },
  {
    id: 16, slug: 'tu-tien-vong-ky', title: 'Tu Tiên Vong Kỷ',
    author: 'Vong Ngữ', genres: ['tien-hiep'], tags: ['Tu tiên', 'Phiêu lưu'],
    status: 'full', chapterCount: 260, rating: 4.7, hot: false, cover: 8, initials: 'TT',
    views: 2700000, dayViews: 3200, weekViews: 16000, monthViews: 60000, nominations: 1800,
    updatedMinutesAgo: 2600,
    description: 'Mất hết ký ức, chàng trai trẻ bắt đầu lại con đường tu luyện từ con số không, dần khám phá ra thân thế thực sự đầy chấn động của bản thân.'
  },
  {
    id: 17, slug: 'yeu-thu-dai-nhan-xin-dung-qua', title: 'Yêu Thú Đại Nhân Xin Đừng Qua',
    author: 'Miêu Nhi', genres: ['huyen-huyen'], tags: ['Dị giới', 'Huyền huyễn'],
    status: 'ongoing', chapterCount: 38, rating: 4.3, hot: false, cover: 1, initials: 'YT',
    views: 350000, dayViews: 1700, weekViews: 8500, monthViews: 31000, nominations: 520,
    updatedMinutesAgo: 300,
    description: 'Lạc vào dị giới, cô gái nhỏ vô tình trở thành khắc tinh của các yêu thú đại nhân đầy quyền năng, cuộc sống từ đây rẽ sang hướng không tưởng.'
  },
  {
    id: 18, slug: 'hoc-vien-ma-phap-bong-toi', title: 'Học Viện Ma Pháp Bóng Tối',
    author: 'Hắc Việt', genres: ['huyen-huyen'], tags: ['Ma pháp', 'Học viện'],
    status: 'full', chapterCount: 120, rating: 4.5, hot: false, cover: 2, initials: 'HM',
    views: 1200000, dayViews: 2600, weekViews: 13000, monthViews: 48000, nominations: 1300,
    updatedMinutesAgo: 900,
    description: 'Ngôi học viện ma pháp danh tiếng ẩn giấu một bí mật hắc ám tồn tại hàng trăm năm, chỉ chờ những học viên mới đến khám phá.'
  },
  {
    id: 19, slug: 'ban-gai-ao-cua-tong-tai', title: 'Bạn Gái Ảo Của Tổng Tài',
    author: 'Diệp Khinh Hàn', genres: ['hien-dai'], tags: ['Tổng tài', 'Giả vờ yêu'],
    status: 'ongoing', chapterCount: 9, rating: 4.0, hot: true, cover: 3, initials: 'BG',
    views: 95000, dayViews: 2600, weekViews: 12000, monthViews: 40000, nominations: 250,
    updatedMinutesAgo: 5,
    description: 'Chỉ vì một lời hứa giúp đỡ, cô trở thành "bạn gái ảo" của vị tổng tài lạnh lùng nhất công ty. Nhưng ranh giới giữa giả và thật ngày càng mong manh.'
  },
  {
    id: 20, slug: 'de-nhat-si-nu-o-co-dai', title: 'Đệ Nhất Sĩ Nữ Ở Cổ Đại',
    author: 'Quỳnh Chi', genres: ['co-trang'], tags: ['Xuyên không', 'Điền văn'],
    status: 'ongoing', chapterCount: 47, rating: 4.6, hot: false, cover: 4, initials: 'ĐN',
    views: 680000, dayViews: 2400, weekViews: 12500, monthViews: 46000, nominations: 950,
    updatedMinutesAgo: 180,
    description: 'Mang kiến thức của người hiện đại, nàng xuyên về cổ đại trở thành sĩ nữ tài hoa, dùng thơ ca và trí tuệ tạo dựng một cuộc đời khác cho chính mình.'
  },
  {
    id: 21, slug: 'nguoi-yeu-cu-la-sep-moi', title: 'Người Yêu Cũ Là Sếp Mới',
    author: 'Hàn Tuyết Ly', genres: ['hien-dai'], tags: ['Tổng tài', 'Oan gia ngõ hẹp'],
    status: 'ongoing', chapterCount: 27, rating: 4.4, hot: false, cover: 5, initials: 'NY',
    views: 240000, dayViews: 1500, weekViews: 7600, monthViews: 27000, nominations: 410,
    updatedMinutesAgo: 240,
    description: 'Chuyển việc để tránh mặt người yêu cũ, cô không ngờ vị sếp mới đầy quyền lực lại chính là anh. Từ đồng nghiệp gượng gạo đến những rung động khó gọi tên.'
  },
  {
    id: 22, slug: 'bac-si-va-co-y-ta-nho', title: 'Bác Sĩ Và Cô Y Tá Nhỏ',
    author: 'Đông Phương Vy', genres: ['hien-dai'], tags: ['Bệnh viện', 'Chữa lành'],
    status: 'full', chapterCount: 130, rating: 4.5, hot: false, cover: 6, initials: 'BS',
    views: 1350000, dayViews: 2200, weekViews: 11000, monthViews: 42000, nominations: 1150,
    updatedMinutesAgo: 3200,
    description: 'Giữa những ca trực đêm căng thẳng nơi bệnh viện, vị bác sĩ ngoại khoa lạnh lùng dần bị cô y tá nhỏ vô tư làm tan chảy lớp vỏ bọc nghiêm nghị của mình.'
  },
  {
    id: 23, slug: 'phe-hau-tai-xuat-giang-ho', title: 'Phế Hậu Tái Xuất Giang Hồ',
    author: 'Tạ Y Nhược', genres: ['co-trang'], tags: ['Trọng sinh', 'Cung đấu'],
    status: 'ongoing', chapterCount: 14, rating: 4.6, hot: true, cover: 7, initials: 'PH',
    views: 510000, dayViews: 3900, weekViews: 19000, monthViews: 71000, nominations: 1400,
    updatedMinutesAgo: 20,
    description: 'Bị phế truất và hãm hại đến chết, nàng trọng sinh trở lại thời điểm còn là hoàng hậu tại vị. Lần này, nàng sẽ không để bi kịch cũ lặp lại.'
  },
  {
    id: 24, slug: 'thu-nu-nghich-tap', title: 'Thứ Nữ Nghịch Tập',
    author: 'Chu Tiểu Uyển', genres: ['co-trang'], tags: ['Thứ nữ', 'Mưu kế'],
    status: 'ongoing', chapterCount: 48, rating: 4.3, hot: false, cover: 8, initials: 'TN',
    views: 290000, dayViews: 1400, weekViews: 7000, monthViews: 26000, nominations: 380,
    updatedMinutesAgo: 620,
    description: 'Sinh ra là thứ nữ bị khinh rẻ trong phủ, nàng âm thầm học hỏi mưu kế, từng bước giành lại vị thế xứng đáng cho bản thân và mẹ ruột.'
  },
  {
    id: 25, slug: 'kiem-dao-doc-ton', title: 'Kiếm Đạo Độc Tôn',
    author: 'Cuồng Đao', genres: ['tien-hiep'], tags: ['Kiếm tu', 'Phục thù'],
    status: 'full', chapterCount: 620, rating: 4.8, hot: true, cover: 1, initials: 'KĐ',
    views: 6700000, dayViews: 10500, weekViews: 58000, monthViews: 220000, nominations: 7800,
    updatedMinutesAgo: 10,
    description: 'Gia tộc bị diệt môn, thiếu niên duy nhất sống sót mang theo một thanh kiếm gãy, bước lên con đường kiếm đạo đẫm máu để rửa hận cho người thân.'
  },
  {
    id: 26, slug: 'pham-nhan-nghich-thien-luc', title: 'Phàm Nhân Nghịch Thiên Lục',
    author: 'Vong Ngữ Nhị', genres: ['tien-hiep'], tags: ['Phàm nhân', 'Tu tiên'],
    status: 'ongoing', chapterCount: 18, rating: 4.1, hot: false, cover: 2, initials: 'PN',
    views: 88000, dayViews: 900, weekViews: 4400, monthViews: 16000, nominations: 210,
    updatedMinutesAgo: 400,
    description: 'Không tiên tư, không kỳ ngộ, chỉ có ý chí kiên định — một phàm nhân bình thường quyết tâm bước những bước đầu tiên trên con đường tu tiên nghịch thiên.'
  },
  {
    id: 27, slug: 'long-toc-truyen-nhan', title: 'Long Tộc Truyền Nhân',
    author: 'Tinh Vũ', genres: ['huyen-huyen'], tags: ['Long tộc', 'Huyết mạch cổ'],
    status: 'full', chapterCount: 210, rating: 4.6, hot: false, cover: 3, initials: 'LT',
    views: 1900000, dayViews: 2500, weekViews: 12500, monthViews: 47000, nominations: 1600,
    updatedMinutesAgo: 1800,
    description: 'Mang trong mình huyết mạch long tộc thất truyền, chàng trai trẻ dần thức tỉnh sức mạnh cổ xưa giữa lúc đại lục đứng trước nguy cơ diệt vong.'
  },
  {
    id: 28, slug: 'nu-phu-thuy-nho', title: 'Nữ Phù Thủy Nhỏ',
    author: 'Miêu Miêu Tử', genres: ['huyen-huyen'], tags: ['Phù thủy', 'Dị giới'],
    status: 'ongoing', chapterCount: 22, rating: 4.2, hot: false, cover: 4, initials: 'PT',
    views: 160000, dayViews: 1100, weekViews: 5600, monthViews: 21000, nominations: 300,
    updatedMinutesAgo: 540,
    description: 'Cô phù thủy nhỏ vụng về nhất học viện lại vô tình sở hữu năng lực bị nguyền rủa từ ngàn năm trước, cuộc sống bình yên của cô chính thức đảo lộn.'
  },
  {
    id: 29, slug: 'ke-giau-mat-trong-bong-toi', title: 'Kẻ Giấu Mặt Trong Bóng Tối',
    author: 'Kha Nam Nhị', genres: ['trinh-tham'], tags: ['Trinh thám', 'Tâm lý tội phạm'],
    status: 'ongoing', chapterCount: 40, rating: 4.5, hot: false, cover: 5, initials: 'KG',
    views: 370000, dayViews: 1600, weekViews: 8000, monthViews: 30000, nominations: 560,
    updatedMinutesAgo: 260,
    description: 'Một chuỗi án mạng liên hoàn không để lại dấu vết khiến cả đội điều tra bối rối, chỉ có nữ thám tử trẻ nhận ra mọi manh mối đều dẫn về một quá khứ bị chôn giấu.'
  },
  {
    id: 30, slug: 'ho-so-vu-an-dong-bang', title: 'Hồ Sơ Vụ Án Đóng Băng',
    author: 'Lãnh Phong', genres: ['trinh-tham'], tags: ['Án treo', 'Phá án'],
    status: 'full', chapterCount: 130, rating: 4.7, hot: false, cover: 6, initials: 'HS',
    views: 1100000, dayViews: 1900, weekViews: 9500, monthViews: 36000, nominations: 900,
    updatedMinutesAgo: 2100,
    description: 'Mười năm sau vụ án bị đóng băng vì thiếu chứng cứ, một manh mối nhỏ bất ngờ xuất hiện, mở lại toàn bộ hồ sơ tưởng chừng đã đi vào quên lãng.'
  },
  {
    id: 31, slug: 'benh-vien-bo-hoang', title: 'Bệnh Viện Bỏ Hoang',
    author: 'Đêm Trắng Nhị', genres: ['kinh-di'], tags: ['Kinh dị', 'Bỏ hoang'],
    status: 'ongoing', chapterCount: 13, rating: 4.3, hot: true, cover: 7, initials: 'BV',
    views: 320000, dayViews: 2900, weekViews: 14000, monthViews: 52000, nominations: 700,
    updatedMinutesAgo: 8,
    description: 'Nhóm sinh viên đột nhập bệnh viện tâm thần bỏ hoang để quay video thử thách, nhưng không ai trong số họ nhận ra mình đã đánh thức thứ gì đó vẫn còn ở lại.'
  },
  {
    id: 32, slug: 'loi-nguyen-bup-be-co', title: 'Lời Nguyền Búp Bê Cổ',
    author: 'Vực Sâu', genres: ['kinh-di'], tags: ['Lời nguyền', 'Đồ vật ám'],
    status: 'ongoing', chapterCount: 33, rating: 4.4, hot: false, cover: 8, initials: 'BB',
    views: 280000, dayViews: 1300, weekViews: 6500, monthViews: 24000, nominations: 450,
    updatedMinutesAgo: 700,
    description: 'Món quà thừa kế từ người bà quá cố là một con búp bê sứ cổ, và kể từ đêm đầu tiên đặt nó trong phòng, những điều bất thường bắt đầu xảy ra liên tiếp.'
  },
  {
    id: 33, slug: 'idol-bi-mat-cua-toi', title: 'Idol Bí Mật Của Tôi',
    author: 'Lam Vy', genres: ['hien-dai'], tags: ['Giải trí', 'Ngôi sao', 'Giấu thân phận'],
    status: 'ongoing', chapterCount: 16, rating: 4.2, hot: true, cover: 1, initials: 'ID',
    views: 130000, dayViews: 3100, weekViews: 15000, monthViews: 56000, nominations: 620,
    updatedMinutesAgo: 18,
    description: 'Cô bạn cùng phòng trọ bình thường không hề biết rằng người bạn thân đang giấu một bí mật động trời: cô ấy chính là thần tượng hạng A đang được cả nước săn đón.'
  },
  {
    id: 34, slug: 'nuong-nuong-chi-muon-duong-lao', title: 'Nương Nương Chỉ Muốn Dưỡng Lão',
    author: 'Điền Điền', genres: ['co-trang'], tags: ['Điền văn', 'Xuyên không', 'Chữa lành'],
    status: 'ongoing', chapterCount: 39, rating: 4.5, hot: false, cover: 2, initials: 'DL',
    views: 310000, dayViews: 1450, weekViews: 7200, monthViews: 27000, nominations: 480,
    updatedMinutesAgo: 460,
    description: 'Xuyên không thành sủng phi nhưng chẳng màng tranh sủng, nàng chỉ muốn xin xuất cung về một trang viên nhỏ, trồng rau nuôi gà, sống nốt đời an nhàn dưỡng lão.'
  },
  {
    id: 35, slug: 'van-co-chi-ton-quy-lai', title: 'Vạn Cổ Chí Tôn Quy Lai',
    author: 'Thiên Tuyệt Nhị', genres: ['tien-hiep'], tags: ['Trọng sinh', 'Chí tôn'],
    status: 'full', chapterCount: 350, rating: 4.7, hot: false, cover: 3, initials: 'VC',
    views: 3900000, dayViews: 4400, weekViews: 22000, monthViews: 83000, nominations: 3100,
    updatedMinutesAgo: 950,
    description: 'Chí tôn một thời bị đồng môn phản bội, hồn phách trọng sinh trở về vạn năm trước khi còn là một tu sĩ vô danh. Lần này, ân oán sẽ được tính lại từ đầu.'
  }
];

// Kho tiêu đề chương theo thể loại — dùng để sinh danh sách chương "giả lập"
const CHAPTER_TITLE_POOL = {
  'hien-dai': ['Cuộc gặp bất ngờ', 'Hợp đồng oan gia', 'Bí mật sau nụ cười', 'Đêm mưa không ngủ', 'Ghen tuông vô cớ', 'Lời tỏ tình vụng về', 'Hiểu lầm tai hại', 'Nắm tay dưới mưa'],
  'co-trang': ['Tiến cung', 'Mưu kế thâm cung', 'Thánh chỉ bất ngờ', 'Đêm trăng khuyết', 'Lệnh bài hoàng tộc', 'Sóng gió hậu viện', 'Ám sát bất thành', 'Trở về vương phủ'],
  'tien-hiep': ['Đột phá cảnh giới', 'Kỳ ngộ trong hang sâu', 'Đấu pháp trên đài', 'Bí cảnh cổ xưa', 'Đan dược trân quý', 'Thiên kiếp giáng lâm', 'Kiếm ý xuất thần', 'Cửu giới chấn động'],
  'huyen-huyen': ['Yêu thú xuất hiện', 'Ma pháp trận pháp', 'Bí ẩn học viện', 'Sức mạnh thức tỉnh', 'Hắc ám tràn về', 'Trận chiến sinh tử', 'Lời tiên tri cổ', 'Ánh sáng cuối đường hầm'],
  'trinh-tham': ['Manh mối đầu tiên', 'Nhân chứng bí ẩn', 'Hiện trường thứ hai', 'Nghi phạm mới', 'Bằng chứng ngoại phạm', 'Sự thật hé lộ', 'Đối chất căng thẳng', 'Kết thúc bất ngờ'],
  'kinh-di': ['Tiếng động lạ ban đêm', 'Căn phòng bị khóa', 'Bóng người trong gương', 'Lời nguyền cổ', 'Giấc mơ lặp lại', 'Vết máu trên tường', 'Cánh cửa không nên mở', 'Sự thật kinh hoàng']
};

// Kho câu văn mẫu để sinh nội dung chương đọc thử
const PARAGRAPH_POOL = [
  'Gió đêm lùa qua khung cửa sổ, mang theo hơi lạnh len lỏi vào từng góc nhỏ của căn phòng, khiến không khí trở nên tĩnh lặng đến lạ thường.',
  'Nàng đứng lặng nơi hiên nhà, ánh mắt xa xăm dõi theo con đường nhỏ dẫn về phía chân trời, nơi từng có một bóng hình quen thuộc bước đi.',
  'Không ai ngờ rằng chỉ một quyết định nhỏ trong khoảnh khắc ấy lại có thể thay đổi toàn bộ vận mệnh của những người liên quan.',
  'Tiếng bước chân vang lên trong hành lang dài hun hút, mỗi nhịp bước như đang đếm ngược đến một điều gì đó không thể tránh khỏi.',
  'Anh siết chặt bàn tay, cố gắng kìm nén cảm xúc đang trào dâng, nhưng ánh mắt vẫn không thể giấu được sự lo lắng tận đáy lòng.',
  'Cả căn phòng chìm trong im lặng, chỉ còn tiếng đồng hồ tích tắc đều đặn như đang nhắc nhở về thời gian đang dần trôi qua.',
  'Giữa chốn thị phi, chỉ có nàng là người duy nhất dám đứng lên nói ra sự thật, dù biết rằng cái giá phải trả không hề nhỏ.',
  'Ánh nắng chiều nhuộm vàng cả một khoảng sân, kéo dài những chiếc bóng đổ nghiêng như đang kể lại một câu chuyện đã cũ.',
  'Trong khoảnh khắc ấy, mọi lời giải thích dường như trở nên thừa thãi, chỉ có ánh mắt là đủ để nói lên tất cả những gì cần nói.',
  'Cơn mưa bất chợt đổ xuống, xóa nhòa mọi dấu vết trên con phố quen thuộc, chỉ để lại một cảm giác trống trải khó tả trong lòng người ở lại.',
  'Từ xa, tiếng chuông vọng lại báo hiệu một sự kiện quan trọng sắp diễn ra, khiến cả phủ đệ nhốn nháo chuẩn bị.',
  'Nàng khẽ mím môi, ánh mắt kiên định nhìn thẳng về phía trước, tự nhủ rằng dù khó khăn thế nào cũng không được lùi bước.',
  'Một luồng khí lạnh bất chợt lướt qua, khiến ngọn nến trong phòng chao đảo rồi vụt tắt, để lại bóng tối bao trùm khắp không gian.',
  'Giữa những lời đồn đoán và nghi kỵ, sự thật vẫn luôn ẩn giấu đâu đó, chờ đợi người đủ can đảm để tìm ra.',
  'Trái tim anh đập nhanh hơn khi nhận ra cảm xúc thật sự của mình, một cảm giác mà bấy lâu nay anh luôn cố tình phủ nhận.'
];

/* =============================================================
   2. HÀM TIỆN ÍCH (UTILITIES)
   ============================================================= */

// Định dạng số lượt xem dạng rút gọn: 1500000 -> "1.5M"
function formatViews(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace('.0', '') + 'K';
  return String(num);
}

// Sinh HTML chuỗi sao đánh giá (rating trên thang 5)
function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  let html = '';
  for (let i = 0; i < full; i++) html += '★';
  if (half) html += '⯨';
  for (let i = full + (half ? 1 : 0); i < 5; i++) html += '☆';
  return html;
}

// Chuyển số phút thành chữ "cách đây x phút/giờ/ngày"
function timeAgoText(minutes) {
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

function getNovelBySlug(slug) {
  return NOVELS.find(n => n.slug === slug);
}

// Ảnh bìa: dùng Picsum Photos (ảnh stock miễn phí, được phép tái sử dụng) — seed theo
// slug truyện để mỗi truyện luôn hiển thị cùng một ảnh minh họa cố định.
function coverImgURL(novel, width, height) {
  if (novel.coverImage) return ROOT + novel.coverImage;
  return `https://picsum.photos/seed/${novel.slug}/${width}/${height}`;
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// Sinh danh sách chương của một truyện (dựa trên chapterCount) — không lưu sẵn để tránh dữ liệu khổng lồ
function getChapters(novel) {
  const pool = CHAPTER_TITLE_POOL[novel.genres[0]] || CHAPTER_TITLE_POOL['hien-dai'];
  const chapters = [];
  for (let i = novel.chapterCount; i >= 1; i--) {
    const title = pool[i % pool.length];
    const minutesAgo = novel.updatedMinutesAgo + (novel.chapterCount - i) * 180;
    chapters.push({ num: i, title: `Chương ${i}: ${title}`, minutesAgo });
  }
  return chapters;
}

// Sinh nội dung (mảng đoạn văn) cho một chương cụ thể — dữ liệu giả lập để đọc thử
function getChapterContent(novel, chapterNum) {
  const paragraphs = [];
  const seed = novel.id * 7 + chapterNum * 3;
  const count = 10 + (seed % 6);
  for (let i = 0; i < count; i++) {
    paragraphs.push(PARAGRAPH_POOL[(seed + i * 5) % PARAGRAPH_POOL.length]);
  }
  return paragraphs;
}

// Kho tên & nội dung bình luận mẫu — dữ liệu demo tự sinh, không phải bình luận thật của người dùng
const COMMENT_NAMES = ['Minh Anh', 'Thảo Vy', 'Gia Hân', 'Bảo Ngọc', 'Thanh Trúc', 'Hoàng Yến', 'Tuấn Kiệt', 'Quỳnh Như', 'Đăng Khoa', 'Phương Linh'];
const COMMENT_TEXTS = [
  'Truyện hay quá, đọc không dứt ra được!',
  'Cốt truyện lôi cuốn, mong tác giả ra chương đều đặn.',
  'Nhân vật chính được xây dựng rất có chiều sâu.',
  'Đoạn cao trào làm mình hồi hộp suốt cả buổi tối.',
  'Văn phong mượt mà, dễ đọc, rất đáng để theo dõi.',
  'Chờ chương mới từng ngày luôn á!',
  'Tình tiết bất ngờ khiến mình phải đọc lại lần hai.',
  'Một trong những truyện hay nhất mình đọc gần đây.',
  'Cảm ơn tác giả vì một câu chuyện ý nghĩa.',
  'Đọc mà cứ cười tủm tỉm suốt, quá dễ thương.'
];

// Sinh danh sách bình luận demo cho một truyện — dữ liệu giả lập, không lưu trữ, chỉ để minh họa giao diện
function getDemoComments(novel) {
  const count = 3 + (novel.id % 4);
  const comments = [];
  for (let i = 0; i < count; i++) {
    const seed = novel.id * 11 + i * 7;
    const daysAgo = 1 + (seed % 20);
    const date = new Date(Date.now() - daysAgo * 86400000 - (seed % 24) * 3600000);
    comments.push({
      author: COMMENT_NAMES[seed % COMMENT_NAMES.length],
      rating: 4 + (seed % 2),
      text: COMMENT_TEXTS[(seed + i) % COMMENT_TEXTS.length],
      date: date.toISOString()
    });
  }
  return comments.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function formatCommentDate(isoStr) {
  const d = new Date(isoStr);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/* =============================================================
   3. LƯU TRỮ CỤC BỘ (LOCALSTORAGE): THEME / FONT / VỊ TRÍ ĐỌC / YÊU THÍCH
   ============================================================= */

const Store = {
  KEYS: {
    SITE_THEME: 'tst_site_theme',      // 'light' | 'dark'
    READER_BG: 'tst_reader_bg',        // 'white' | 'cream' | 'dark'
    FONT_SIZE: 'tst_font_size',        // số px
    READING_POS: 'tst_reading_pos',    // { [slug]: chapterNum }
    FAVORITES: 'tst_favorites',        // [slug, ...]
    COMMENTS: 'tst_comments'           // { [slug]: [{author, rating, text, date}, ...] }
  },

  getSiteTheme() { return localStorage.getItem(this.KEYS.SITE_THEME) || 'light'; },
  setSiteTheme(v) { localStorage.setItem(this.KEYS.SITE_THEME, v); },

  getReaderBg() { return localStorage.getItem(this.KEYS.READER_BG) || 'white'; },
  setReaderBg(v) { localStorage.setItem(this.KEYS.READER_BG, v); },

  getFontSize() { return parseInt(localStorage.getItem(this.KEYS.FONT_SIZE) || '18', 10); },
  setFontSize(v) { localStorage.setItem(this.KEYS.FONT_SIZE, String(v)); },

  getAllReadingPos() {
    try { return JSON.parse(localStorage.getItem(this.KEYS.READING_POS)) || {}; }
    catch (e) { return {}; }
  },
  getReadingPos(slug) { return this.getAllReadingPos()[slug] || null; },
  setReadingPos(slug, chapterNum) {
    const all = this.getAllReadingPos();
    all[slug] = chapterNum;
    localStorage.setItem(this.KEYS.READING_POS, JSON.stringify(all));
  },

  getFavorites() {
    try { return JSON.parse(localStorage.getItem(this.KEYS.FAVORITES)) || []; }
    catch (e) { return []; }
  },
  isFavorite(slug) { return this.getFavorites().includes(slug); },
  toggleFavorite(slug) {
    let favs = this.getFavorites();
    if (favs.includes(slug)) favs = favs.filter(s => s !== slug);
    else favs.push(slug);
    localStorage.setItem(this.KEYS.FAVORITES, JSON.stringify(favs));
    return favs.includes(slug);
  },

  getAllUserComments() {
    try { return JSON.parse(localStorage.getItem(this.KEYS.COMMENTS)) || {}; }
    catch (e) { return {}; }
  },
  getUserComments(slug) { return this.getAllUserComments()[slug] || []; },
  addUserComment(slug, comment) {
    const all = this.getAllUserComments();
    all[slug] = all[slug] || [];
    all[slug].unshift(comment);
    localStorage.setItem(this.KEYS.COMMENTS, JSON.stringify(all));
  }
};

// Áp dụng theme sáng/tối đã lưu cho toàn site (gọi ở mọi trang)
function applyStoredSiteTheme() {
  const theme = Store.getSiteTheme();
  document.documentElement.setAttribute('data-theme', theme);
}

/* =============================================================
   4. TEMPLATE COMPONENT: THẺ TRUYỆN, DÒNG BẢNG XẾP HẠNG, DÒNG CHƯƠNG
   ============================================================= */

function novelCardHTML(novel) {
  const badges = [];
  if (novel.status === 'full') badges.push('<span class="badge-ribbon badge-ribbon-full">FULL</span>');

  return `
    <a class="novel-card" href="${PAGE_PATH.detail}?slug=${novel.slug}">
      <div class="novel-cover cover-${novel.cover}">
        <img class="cover-img" src="${coverImgURL(novel, 300, 400)}" alt="${novel.title}" loading="lazy">
        <div class="card-badges">${badges.join('')}</div>
        <div class="novel-title-overlay"><h3 class="novel-title">${novel.title}</h3></div>
      </div>
    </a>`;
}

/* =============================================================
   5. HEADER DÙNG CHUNG: TÌM KIẾM, DROPDOWN THỂ LOẠI, MENU MOBILE, DARK MODE
   ============================================================= */

function initHeader() {
  // --- Toggle menu mobile ---
  const menuToggle = document.querySelector('.menu-toggle');
  const mainNav = document.querySelector('.main-nav');
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      mainNav.classList.toggle('is-open');
      menuToggle.classList.toggle('is-active');
    });
  }

  // --- Các dropdown trên thanh điều hướng: Danh sách / Phân loại theo chương / Tùy chỉnh / Tài khoản ---
  const dropdownToggles = document.querySelectorAll('.nav-dropdown-toggle');
  dropdownToggles.forEach(toggle => {
    const menu = toggle.nextElementSibling;
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = menu.classList.contains('is-open');
      dropdownToggles.forEach(t => t.nextElementSibling.classList.remove('is-open'));
      menu.classList.toggle('is-open', !wasOpen);
    });
  });
  document.addEventListener('click', () => {
    dropdownToggles.forEach(t => t.nextElementSibling.classList.remove('is-open'));
  });

  // --- Toggle Dark mode toàn site (mục trong dropdown "Tùy chỉnh") ---
  const themeToggle = document.querySelector('.theme-toggle-item');
  function refreshThemeToggleLabel() {
    if (!themeToggle) return;
    const isDark = Store.getSiteTheme() === 'dark';
    themeToggle.querySelector('.theme-toggle-icon').textContent = isDark ? '☀️' : '🌙';
    themeToggle.querySelector('.theme-toggle-label').textContent = isDark ? 'Chế độ sáng' : 'Chế độ tối';
  }
  if (themeToggle) {
    refreshThemeToggleLabel();
    themeToggle.addEventListener('click', () => {
      const next = Store.getSiteTheme() === 'dark' ? 'light' : 'dark';
      Store.setSiteTheme(next);
      applyStoredSiteTheme();
      refreshThemeToggleLabel();
    });
  }

  // --- Ô tìm kiếm: gợi ý trực tiếp theo tên truyện ---
  const searchInput = document.querySelector('.search-input');
  const searchResults = document.querySelector('.search-results');
  if (searchInput && searchResults) {
    searchInput.addEventListener('input', () => {
      const keyword = searchInput.value.trim().toLowerCase();
      if (!keyword) { searchResults.innerHTML = ''; searchResults.classList.remove('is-open'); return; }
      const matches = NOVELS.filter(n => n.title.toLowerCase().includes(keyword)).slice(0, 6);
      if (matches.length === 0) {
        searchResults.innerHTML = '<div class="search-empty">Không tìm thấy truyện phù hợp</div>';
      } else {
        searchResults.innerHTML = matches.map(n => `
          <a class="search-result-item" href="${PAGE_PATH.detail}?slug=${n.slug}">
            <div class="search-cover cover-${n.cover}"><img class="cover-img" src="${coverImgURL(n, 60, 80)}" alt="${n.title}" loading="lazy"></div>
            <div>
              <div class="search-title">${n.title}</div>
              <div class="search-author">${n.author}</div>
            </div>
          </a>`).join('');
      }
      searchResults.classList.add('is-open');
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-box')) searchResults.classList.remove('is-open');
    });
    searchInput.closest('form')?.addEventListener('submit', (e) => e.preventDefault());
  }
}

// Cập nhật thanh breadcrumb dưới header. parts: mảng {label, href?} — phần tử không có
// href được coi là trang hiện tại. Mục "🏠 Trang chủ" đã có sẵn trong HTML, hàm này chỉ
// nối thêm các mục phía sau.
function setBreadcrumb(parts) {
  const el = document.querySelector('.breadcrumb-extra');
  if (!el) return;
  el.innerHTML = parts.map(p => p.href
    ? `<span class="crumb-sep">/</span><a href="${p.href}">${p.label}</a>`
    : `<span class="crumb-sep">/</span><span class="breadcrumb-current">${p.label}</span>`
  ).join('');
}

/* =============================================================
   6. TRANG CHỦ (index.html)
   ============================================================= */

function initHomePage() {
  const hotList = [...NOVELS].filter(n => n.hot).sort((a, b) => b.views - a.views);
  const latestList = [...NOVELS].sort((a, b) => a.updatedMinutesAgo - b.updatedMinutesAgo).slice(0, 8);
  const modernList = NOVELS.filter(n => n.genres.includes('hien-dai'));
  const ancientList = NOVELS.filter(n => n.genres.includes('co-trang'));
  const otherList = NOVELS.filter(n => !n.genres.includes('hien-dai') && !n.genres.includes('co-trang'));

  const completedList = [...NOVELS].filter(n => n.status === 'full').sort((a, b) => b.views - a.views).slice(0, 12);

  fillGrid('#grid-hot', hotList);
  fillGrid('#grid-latest', latestList);
  fillGrid('#grid-modern', modernList);
  fillGrid('#grid-ancient', ancientList);
  fillGrid('#grid-other', otherList);
  fillGrid('#grid-completed', completedList, completedNovelCardHTML);

  initHomeBottomSection();
  initSectionFilterDropdown();
}

// Dropdown lọc thể loại đặt bên phải tiêu đề mỗi khung truyện trên trang chủ
function initSectionFilterDropdown() {
  const menus = document.querySelectorAll('.section-filter-menu');
  document.querySelectorAll('.section-filter').forEach(filter => {
    const toggle = filter.querySelector('.section-filter-toggle');
    const menu = filter.querySelector('.section-filter-menu');
    if (!toggle || !menu) return;
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = menu.classList.contains('is-open');
      menus.forEach(m => m.classList.remove('is-open'));
      menu.classList.toggle('is-open', !wasOpen);
    });
  });
  document.addEventListener('click', () => menus.forEach(m => m.classList.remove('is-open')));
}

function fillGrid(selector, list, renderFn) {
  const el = document.querySelector(selector);
  if (!el) return;
  renderFn = renderFn || novelCardHTML;
  el.innerHTML = list.map(n => renderFn(n)).join('');
}

// Thẻ truyện dùng riêng cho khung "Truyện Đã Hoàn Thành": có thêm nhãn số chương
function completedNovelCardHTML(novel) {
  return `
    <a class="novel-card novel-card-completed" href="${PAGE_PATH.detail}?slug=${novel.slug}">
      <div class="novel-cover cover-${novel.cover}">
        <img class="cover-img" src="${coverImgURL(novel, 300, 400)}" alt="${novel.title}" loading="lazy">
      </div>
      <div class="novel-info">
        <h3 class="novel-title novel-title-oneline">${novel.title}</h3>
        <span class="chip-full">Full · ${novel.chapterCount} chương</span>
      </div>
    </a>`;
}

// Dòng truyện dạng danh sách dùng ở trang phân loại (thumbnail + tiêu đề + tác giả + số chương)
function categoryRowHTML(novel) {
  let badge = '';
  if (novel.updatedMinutesAgo < 60) badge = '<span class="row-badge row-badge-new">New</span>';
  else if (novel.hot) badge = '<span class="row-badge row-badge-hot">Hot</span>';

  return `
    <li class="category-row">
      <a class="category-row-link" href="${PAGE_PATH.detail}?slug=${novel.slug}">
        <div class="category-row-thumb">
          <img class="cover-img" src="${coverImgURL(novel, 120, 90)}" alt="${novel.title}" loading="lazy">
        </div>
        <div class="category-row-info">
          <div class="category-row-title-line">
            <span class="category-row-title">${novel.title}</span>
            ${badge}
          </div>
          <div class="category-row-author"><span class="pencil-icon">✎</span> ${novel.author}</div>
        </div>
        <div class="category-row-chapter">Chương ${novel.chapterCount}</div>
      </a>
    </li>`;
}

// Khung dưới cùng trang chủ: Top truyện nhiều lượt xem trong tuần + Thể loại truyện
function initHomeBottomSection() {
  const weekTableBody = document.querySelector('.top-week-table tbody');
  if (weekTableBody) {
    const weekList = [...NOVELS].sort((a, b) => b.weekViews - a.weekViews).slice(0, 10);
    weekTableBody.innerHTML = weekList.map(n => `
      <tr>
        <td class="top-week-title"><a href="${PAGE_PATH.detail}?slug=${n.slug}"><span class="top-week-arrow">&rsaquo;</span>${n.title}</a></td>
        <td class="top-week-genres">${n.genres.map(g => GENRE_LABELS[g]).concat(n.tags).join(', ')}</td>
      </tr>`).join('');
  }

  fillGenreTagGrid();
}

// Đổ danh sách thể loại/tag vào khung ".genre-tag-grid" (dùng ở trang chủ và trang phân loại)
function fillGenreTagGrid() {
  const genreTagGrid = document.querySelector('.genre-tag-grid');
  if (!genreTagGrid) return;
  const allTags = new Set();
  NOVELS.forEach(n => n.tags.forEach(t => allTags.add(t)));
  const sortedTags = [...allTags].sort((a, b) => a.localeCompare(b, 'vi'));
  genreTagGrid.innerHTML = sortedTags.map(t => `<span>${t}</span>`).join('');
}

/* =============================================================
   7. TRANG CHI TIẾT TRUYỆN (truyen-chi-tiet.html)
   ============================================================= */

function initDetailPage() {
  const slug = getQueryParam('slug') || NOVELS[0].slug;
  const novel = getNovelBySlug(slug);
  if (!novel) return;

  document.title = `${novel.title} - Trăng Sao Truyện`;

  setBreadcrumb([
    { label: GENRE_LABELS[novel.genres[0]], href: `${PAGE_PATH.category}?the-loai=${novel.genres[0]}` },
    { label: novel.title }
  ]);

  document.querySelector('.detail-cover').classList.add(`cover-${novel.cover}`);
  const detailCoverImg = document.querySelector('.detail-cover .cover-img');
  detailCoverImg.src = coverImgURL(novel, 440, 587);
  detailCoverImg.alt = novel.title;
  document.querySelector('.detail-title').textContent = novel.title;
  document.querySelector('.detail-rating-stars').textContent = renderStars(novel.rating);
  document.querySelector('.detail-rating-text').textContent = `Đánh giá: ${novel.rating.toFixed(1)}/5 từ ${formatViews(novel.nominations)} lượt`;
  document.querySelector('.detail-views').textContent = formatViews(novel.views);
  document.querySelector('.detail-author').textContent = novel.author;
  document.querySelector('.detail-genres').textContent = novel.genres.map(g => GENRE_LABELS[g]).concat(novel.tags).join(', ');
  document.querySelector('.detail-status').textContent = novel.status === 'full' ? 'Hoàn thành' : 'Đang ra';

  const descEl = document.querySelector('.detail-description');
  descEl.textContent = novel.description;
  const descToggle = document.querySelector('.detail-desc-toggle');
  descToggle.addEventListener('click', () => {
    const expanded = descEl.classList.toggle('is-expanded');
    descToggle.textContent = expanded ? 'Thu gọn «' : 'Xem thêm »';
  });

  const chapters = getChapters(novel);

  const favBtn = document.querySelector('.btn-favorite');
  function refreshFavBtn() {
    const active = Store.isFavorite(novel.slug);
    favBtn.classList.toggle('is-active', active);
    favBtn.textContent = active ? '♥ Đã yêu thích' : '♡ Yêu thích truyện';
  }
  refreshFavBtn();
  favBtn.addEventListener('click', () => { Store.toggleFavorite(novel.slug); refreshFavBtn(); });

  initChapterPagination(novel, chapters);
  initDetailSidebarPanels(novel);
  initCommentSection(novel);
}

// Danh sách chương phân trang (15 chương/trang) thay vì cuộn dài
function initChapterPagination(novel, chapters) {
  const PAGE_SIZE = 15;
  const listEl = document.querySelector('.chapter-bullet-list');
  const paginationEl = document.querySelector('.chapter-pagination');
  const totalPages = Math.max(1, Math.ceil(chapters.length / PAGE_SIZE));
  let currentPage = 1;

  function renderPage(page) {
    currentPage = Math.min(Math.max(page, 1), totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageChapters = chapters.slice(start, start + PAGE_SIZE);
    listEl.innerHTML = pageChapters.length
      ? pageChapters.map(c => chapterBulletHTML(novel, c)).join('')
      : '<li class="chapter-empty">Chưa có chương nào</li>';
    renderPaginationBar();
  }

  function renderPaginationBar() {
    if (totalPages <= 1) { paginationEl.innerHTML = ''; return; }

    const delta = 2;
    const pages = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= currentPage - delta && p <= currentPage + delta)) {
        pages.push(p);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }

    const pageBtns = pages.map(p => p === '...'
      ? '<span class="chapter-page-ellipsis">…</span>'
      : `<button type="button" class="chapter-page-btn${p === currentPage ? ' is-active' : ''}" data-page="${p}">${p}</button>`
    ).join('');

    paginationEl.innerHTML = `
      <button type="button" class="chapter-page-btn${currentPage === 1 ? ' is-disabled' : ''}" data-page="${currentPage - 1}">‹</button>
      ${pageBtns}
      <button type="button" class="chapter-page-btn${currentPage === totalPages ? ' is-disabled' : ''}" data-page="${currentPage + 1}">›</button>`;

    paginationEl.querySelectorAll('.chapter-page-btn').forEach(btn => {
      btn.addEventListener('click', () => renderPage(parseInt(btn.dataset.page, 10)));
    });
  }

  renderPage(1);
}

// Dòng chương dạng bullet đơn giản (dùng ở trang chi tiết)
function chapterBulletHTML(novel, chapter) {
  return `<li><a href="${PAGE_PATH.reader}?slug=${novel.slug}&chuong=${chapter.num}">${chapter.title}</a></li>`;
}

// Sidebar trang chi tiết: "Truyện cùng tác giả" + "Truyện đang hot" (tab ngày/tháng/all time)
function initDetailSidebarPanels(novel) {
  const sideLinkList = document.querySelector('.side-link-list');
  if (sideLinkList) {
    // Ưu tiên truyện cùng tác giả; nếu không đủ, lấy thêm truyện khác cho đủ demo
    const sameAuthor = NOVELS.filter(n => n.author === novel.author && n.slug !== novel.slug);
    const others = NOVELS.filter(n => n.slug !== novel.slug && n.author !== novel.author);
    const list = sameAuthor.concat(others).slice(0, 8);
    sideLinkList.innerHTML = list.map(n => `<li><a href="${PAGE_PATH.detail}?slug=${n.slug}">${n.title}</a></li>`).join('');
  }

  const hotTabs = document.querySelectorAll('.hot-tab');
  const hotRankList = document.querySelector('.hot-rank-list');
  if (hotTabs.length && hotRankList) {
    const metricMap = { day: 'dayViews', month: 'monthViews', alltime: 'views' };

    function renderHotRank(period) {
      const sorted = [...NOVELS].sort((a, b) => b[metricMap[period]] - a[metricMap[period]]).slice(0, 8);
      hotRankList.innerHTML = sorted.map((n, i) => hotRankRowHTML(n, i + 1)).join('');
    }

    hotTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        hotTabs.forEach(t => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        renderHotRank(tab.dataset.period);
      });
    });

    renderHotRank('day');
  }
}

function hotRankRowHTML(novel, rank) {
  return `
    <li class="hot-rank-row">
      <span class="hot-rank-num rank-${rank <= 3 ? rank : 'other'}">${rank}</span>
      <a class="hot-rank-title" href="${PAGE_PATH.detail}?slug=${novel.slug}">${novel.title}</a>
    </li>`;
}

// Khối bình luận truyện: chọn sao, đếm ký tự, gửi bình luận (lưu localStorage), làm mới danh sách
function initCommentSection(novel) {
  const starBtns = document.querySelectorAll('.comment-star-picker .star-btn');
  const textarea = document.querySelector('.comment-textarea');
  const charCount = document.querySelector('.comment-char-count');
  const submitBtn = document.querySelector('.comment-submit-btn');
  const refreshBtn = document.querySelector('.comment-refresh-btn');
  const listEl = document.querySelector('.comment-list');
  const summaryEl = document.querySelector('.comment-summary');
  if (!listEl) return;

  let selectedRating = 5;

  function refreshStars() {
    starBtns.forEach(btn => btn.classList.toggle('is-active', parseInt(btn.dataset.value, 10) <= selectedRating));
  }
  refreshStars();
  starBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRating = parseInt(btn.dataset.value, 10);
      refreshStars();
    });
  });

  if (textarea && charCount) {
    textarea.addEventListener('input', () => {
      charCount.textContent = `${textarea.value.length}/500`;
    });
  }

  function renderComments() {
    const all = Store.getUserComments(novel.slug).concat(getDemoComments(novel));

    listEl.innerHTML = all.length
      ? all.map(c => `
        <li class="comment-item">
          <div class="comment-item-head">
            <div>
              <div class="comment-author">${c.author}</div>
              <div class="comment-date">${formatCommentDate(c.date)}</div>
            </div>
            <div class="comment-stars">${renderStars(c.rating)}</div>
          </div>
          <p class="comment-text">${c.text}</p>
          <a href="#" class="comment-reply-link" onclick="return false;">💬 Phản hồi ${c.author}</a>
        </li>`).join('')
      : '<li class="comment-empty">Chưa có bình luận nào. Hãy là người đầu tiên!</li>';

    const avgRating = all.length ? (all.reduce((sum, c) => sum + c.rating, 0) / all.length).toFixed(1) : '0';
    if (summaryEl) summaryEl.textContent = `${all.length} bình luận · Điểm trung bình ${avgRating}/5 sao`;
  }

  if (submitBtn && textarea) {
    submitBtn.addEventListener('click', () => {
      const text = textarea.value.trim();
      if (!text) { textarea.focus(); return; }
      Store.addUserComment(novel.slug, {
        author: 'Bạn',
        rating: selectedRating,
        text,
        date: new Date().toISOString()
      });
      textarea.value = '';
      charCount.textContent = '0/500';
      selectedRating = 5;
      refreshStars();
      renderComments();
    });
  }

  if (refreshBtn) refreshBtn.addEventListener('click', renderComments);

  renderComments();
}

/* =============================================================
   8. TRANG ĐỌC TRUYỆN (doc-truyen.html)
   ============================================================= */

function initReaderPage() {
  const slug = getQueryParam('slug') || NOVELS[0].slug;
  const novel = getNovelBySlug(slug);
  if (!novel) return;

  const chapters = getChapters(novel);
  let chapterNum = parseInt(getQueryParam('chuong') || '1', 10);
  if (chapterNum < 1) chapterNum = 1;
  if (chapterNum > chapters.length) chapterNum = chapters.length;

  // Đổ danh sách chương vào cả 2 dropdown (đầu trang + cuối trang), sắp xếp tăng dần Chương 1 → cuối
  const chapterListHTML = [...chapters].sort((a, b) => a.num - b.num).map(c => `
    <button type="button" class="chapter-list-item${c.num === chapterNum ? ' is-active' : ''}" data-chuong="${c.num}">${c.title}</button>`).join('');
  document.querySelectorAll('.chapter-list-dropdown').forEach(dropdown => {
    dropdown.innerHTML = chapterListHTML;
  });
  document.querySelectorAll('.chapter-list-item').forEach(item => {
    item.addEventListener('click', () => {
      window.location.href = `${PAGE_PATH.reader}?slug=${novel.slug}&chuong=${item.dataset.chuong}`;
    });
  });

  // Toggle mở/đóng dropdown danh sách chương (đóng dropdown còn lại khi mở 1 cái)
  const dropdowns = document.querySelectorAll('.chapter-list-dropdown');
  document.querySelectorAll('.chapter-nav').forEach(nav => {
    const toggle = nav.querySelector('.chapter-list-toggle');
    const dropdown = nav.querySelector('.chapter-list-dropdown');
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = dropdown.classList.contains('is-open');
      dropdowns.forEach(d => d.classList.remove('is-open'));
      dropdown.classList.toggle('is-open', !wasOpen);
      if (!wasOpen) dropdown.querySelector('.chapter-list-item.is-active')?.scrollIntoView({ block: 'center' });
    });
  });
  document.addEventListener('click', () => dropdowns.forEach(d => d.classList.remove('is-open')));

  renderChapter(novel, chapters, chapterNum);
  initReaderSettings(novel);

  document.querySelectorAll('.btn-prev-chapter, .btn-next-chapter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (btn.classList.contains('is-disabled')) e.preventDefault();
    });
  });

  // Điều hướng chương bằng bàn phím: ← / → hoặc A / D
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      document.querySelector('.btn-prev-chapter:not(.is-disabled)')?.click();
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      document.querySelector('.btn-next-chapter:not(.is-disabled)')?.click();
    }
  });
}

function renderChapter(novel, chapters, chapterNum) {
  const chapter = chapters.find(c => c.num === chapterNum);
  document.title = `${chapter.title} - ${novel.title} - Trăng Sao Truyện`;

  document.querySelector('.reader-novel-title').textContent = novel.title;
  document.querySelector('.reader-novel-title').href = `${PAGE_PATH.detail}?slug=${novel.slug}`;
  document.querySelector('.btn-comment-jump').href = `${PAGE_PATH.detail}?slug=${novel.slug}#comment-section`;
  document.querySelector('.reader-chapter-title').textContent = chapter.title;

  setBreadcrumb([
    { label: novel.title, href: `${PAGE_PATH.detail}?slug=${novel.slug}` },
    { label: chapter.title }
  ]);

  const paragraphs = getChapterContent(novel, chapterNum);
  document.querySelector('.reader-content').innerHTML = paragraphs.map(p => `<p>${p}</p>`).join('');

  const hasPrev = chapterNum > 1;
  const hasNext = chapterNum < chapters.length;
  document.querySelectorAll('.btn-prev-chapter').forEach(btn => {
    btn.href = hasPrev ? `${PAGE_PATH.reader}?slug=${novel.slug}&chuong=${chapterNum - 1}` : '#';
    btn.classList.toggle('is-disabled', !hasPrev);
  });
  document.querySelectorAll('.btn-next-chapter').forEach(btn => {
    btn.href = hasNext ? `${PAGE_PATH.reader}?slug=${novel.slug}&chuong=${chapterNum + 1}` : '#';
    btn.classList.toggle('is-disabled', !hasNext);
  });

  // Lưu lại vị trí đọc hiện tại vào localStorage
  Store.setReadingPos(novel.slug, chapterNum);

  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function initReaderSettings(novel) {
  const contentEl = document.querySelector('.reader-content');
  const settingsToggle = document.querySelector('.settings-toggle');
  const settingsPanel = document.querySelector('.settings-panel');
  const fontSizeLabel = document.querySelector('.font-size-label');
  const bgButtons = document.querySelectorAll('.bg-option');

  function applyFontSize(size) {
    contentEl.style.fontSize = size + 'px';
    if (fontSizeLabel) fontSizeLabel.textContent = size + 'px';
  }

  function applyReaderBg(bg) {
    contentEl.closest('.reader-page').setAttribute('data-reader-bg', bg);
    bgButtons.forEach(b => b.classList.toggle('is-active', b.dataset.bg === bg));
  }

  applyFontSize(Store.getFontSize());
  applyReaderBg(Store.getReaderBg());

  if (settingsToggle && settingsPanel) {
    settingsToggle.addEventListener('click', () => settingsPanel.classList.toggle('is-open'));
  }

  document.querySelector('.font-decrease')?.addEventListener('click', () => {
    const size = Math.max(14, Store.getFontSize() - 2);
    Store.setFontSize(size);
    applyFontSize(size);
  });
  document.querySelector('.font-increase')?.addEventListener('click', () => {
    const size = Math.min(32, Store.getFontSize() + 2);
    Store.setFontSize(size);
    applyFontSize(size);
  });

  bgButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      Store.setReaderBg(btn.dataset.bg);
      applyReaderBg(btn.dataset.bg);
    });
  });
}

/* =============================================================
   9. TRANG PHÂN LOẠI (phan-loai.html)
   ============================================================= */

function initCategoryPage() {
  const list_ = document.querySelector('.category-list');
  const titleEl = document.querySelector('.category-header h1');

  const genreFilter = getQueryParam('the-loai') || 'all';
  const chapterFilter = getQueryParam('so-chuong') || 'all';
  const sortMode = getQueryParam('sort') || 'hot';

  fillGenreTagGrid();

  let list = [...NOVELS];

  if (genreFilter !== 'all') list = list.filter(n => n.genres.includes(genreFilter));

  if (chapterFilter === 'under20') list = list.filter(n => n.chapterCount < 20);
  else if (chapterFilter === '20to50') list = list.filter(n => n.chapterCount >= 20 && n.chapterCount <= 50);
  else if (chapterFilter === 'over100') list = list.filter(n => n.chapterCount > 100);

  if (sortMode === 'hot') list.sort((a, b) => b.views - a.views);
  else if (sortMode === 'new') list.sort((a, b) => a.updatedMinutesAgo - b.updatedMinutesAgo);
  else if (sortMode === 'full') list = list.filter(n => n.status === 'full');

  list_.innerHTML = list.length
    ? list.map(n => categoryRowHTML(n)).join('')
    : '<li class="empty-state">Không có truyện phù hợp.</li>';
  titleEl.textContent = genreFilter === 'all' ? 'Tất Cả Truyện' : GENRE_LABELS[genreFilter];

  setBreadcrumb(genreFilter === 'all'
    ? [{ label: 'Phân loại' }]
    : [{ label: 'Phân loại', href: PAGE_PATH.category }, { label: GENRE_LABELS[genreFilter] }]);
}

/* =============================================================
   10. TRANG ĐĂNG NHẬP / ĐĂNG KÝ (login.html, signup.html)
   ============================================================= */

function initAuthPage() {
  const forms = document.querySelectorAll('.auth-form');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const feedback = form.querySelector('.form-feedback');
      const inputs = form.querySelectorAll('input[required]');
      let valid = true;
      inputs.forEach(input => {
        if (!input.value.trim()) valid = false;
      });
      const passwordInputs = form.querySelectorAll('input[type="password"]');
      if (passwordInputs.length === 2 && passwordInputs[0].value !== passwordInputs[1].value) {
        valid = false;
        feedback.textContent = 'Mật khẩu nhập lại không khớp.';
        feedback.classList.add('is-error');
        return;
      }
      if (!valid) {
        feedback.textContent = 'Vui lòng điền đầy đủ thông tin bắt buộc.';
        feedback.classList.add('is-error');
        return;
      }
      feedback.classList.remove('is-error');
      feedback.classList.add('is-success');
      feedback.textContent = 'Thành công! (đây là bản demo, chưa kết nối máy chủ thật)';
    });
  });

  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.classList.toggle('is-visible');
    });
  });
}

/* =============================================================
   11. KHỞI CHẠY THEO TỪNG TRANG
   ============================================================= */

document.addEventListener('DOMContentLoaded', () => {
  applyStoredSiteTheme();
  initHeader();

  const page = document.body.dataset.page;
  switch (page) {
    case 'home': initHomePage(); break;
    case 'detail': initDetailPage(); break;
    case 'reader': initReaderPage(); break;
    case 'category': initCategoryPage(); break;
    case 'auth': initAuthPage(); break;
  }
});
