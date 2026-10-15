# Cami

App chỉnh ảnh cho bé, chạy trên **web, Android và iOS** từ một codebase.
Stack: Expo SDK 54, expo-router và React Native Skia (giống `yocheckin/saas-mobile`).

## Giao diện

Phong cách sáng sang trọng (nền kem, thẻ trắng có bóng mờ, điểm nhấn vàng đồng, tiêu đề Playfair Display, chữ Be Vietnam Pro) với 5 tab: **Trang chủ** (banner, công cụ AI, presets, dự án gần đây), **AI**, **Chỉnh sửa** (chọn ảnh), **Presets** và **Hồ sơ**.
Ảnh trên banner, presets và ảnh mẫu lấy từ Unsplash (giấy phép Unsplash, dùng miễn phí). Danh sách ảnh nằm trong `src/photos.ts`, đổi id là đổi ảnh. Muốn app chạy offline thì tải ảnh vào `assets/` và dùng `require()`.
Màu và font nằm trong `src/theme.ts`.

## Tính năng

| Công cụ | Nội dung |
|---|---|
| 🪄 Phép AI | Gõ yêu cầu bằng tiếng Việt, hoặc bấm nút có sẵn: hoạt hình 3D, tranh tô màu, màu nước, anime, đổi nền (biển, vũ trụ, lâu đài), tuyết rơi, cánh tiên, làm đẹp ảnh, nền trắng |
| 🎛️ Chỉnh sửa (thủ công) | Màn hình kiểu Lightroom, mở từ nút Chỉnh sửa giữa thanh tab: **Ánh sáng** (phơi sáng, tương phản, vùng sáng/tối, điểm trắng/đen), **Màu** (nhiệt độ, sắc độ, bão hòa, độ rực), **Đường cong** (RGB và từng kênh), **HSL** (8 dải màu), **Chi tiết** (độ nét, rõ ràng, giảm nhiễu, viền tối, hạt phim). Tất cả chạy trong một shader GPU (`src/develop/shader.tsx`), xem trước tức thì. Có dải preset, nút giữ để xem ảnh gốc, nhấn đúp thanh trượt để về 0 |
| 📤 Xuất ảnh | Mở từ nút Xuất/Lưu: chọn JPG hoặc PNG, chất lượng (Thường 80 / Cao 92 / Tối đa 100), độ phân giải (Web 1080 / 2K 2048 / Gốc 100%), hình mờ "Cami". Hiện kích thước và dung lượng thật trước khi xuất. Nơi lưu: thư viện ảnh, Instagram, TikTok, WhatsApp (lưu ảnh rồi mở app), hoặc menu chia sẻ của máy. Trên web: tải về và chia sẻ |
| 🎞️ Presets | 33 preset chia theo Chân dung / Latino / Nhiệt đới / Điện ảnh / Vintage / Aesthetic / Đen trắng, gồm 21 preset phong cách Mỹ Latinh (Havana, Tulum, Cancún, Río, Cartagena, Frida, Mariachi, Telenovela, Cine de Oro…). Có tìm kiếm (gõ không dấu cũng được), lưu yêu thích, thanh Cường độ. Mỗi preset là một bộ thông số Develop (`src/develop/presets.ts`), áp dụng xong vẫn chỉnh tiếp từng thanh được |
| 🖌️ Trình chỉnh ảnh | Nền tối, 5 tab: **Cơ bản** (cắt 1:1/4:5/3:4/9:16/16:9, xoay/lật, độ sáng, tương phản, độ nét, bão hòa), **Làm đẹp** (miễn phí trên máy: mịn da, sáng da, hồng hào, đều màu da, glow, nét chi tiết, cọ trắng răng, cọ sáng vùng mắt. Da được nhận diện theo màu trong shader. Mục "AI ✦" vẫn có retouch AI), **Bộ lọc** (12 preset xem trước bằng chính ảnh của bạn + cường độ), **AI**, **Điều chỉnh** (ánh sáng, màu, rõ ràng + mở Đường cong/HSL). Thanh dưới: Hiệu ứng, Văn bản, Sticker, Khung (viền trắng, Polaroid, viền đen, viền vàng, phim, mờ viền), Vẽ. Nút so sánh Trước/Sau có vạch kéo. Mọi chỉnh màu chạy bằng shader, xuất được 100% gốc |
| 🤖 Công cụ AI & Tạo ảnh | Tab AI có 6 thẻ minh họa (Xóa vật thể, Nâng cấp ảnh, Xóa nền, Ảnh thành tranh, Mở rộng ảnh, Tạo ảnh AI) vẽ bằng Skia từ ảnh mẫu (`src/aiIllustrations.tsx`). **Tạo ảnh AI** (`app/generate.tsx`): gõ mô tả, chọn phong cách (ảnh thật, hoạt hình 3D, anime, màu nước, sơn dầu) và khung hình, rồi chỉnh sửa hoặc lưu |
| 🌟 Công cụ nổi bật | Ở Trang chủ và tab AI, mở màn **Studio** (`app/studio.tsx`), mỗi lần bấm nút chính tốn 1 lượt AI: **Phục hồi ảnh cũ** (chụp tấm ảnh in trên bàn, tường, trong khung cũng được: máy chủ nhờ AI tìm 4 góc tấm ảnh rồi tự nắn phẳng và cắt ra trước khi khôi phục, `src/server/printCrop.ts`; chọn nhiều: xóa vết xước, khử nhiễu, làm nét, tô màu ảnh trắng đen, làm rõ khuôn mặt), **AI Hairstyle & Makeup** (kiểu tóc, màu tóc, trang điểm), **AI Product Studio** (đặt sản phẩm vào bối cảnh: studio trắng, đá cẩm thạch, hoa & lụa, sang trọng tối, bãi biển, gỗ, pastel; giữ nguyên nhãn và chữ trên sản phẩm), **Tạo logo** (tên thương hiệu, **mẫu gợi ý theo ngành** như tiệm nail, spa, tiệm bánh, cà phê… bấm một lần là chọn sẵn ý tưởng biểu tượng, phong cách, bố cục và màu; **bố cục**: biểu tượng trên/cạnh chữ, chỉ chữ, chữ lồng, huy hiệu, linh vật; màu chủ đạo; không cần ảnh). Kết quả có thanh so sánh Trước/Sau, rồi Chỉnh sửa hoặc Lưu ảnh. App chỉ gửi mã tùy chọn, máy chủ tự ghép câu lệnh (`src/ai/studio.ts`). Ảnh minh họa trước/sau trên thẻ nằm ở `assets/images/featured/` (`src/featuredImages.ts`) |
| 🧠 Chọn model AI | Nút "Model: …" ở tab AI, màn hình Retouch, mục Phép AI và tab Hồ sơ: Flash (~1.700đ/ảnh, mặc định) hoặc Pro (~3.500đ/ảnh, đẹp nhất). Sau mỗi lần AI chạy, app báo model đã dùng và chi phí ước tính (`src/ai/models.ts`) |
| 💫 Retouch AI | Màn hình riêng: làm đẹp gương mặt, làm mịn da, làm trắng răng, xóa thâm mắt, làm sáng (chọn nhiều cùng lúc, AI làm 1 lần). Kéo vạch so sánh Trước/Sau, thanh cường độ 0–100% trộn ngay trên máy nên không tốn thêm lượt AI. Bấm Áp dụng để chỉnh tiếp trong trình chỉnh ảnh |
| 🎨 Bộ lọc | 12 bộ lọc màu (có Cinematic, Soft Glow, Vintage), có ảnh xem trước |
| ⭐ Sticker | 16 sticker vẽ bằng SVG. Kéo để di chuyển, chụm 2 ngón để phóng to, xoay 2 ngón để xoay |
| 🔤 Chữ | Font Baloo 2 có dấu tiếng Việt, viền trắng, đổi được màu |
| 🖌️ Vẽ | Bút màu, bút phát sáng, bút cầu vồng, có 3 cỡ |
| ✂️ Chỉnh | Xoay, lật, cắt khung vuông/dọc/ngang, chỉnh sáng, đậm nhạt và màu sắc |
| 🧪 Công thức màu của tôi | Chỉnh màu xong, bấm **Lưu màu này** (trình chỉnh ảnh › Bộ lọc) hoặc nút dấu trang (màn Chỉnh sửa) để lưu toàn bộ ánh sáng, màu, đường cong, HSL, chi tiết, làm đẹp thành công thức riêng có tên và ảnh xem trước. Dùng lại ở Bộ lọc › **Của tôi** và Presets › **Của tôi**, có thanh Cường độ. Bấm ••• hoặc thùng rác để xóa. Lưu trên máy (`src/develop/customPresets.ts`) |
| 🕘 Lịch sử & bản nháp | Hoàn tác/làm lại ở cả trình chỉnh ảnh và màn Chỉnh sửa. Nút đồng hồ mở **Lịch sử chỉnh sửa**: từng bước có tên ("Bộ lọc: Mocha", "Phơi sáng +20", "Cắt 4:5", "AI: Xóa nền"…), bấm bước nào là quay lại bước đó. **Lưu bản nháp** giữ ảnh và mọi chỉnh sửa (lớp sticker/chữ/nét vẽ vẫn sửa được). Sau lần lưu đầu, bản nháp tự lưu mỗi khi chỉnh. Thoát khi chưa lưu thì app hỏi. Bản nháp hiện ở Trang chủ › **Tiếp tục chỉnh sửa** (tối đa 20). Ảnh nháp lưu thành file trên điện thoại, IndexedDB trên web (`src/drafts/`) |
| Khác | Lưu ảnh vào thư viện (web thì tải xuống), chia sẻ, giấy vẽ trống |

