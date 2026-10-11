# Đưa Camia lên VPS và gắn tên miền

Hướng dẫn cho VPS Ubuntu 22.04 đang chạy nhiều dự án khác (nginx + pm2). Ví dụ dùng tên miền `camia.app` và IP `109.123.243.65`: thay bằng tên miền và IP của bạn.

Camia trên VPS gồm: web app + API (một tiến trình Node, port 3010, chỉ nghe trong máy) → nginx nhận HTTPS từ ngoài và chuyển vào. Dữ liệu (tài khoản, điểm, thống kê) nằm trong file SQLite `data/cami.db`.

## 1. Trỏ tên miền về VPS (DNS)

Vào trang quản lý DNS nơi bạn mua tên miền (Namecheap, GoDaddy, PA Việt Nam, Cloudflare…), thêm các bản ghi:

| Loại | Tên (Host) | Giá trị | TTL |
|---|---|---|---|
| `A` | `@` | `109.123.243.65` | Auto / 300 |
| `A` | `www` | `109.123.243.65` | Auto / 300 |
| `AAAA` (tùy chọn) | `@` | `2a02:c207:2272:3098::1` | Auto / 300 |

- Dùng **IP công khai** (dòng `IPv4 address for eth0` khi đăng nhập SSH), không dùng IP `100.x.x.x` (đó là IP mạng nội bộ Tailscale để bạn SSH).
- Muốn dùng tên miền phụ (vd `app.tenmien.com`) thì thêm `A` với tên `app` thay cho `@`/`www`.
- Nếu tên miền ở **Cloudflare**: để đám mây **xám (DNS only)**. Bật đám mây cam thì IP khách thật bị che, app sẽ đếm mọi người là một IP (giới hạn lượt miễn phí và thống kê sai), và certbot cần cấu hình khác.
- Xóa bản ghi `A`/`CNAME` cũ trùng tên (vd trang "parking" của nhà đăng ký).
- Kiểm tra (từ máy bạn): `nslookup camia.app` phải ra đúng IP VPS. Thường mất vài phút, có khi tới vài giờ.

## 2. Chuẩn bị VPS (một lần)

```bash
node -v          # cần v22.13 trở lên (dùng node:sqlite)
pm2 -v
sudo ss -ltnp | grep 3010   # không có gì = port 3010 còn trống
```

- Node cũ hơn và các dự án khác vẫn cần bản cũ: cài Node 22 riêng bằng nvm (`nvm install 22`), rồi bỏ dấu `//` ở dòng `interpreter` trong `ecosystem.config.cjs` và ghi đường dẫn tới node 22 (`nvm which 22`). Các dự án khác không bị ảnh hưởng.
- Port 3010 bị dùng rồi (vd `curl -I http://127.0.0.1:3010` trả về trang của dự án khác): thêm dòng `PORT=3020` (port còn trống) vào `.env`, và sửa `proxy_pass` trong `deploy/nginx-camia.conf` thành cùng port.

## 3. Lấy code và cấu hình

```bash
cd ~
git clone https://github.com/hieplv95/cam-ia.git camia
cd camia
npm ci
cp .env.example .env
nano .env
```

Trong `.env` trên VPS, điền:

- `GEMINI_API_KEY` (hoặc `GOOGLE_CLOUD_PROJECT`), `GEMINI_IMAGE_MODEL`.
- `CAMI_SECRET`: chuỗi ngẫu nhiên dài, tạo bằng `openssl rand -hex 32`. **Nếu chép `data/cami.db` từ máy bạn lên** (giữ tài khoản, nguồn AI đã lưu trong trang quản trị) thì phải dùng **đúng `CAMI_SECRET` trong `.env` ở máy bạn**, nếu không các khoá AI đã lưu sẽ không mở được.
- `ADMIN_EMAILS=hieplv1995@gmail.com`
- `EXPO_PUBLIC_SHARE_URL=https://camia.app` (link mời bạn bè).
- `EXPO_PUBLIC_API_URL`: để trống cho web (web và API cùng tên miền). Khi build app Android/iOS thì đặt `https://camia.app` (xem mục 7).

Chép dữ liệu cũ (nếu muốn), chạy từ máy bạn:

```bash
scp data/cami.db lee@100.75.20.25:~/camia/data/cami.db
```

## 4. Build và chạy

```bash
npx expo export -p web           # tạo dist/ (vài phút, cần ~2–3 GB RAM lúc build)
pm2 start ecosystem.config.cjs
pm2 save
curl -I http://127.0.0.1:3010    # phải ra 200 (dùng đúng PORT trong .env); dòng X-Powered-By: Next.js là dự án khác, không phải Camia
```

`EXPO_PUBLIC_*` được gắn vào lúc build: đổi chúng trong `.env` thì phải chạy lại `npx expo export -p web`.

## 5. Nginx và HTTPS

```bash
nano deploy/nginx-camia.conf     # thay camia.app bằng tên miền của bạn
sudo cp deploy/nginx-camia.conf /etc/nginx/sites-available/camia
sudo ln -s /etc/nginx/sites-available/camia /etc/nginx/sites-enabled/camia
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d camia.app -d www.camia.app
```

- `nginx -t` báo lỗi thì đừng reload (các dự án khác vẫn chạy bằng cấu hình cũ); đọc lỗi rồi sửa file.
- Chưa có certbot: `sudo apt install certbot python3-certbot-nginx`.
- Tường lửa: `sudo ufw status`; nếu đang bật thì `sudo ufw allow 'Nginx Full'`.
- Chứng chỉ tự gia hạn; kiểm tra bằng `sudo certbot renew --dry-run`.

Mở `https://camia.app` và `https://camia.app/admin` để thử.

## 6. Cập nhật bản mới

Sau khi đẩy code mới lên GitHub:

```bash
cd ~/camia && npm run deploy:update
```

(= `git pull`, `npm ci`, build lại, `pm2 reload` không làm rớt khách). `data/` và `.env` không bị đụng tới.

Xem log: `pm2 logs camia`. Trạng thái: `pm2 status`.

## 7. Build app điện thoại trỏ về server

1. Trong `app.json`, sửa `origin` của plugin `expo-router` thành `https://camia.app`.
2. Đặt `EXPO_PUBLIC_API_URL=https://camia.app` (trong `.env` khi build ở máy, hoặc biến môi trường trên EAS).
3. `bunx eas-cli build -p android` / `-p ios` (hoặc `npx eas-cli@latest build …`).

## 8. Sao lưu dữ liệu

Tài khoản và điểm của khách chỉ nằm trong `data/cami.db`. Sao lưu mỗi đêm (`crontab -e`, thêm dòng):

```cron
30 3 * * * cd ~/camia && mkdir -p backups && node -e "new (require('node:sqlite').DatabaseSync)('data/cami.db').exec(\"VACUUM INTO 'backups/cami-$(date +\%F).db'\")" && find backups -name 'cami-*.db' -mtime +14 -delete
```

Nên chép thư mục `backups/` ra ngoài VPS định kỳ.

## Ghi chú

- VPS đang báo **"System restart required"**: chạy `pm2 save` và `pm2 startup` (làm theo lệnh nó in ra) để mọi dự án tự chạy lại, rồi khởi động lại vào lúc ít khách.
- Camia dùng khoảng 200–400 MB RAM khi chạy; phần nặng (tạo ảnh AI) chạy trên Google.