## Chạy thử

```bash
npm install
cp .env.example .env      # rồi điền GEMINI_API_KEY
npx expo start            # bấm w = web, a = Android, i = iOS
```

- AI dùng chung cách cấu hình với nails-studio: Vertex AI (`GOOGLE_CLOUD_PROJECT`, dùng credit Google Cloud) được thử trước, sau đó tới các key AI Studio (`GEMINI_API_KEY`, nhiều key cách nhau bằng dấu phẩy). Nguồn nào hết tiền hoặc lỗi quyền thì tự chuyển sang nguồn sau. Pro bị nghẽn thì tự lùi về Flash (không bao giờ tự chuyển sang model đắt hơn). Xem `.env.example` và `src/server/gemini.ts`.
- Lấy API key tại https://aistudio.google.com/apikey. Nên bật billing: dữ liệu gửi qua gói trả phí không bị dùng để huấn luyện.
- Skia là thư viện native nên **không chạy trong Expo Go**. Để chạy trên điện thoại cần build development client một lần (giống yocheckin):
  ```bash
  npx expo run:android      # hoặc: eas build --profile development -p android
  ```

## Kiến trúc

```
app/
  index.tsx              Màn hình chính (chụp ảnh, chọn ảnh, giấy vẽ)
  editor.tsx             Trình chỉnh ảnh
  api/ai-edit+api.ts     API server: giữ API key, lọc nội dung, gọi Gemini
src/editor/
  Scene.tsx              Vẽ toàn bộ ảnh bằng Skia (dùng chung cho màn hình và xuất file)
  EditorCanvas.tsx       Cử chỉ: kéo, chụm, xoay, vẽ
  imageOps.tsx           Gộp lớp, xoay, cắt, mã hóa JPEG
  filters.ts / stickers.ts / panels.tsx / useDocHistory.ts
src/ai/                  Preset AI, client và giới hạn lượt mỗi ngày
index.web.js             Nạp Skia (WebAssembly) trước khi mở app trên web
```

- **Xuất đúng 100% ảnh gốc:** khi chỉnh, app dùng bản làm việc tối đa 2048px cho mượt, nhưng giữ cả ảnh gốc (tối đa 8192px). Lúc xuất, bộ lọc, chỉnh màu, xoay/cắt, sticker, chữ, nét vẽ được áp lại lên ảnh gốc (`flattenFull` trong `src/editor/imageOps.tsx`). Sticker/chữ/nét vẽ là vector nên vẫn sắc nét. Kết quả từ AI có độ phân giải do AI trả về (~1–2K).
- Trên web, ảnh lớn được dựng trên một WebGL surface tạm rồi giải phóng ngay (`renderOnWebGpu`).
- Bộ lọc chỉ áp lên ảnh nền. Sticker và nét vẽ giữ nguyên màu.
- Khi dùng AI, xoay hoặc cắt, app gộp mọi lớp thành một ảnh rồi mới xử lý. Có thể bấm Hoàn tác để quay lại.

## An toàn cho bé

- API key nằm trên server, không đóng gói vào app.
- Server chặn một số từ khoá không phù hợp và gửi kèm chỉ dẫn an toàn cho AI. Gemini cũng có bộ lọc riêng.
- Lượt AI do máy chủ kiểm soát (xem mục **Tài khoản và điểm AI**), app không tự đếm.
- Đặt `APP_TOKEN` và `EXPO_PUBLIC_APP_TOKEN` để người lạ khó gọi API của bạn.
- Ảnh chỉ gửi lên mạng khi bé bấm Phép AI. Không có mạng xã hội.

## Tài khoản và điểm AI

- **Chưa có tài khoản:** 3 lượt AI miễn phí (mặc định) (model nào cũng tính 1 lượt). Hết lượt, app tự mở bảng **Đăng ký / Đăng nhập**.
- **Có tài khoản** (email + mật khẩu): 100 điểm mỗi tháng dương lịch (mặc định) (làm mới 0 giờ ngày 1 theo giờ Argentina/Brazil GMT-3, đổi bằng `CAMI_TIMEZONE`; không cộng dồn). Flash 1 điểm, Pro 2 điểm (mặc định). Đổi các con số này ở trang quản trị › **Cài đặt › Điểm AI** (áp dụng ngay, kể cả tháng đang chạy; mặc định nằm ở `DEFAULT_PLAN` trong `src/ai/credits.ts`). Điểm tháng của từng tháng được ghi lại (bảng `monthly_allowance`) nên đổi số sau này không làm sai số điểm thưởng đã dùng ở các tháng trước.
- Máy chủ giữ và trừ điểm (`src/server/account.ts`): trừ trước khi gọi AI, AI lỗi thì hoàn lại, Pro bận phải dùng Flash thì chỉ tính giá Flash. Khách được nhận diện bằng mã máy ngẫu nhiên + IP đã băm (tối đa 9 lượt thử/IP/30 ngày, để cài lại app không lấy lại lượt). Mỗi IP tạo tối đa 3 tài khoản/ngày; sai mật khẩu 8 lần thì khóa 15 phút.
- Dữ liệu nằm trong `data/cami.db` (SQLite có sẵn trong Node 22, không cần cài thêm; đã loại khỏi git). Mật khẩu băm scrypt, phiên đăng nhập 90 ngày chỉ lưu bản băm. Hồ sơ có **Đăng xuất** và **Xóa tài khoản** (App Store bắt buộc).
- **Điểm thưởng** (Hồ sơ › Nhận thêm điểm thưởng, `src/server/rewards.ts`): không hết hạn, dùng sau khi hết điểm tháng. **Mời bạn bè**: mỗi tài khoản có mã 6 ký tự và link `<EXPO_PUBLIC_SHARE_URL>/?ref=MÃ` (mở link là app tự hiện bảng đăng ký có sẵn mã); bạn bè đăng ký bằng mã thì người mời +20, bạn bè +10 (mặc định), tối đa 10 lượt thưởng/tháng, không thưởng khi hai tài khoản cùng mạng (chống tự mời). **Chia sẻ Cami** lên Facebook: Facebook không cho app biết bài có thật sự được đăng, nên điểm tính theo kết quả. Link đăng lên Facebook có thêm `&s=fb`; khi có **người khác** mở link (khác mạng và thiết bị chủ link từng đăng ký, đăng nhập hay dùng AI, và không đăng nhập bằng tài khoản chủ link), chủ link nhận +5 điểm (mặc định), mỗi tháng một lần. Các con số này đổi ở trang quản trị › **Cài đặt › Điểm thưởng** (0 = tắt; chia sẻ = 0 thì app ẩn mục chia sẻ); chỉ áp dụng cho lượt thưởng từ lúc lưu. Mỗi người xem chỉ tính một lần mỗi tháng (bảng `visits`).
- Chưa có: xác minh email, quên mật khẩu tự động, bán thêm điểm.

## Trang quản trị

- Mở `/admin` (web: `<địa chỉ>/admin`; trong app: **Hồ sơ › Quản trị**). Chỉ tài khoản có email trong `ADMIN_EMAILS` (file `.env` của server, cách nhau bằng dấu phẩy) mới xem được; server kiểm tra quyền ở mọi yêu cầu. Thêm email rồi khởi động lại server.
- **Tổng quan** (7/30/90 ngày): tài khoản mới, thiết bị hoạt động, số ảnh AI, chi phí AI ước tính (theo giá trong `src/ai/models.ts`), tỉ lệ lỗi, số lần khách hết lượt/hết điểm, biểu đồ theo ngày, từng chức năng AI (Flash/Pro, khách/tài khoản, lỗi, thời gian xử lý), chức năng không dùng AI (lưu ảnh, preset, canvas, mời bạn…), lỗi AI, điểm thưởng, khách dùng nhiều nhất.
- **Truy cập** (hôm nay / hôm qua / tuần này / tháng này / tùy chỉnh từ ngày… đến ngày…, tối đa 366 ngày; so với cùng khoảng thời gian kỳ trước): **đang online** (tự làm mới mỗi 20 giây: ai, nền tảng, đang ở màn hình nào), người dùng (tài khoản/khách), lượt truy cập (nghỉ quá 5 phút là lượt mới), online cùng lúc cao nhất, thời gian dùng, người dùng mới, biểu đồ theo giờ/ngày, khung giờ đông người, nền tảng, màn hình dùng nhiều, tài khoản dùng lâu nhất. App gửi tín hiệu `/api/presence` mỗi 45 giây khi đang mở (chỉ gửi nền tảng và tên màn hình; ẩn app thì ngừng). Giờ theo `CAMI_TIMEZONE`. Mã ở `src/server/presence.ts`, `src/presence.tsx`, `src/admin/TrafficTab.tsx`.
- **SEO**: tiêu đề, mô tả, từ khoá cho từng ngôn ngữ (mặc định viết sẵn, ngôn ngữ chính tiếng Tây Ban Nha), mã xác minh Google Search Console, xem trước kết quả Google và khi chia sẻ link. `server.cjs` chèn các thẻ này (cùng Open Graph, `og-image.png`, canonical, `noindex` cho trang quản trị/trang cần ảnh) vào mỗi trang và phục vụ `robots.txt`, `sitemap.xml`; Google/Facebook nhận ngôn ngữ chính, người mở web nhận theo ngôn ngữ trình duyệt. Chỉ có trên máy chủ thật, không có khi chạy `expo start`. **GEO** (được AI như ChatGPT, Gemini, Perplexity, Claude trích dẫn): giới thiệu CamIA cho AI và câu hỏi thường gặp theo từng ngôn ngữ, link mạng xã hội chính thức, công tắc cho phép AI huấn luyện; máy chủ gửi kèm bản chữ của trang chủ/blog/bài viết trong `<noscript>` cho bot không chạy JavaScript, dữ liệu cấu trúc Organization/WebSite/WebApplication/FAQPage (FAQ của bài lấy từ mục "## FAQ"), `/llms.txt`, `robots.txt` ghi rõ bot AI tìm kiếm và bot huấn luyện, ảnh bìa trong sitemap. Bảng **Điểm SEO & GEO** gợi ý việc cần làm thêm.
- **Blog**: AI viết bài chuẩn SEO (chọn ngôn ngữ, gợi ý chủ đề theo 11 nhóm từ khoá trong `src/blog/clusters.ts` — trộn nhiều nhóm hoặc một nhóm, 5/10/15 gợi ý, mỗi gợi ý có nhóm, độ khó lên top, ưu tiên, lý do, cảnh báo gần giống bài đã có; gợi ý được nhớ trong bảng `blog_topics` với trạng thái đã gợi ý/đã viết/bỏ qua nên lần sau AI không lặp lại; bảng độ phủ chủ đề cho thấy nhóm nào còn trống, từ khoá, độ dài, giọng văn, số ảnh, model Flash/Pro, yêu cầu thêm, đăng ngay hoặc để nháp); ảnh do AI vẽ và gắn logo Camia.app trên trình duyệt của admin; danh sách bài (đăng/ẩn/xoá) và trình soạn Markdown có xem trước, chèn ảnh, ảnh bìa. Bài lưu ở bảng `blog_posts`, ảnh ở `data/blog/` (nhớ sao lưu cùng `cami.db`). Website có `/blog`, `/blog/<slug>` và mục Blog ở trang chủ; `server.cjs` thêm tiêu đề/mô tả/ảnh của từng bài, `BlogPosting`, `sitemap.xml` và `/blog/rss.xml`. Chi phí AI của blog tính vào tab Tổng quan. Mã: `src/server/blog.ts`, `src/server/blogAi.ts`, `src/admin/BlogTab.tsx`, `app/blog/`.
- **Khách hàng**: tìm theo email/tên/mã mời, xem điểm còn lại, lịch sử AI, điểm thưởng, bạn đã mời, ngày hoạt động; **tặng điểm thưởng** (1–1000, có ghi lý do) và **khóa/mở khóa** tài khoản (khóa là đăng xuất mọi máy). Mọi thao tác được ghi vào nhật ký quản trị.
- **Cài đặt**: **Điểm AI** (điểm mỗi tháng, lượt miễn phí cho khách, điểm mỗi ảnh Flash/Pro), **Điểm thưởng** (mời bạn, được mời, tối đa lượt/tháng, chia sẻ Facebook) và **nguồn AI** (thêm tài khoản Google Cloud bằng file khoá service account hoặc API key AI Studio, sắp thứ tự, tạm tắt, nhập credit để app tự chuyển sang nguồn khác khi gần hết, kiểm tra kết nối miễn phí). Khoá được mã hoá bằng `CAMI_SECRET` trước khi lưu: đừng đổi `CAMI_SECRET` sau khi đã lưu khoá. Chưa lưu gì thì app dùng nguồn trong `.env`.
- **Hệ thống**: kiểm tra cấu hình `.env` (không hiện khóa bí mật), quy tắc điểm/thưởng, thông tin máy chủ, dung lượng và số dòng của cơ sở dữ liệu.
- Số liệu lấy từ `data/cami.db`: bảng `ai_log` (mỗi yêu cầu AI), `actives` (thiết bị mở app mỗi ngày), `events` (bộ đếm chức năng theo ngày, chỉ tên chức năng, không có ảnh hay thông tin cá nhân; app gửi qua `/api/track`), `admin_log`. Mã nằm ở `src/server/admin.ts`, `src/server/stats.ts`, giao diện ở `app/admin/` và `src/admin/`. Trang quản trị chỉ có tiếng Việt.
- Số liệu chức năng không dùng AI chỉ có từ bản app này trở đi; ảnh AI từ trước được tính vào mục "Không rõ".

## Video AI

- Trang **`/video`** (và trang quản trị › tab **Video AI**): chọn mẫu (Nhảy trend, Ngạc nhiên ôm đầu, Ôm camera selfie, Catwalk, Tự mô tả), thêm ảnh thú cưng nếu muốn, bật/tắt nhạc nền, bấm **Tạo video**. Trang hỏi máy chủ mỗi 6 giây cho tới khi xong (thường 1–3 phút), rồi phát video và cho tải về.
- **Không cần đăng nhập**: khách được **2 video miễn phí** mỗi máy (thêm giới hạn theo IP để xóa dữ liệu app không lấy thêm được), hết thì app mở form tạo tài khoản. Thành viên trả **`VIDEO_POINTS`** điểm mỗi video (mặc định 20, trừ vào điểm tháng). Admin không giới hạn. Cả trang tối đa **`VIDEO_DAILY_LIMIT`** video mỗi ngày (mặc định 30) để người lạ không làm cạn credit AI. Video lỗi không bị tính, điểm được trả lại.
- Model `gemini-omni-1.1-flash-preview` (`src/server/gemini.ts` › `startVideo` / `checkVideo`): mỗi nguồn AI thử lần lượt `predictLongRunning` (cách của Vertex, giống Veo), Interactions API (AI Studio) rồi `generateContent`, cách nào Google nhận thì dùng; log `[video] started … (model, lro/int/gc)` cho biết cách đã dùng, đổi bằng `GEMINI_VIDEO_MODEL`. Mẫu và câu lệnh: `src/ai/video.ts`. Lượt và việc đang chạy: `src/server/videoJobs.ts` (bảng `video_jobs`). API: `app/api/video+api.ts`. Giao diện: `src/video/VideoMaker.tsx`, `app/video.tsx`.
- Trên điện thoại (app) chưa có trình phát video: bấm Tải video để mở/chia sẻ. Trên web phát ngay trong trang.
- Chạy thử trên máy: `.env` có nguồn AI (Vertex hoặc `GEMINI_API_KEY`), chạy `npx expo start --web`, mở `http://localhost:8081/video`.

## Ngôn ngữ

- 10 ngôn ngữ (`src/i18n/languages.ts`): English, Español, Português, Tiếng Việt, Français, Deutsch, Русский, 中文（简体）, 日本語, 한국어. Lần đầu mở app tự chọn theo ngôn ngữ của máy (`expo-localization`), không có thì dùng English; đổi ở **Hồ sơ › Ngôn ngữ** (lưu trên máy).
- Bản gốc là `src/i18n/locales/vi.ts`. Mỗi ngôn ngữ một file cùng thư mục, khai báo kiểu `Messages` nên TypeScript báo lỗi nếu thiếu hay thừa chuỗi; `{tên}` là chỗ điền số/tên, phải giữ nguyên. Chuỗi thiếu sẽ hiện tiếng Anh.
- Trong code: `t('khóa', { n: 3 })`; trong component dùng `const t = useT()` để đổi ngôn ngữ là màn hình cập nhật ngay.
- Thông báo lỗi của máy chủ cũng được dịch: app gửi header `x-cami-lang`, API dùng `tr(request, 'khóa')` (`src/server/i18n.ts`).
- Thêm ngôn ngữ: thêm mã vào `languages.ts`, chép `en.ts` thành `<mã>.ts` rồi dịch, thêm `import './<mã>';` vào `src/i18n/locales/all.ts`, chạy `npx tsc --noEmit`. Ngôn ngữ viết từ phải sang trái (Ả Rập…) cần thêm hỗ trợ RTL nên chưa có.
- Bản dịch hiện do máy làm, nên nhờ người bản xứ đọc lại, nhất là tiếng Tây Ban Nha và Bồ Đào Nha (thị trường chính). Chữ chèn lên ảnh dùng font Baloo, chưa có chữ Trung/Nhật/Hàn/Nga.

## Đưa lên mạng và build app

1. **Deploy web và API lên máy chủ của bạn** (VPS chạy Node 22.13+ + pm2 + nginx, giống booking / nails-studio). Không dùng EAS Hosting được, vì ở đó không có SQLite và không lưu được file. Từng bước (DNS tên miền, nginx, HTTPS, cập nhật, sao lưu): xem **[DEPLOY.md](DEPLOY.md)**.
   ```bash
   npm ci
   npx expo export -p web
   pm2 start ecosystem.config.cjs   # chạy server.cjs (web + API, port 3010)
   ```
   Đặt `.env` trên máy chủ: `GEMINI_API_KEY` hoặc `GOOGLE_CLOUD_PROJECT`, `CAMI_SECRET` (chuỗi ngẫu nhiên dài), tùy chọn `CAMI_DATA_DIR` và `CAMI_TIMEZONE`. Nginx cần đặt `X-Real-IP` để giới hạn theo IP hoạt động. Nhớ sao lưu thư mục `data/`.
2. Sửa `origin` trong `app.json` (plugin `expo-router`) và `EXPO_PUBLIC_API_URL` trong `.env` thành URL vừa deploy.
3. **Build app:**
   ```bash
   npx eas-cli@latest build -p android --profile production   # file .aab để tải lên Google Play
   npx eas-cli@latest build -p android --profile preview      # file .apk để cài thử
   npx eas-cli@latest build -p ios --profile production
   ```
   Các profile nằm trong `eas.json` (đã đặt sẵn `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SHARE_URL` = `https://camia.app`). `versionCode` do EAS tự tăng mỗi lần build. Nếu máy chủ có đặt `APP_TOKEN` thì phải thêm `EXPO_PUBLIC_APP_TOKEN` cùng giá trị trên EAS (`npx eas-cli@latest env:create`), vì `.env` không được gửi lên EAS.
