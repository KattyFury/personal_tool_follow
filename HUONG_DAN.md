# Personal Follow: Hướng dẫn cài đặt và sử dụng

Personal Follow là extension Chrome tự động **follow** (và **comment**) trên **Binance Square**, đồng thời **follow / unfollow** trên **X (Twitter)**. Extension mở trong khung **side panel** của Chrome, nằm cạnh trang bạn đang xem.

> ⚠️ **Đọc trước khi dùng**
> - Follow, unfollow và comment tự động có thể vi phạm điều khoản của Binance và X. Tài khoản có thể bị hạn chế hoặc khoá. **Bạn tự chịu rủi ro.**
> - Giới hạn mặc định (150 hoặc 400 lượt/ngày) là do tool tự đặt, **không phải** giới hạn chính thức của nền tảng.
> - Lần đầu dùng, hãy đặt giới hạn thật nhỏ (2–5 lượt) để chạy thử.

---

## 1. Yêu cầu

- **Google Chrome bản 114 trở lên**, trên Windows hoặc macOS.
- Đã đăng nhập Binance và/hoặc X trên Chrome.
- *(Không bắt buộc)* Extension **Kaito** nếu muốn dùng bộ lọc **SF > 10** trên X.

## 2. Cài đặt

1. **Giải nén** file zip vào một thư mục cố định, ví dụ `Documents/personal_tool_follow`. Không để trong thư mục Downloads hay thư mục tạm, vì nếu xoá thư mục này thì extension sẽ ngừng chạy.
2. Mở Chrome, gõ vào thanh địa chỉ: `chrome://extensions`
3. Ở góc trên bên phải, bật **Developer mode** (Chế độ dành cho nhà phát triển).
4. Bấm **Load unpacked** (Tải tiện ích đã giải nén).
5. Chọn thư mục **`extension`** nằm bên trong thư mục vừa giải nén. Đây là thư mục có chứa file `manifest.json`.
6. Nếu Chrome hỏi quyền **debugger**, hãy cho phép. Tool cần quyền này để giả lập rê chuột lên tên tác giả trên Binance.
7. Bấm biểu tượng 🧩 trên thanh công cụ, rồi bấm **ghim** 📌 cạnh **Personal Follow** cho dễ dùng.
8. **Refresh (F5)** các tab Binance Square hoặc X đang mở.

Bấm biểu tượng Personal Follow để mở side panel.

### Cập nhật lên bản mới

Chép đè các file mới vào thư mục cũ. Sau đó vào `chrome://extensions`, bấm nút ↻ **Reload** ở Personal Follow, rồi refresh các tab Binance/X. Phiên bản hiện tại được ghi ở góc trên side panel.

## 3. Giao diện side panel

- **Phần trên: Settings (cài đặt)**
  - Chọn **Binance** hoặc **X** để sửa cài đặt của nền tảng đó.
  - Sửa xong bấm **Save**. Dòng chữ *Unsaved* nghĩa là còn thay đổi chưa lưu.
- **Phần dưới: thẻ từng nền tảng**
  - Bộ đếm lượt hôm nay và thanh tiến độ.
  - Ô **Action** để chọn chế độ chạy.
  - **Dòng trạng thái**, cho biết tool đang làm gì hoặc vì sao dừng.
  - Ô chọn tab, cùng hai nút **Stop** và **Start**.

Bộ đếm reset lúc **0h giờ Việt Nam**. Binance và X đếm riêng.

## 4. Binance Square

### Cài đặt (chọn Binance ở phần Settings)

| Mục | Ý nghĩa | Mặc định |
|---|---|---|
| Daily cap | Số lượt follow tối đa mỗi ngày | 150 |
| Delay | Thời gian chờ ngẫu nhiên giữa 2 lượt (giây) | 60–90 |
| Comment after follow | Comment vào bài của người vừa follow (chỉ ở chế độ Feed) | Tắt |
| Comments/day | Số comment tối đa mỗi ngày | 30 |
| Comments | Nội dung comment, **mỗi dòng là một comment** (tối đa 20 dòng), dùng lần lượt | Please follow me back |

### Chế độ Follow from feed

1. Mở trang Square feed: `https://www.binance.com/en/square`
2. Trên thẻ Binance, chọn Action **Follow from feed**.
3. Chọn đúng tab Binance trong ô chọn tab, rồi bấm **Start**.
4. Tool tự làm các bước sau:
   - rê chuột lên tên tác giả, chờ thẻ profile hiện ra rồi bấm **Follow**;
   - nếu bật comment, mở hộp comment của bài đó, gõ câu tiếp theo trong danh sách rồi bấm **Reply**;
   - chờ hết thời gian Delay rồi cuộn xuống người tiếp theo.
5. Người bạn đã follow từ trước sẽ được bỏ qua và không bị comment.

**Lưu ý khi chạy:**
- Trong lúc chạy, **giữ tab Binance đang mở và đang được chọn**. Đừng chuyển sang tab khác trong cùng cửa sổ.
- **Tắt DevTools** (F12) trên tab Binance.
- Chrome sẽ hiện thanh *"Personal Follow đang gỡ lỗi trình duyệt này"*. Đây là bình thường. **Đừng bấm Cancel**, vì tool sẽ dừng ngay.
- Cửa sổ Chrome cần **đủ rộng**, khoảng trên 600px. Nếu cửa sổ quá hẹp, Binance không hiện thẻ profile.
- Để zoom trang ở **100%**: nhấn `Ctrl+0` trên Windows hoặc `Cmd+0` trên Mac.

### Chế độ Follow back

1. Mở **Profile → Followers** của bạn trên Square. Đường dẫn có dạng `.../square/profile/<tên-bạn>/followers`.
2. Chọn Action **Follow back**, rồi bấm **Start**.
3. Tool follow lại tất cả những người theo dõi bạn mà bạn chưa follow, và tự cuộn để tải thêm.

### Mẹo tránh bị đánh spam khi comment

- Giữ **Comments/day** thấp, khoảng 20–30.
- Nhập **nhiều câu comment khác nhau**, tối đa 20 dòng. Ví dụ:
  ```
  Please follow me back
  Great post! Follow back?
  Nice analysis, let's connect 🤝
  Followed you, hope you follow back
  Thanks for sharing, followed!
  ```
- Tăng Delay lên, ví dụ 90–180 giây.

## 5. X (Twitter)

### Cài đặt (chọn X ở phần Settings)

| Mục | Ý nghĩa | Mặc định |
|---|---|---|
| Daily cap | Số lượt tối đa mỗi ngày | 400 |
| Delay | Thời gian chờ giữa 2 lượt (giây) | 60–90 |
| SF > 10 · Kaito | Chỉ follow người có điểm SF > 10; unfollow người SF ≤ 10. Cần cài extension Kaito | Bật |
| Whitelist | Danh sách tài khoản **không bao giờ unfollow** (`@handle`, cách nhau bằng dấu phẩy) | Có sẵn danh sách |

Nếu không có Kaito, hãy **tắt SF > 10**. Khi công tắc bật mà không có Kaito, tool sẽ bỏ qua tất cả mọi người.

### Các chế độ (Action trên thẻ X)

| Action | Mở trang nào trước | Tool làm gì |
|---|---|---|
| Follow back | Danh sách **Followers** (hoặc Verified followers) của bạn | Follow lại người theo dõi bạn |
| Mass follow | `x.com/i/connect_people` (Who to follow) **hoặc** Home feed | Follow người thật (bỏ qua tổ chức); trên Home feed thì follow tài khoản verified |
| Unfollow ↓ | Danh sách **Following** của bạn | Unfollow từ trên xuống |
| Unfollow ↑ | Danh sách **Following** của bạn | Unfollow từ dưới lên |

Khi unfollow, tool luôn giữ lại các tài khoản trong Whitelist.

> Nếu đang dùng script **X Manager** (Tampermonkey), hãy tắt nó đi để hai công cụ không chạy cùng lúc.

## 6. Xử lý lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Nút **Start** bị mờ, ô chọn tab ghi *"Open … first"* | Mở tab Binance Square hoặc X, chờ 2 giây cho ô chọn tab cập nhật |
| Báo *"Refresh the platform tab…"* | Refresh (F5) tab Binance/X rồi bấm Start lại. Lỗi này hay gặp ngay sau khi cài hoặc Reload extension |
| *"Open the Binance Square feed, not a profile or post"* | Bạn đang ở trang profile hoặc trang bài viết. Quay về trang feed `binance.com/en/square` |
| *"…too narrow…"* hoặc không hiện thẻ profile | Kéo cửa sổ Chrome rộng hơn, đóng bớt side panel khác |
| *"Pointer missed the name…"* | Đưa zoom trang về 100% (`Ctrl+0` / `Cmd+0`) |
| *"Browser hover disconnected"* | Bạn đã bấm Cancel trên thanh debugger hoặc mở DevTools. Đóng DevTools rồi Start lại |
| *"Page changed"* | Trang đã chuyển hướng. Chờ trang tải xong rồi Start lại |
| Có follow nhưng không comment | Xem dòng trạng thái sau mỗi lượt follow (ví dụ *"…comment box did not open…"*). Kiểm tra lại 3 điều: đã bật *Comment after follow* và bấm Save; đang ở chế độ *Follow from feed*; người đó chưa từng được follow |
| *"Daily cap reached"* | Đã hết lượt của hôm nay. Chờ qua 0h hoặc tăng Daily cap |
| *"Platform restriction or verification prompt"* | Nền tảng đang chặn hoặc bắt xác minh. **Dừng lại**, xử lý trên trang, và nên nghỉ một thời gian |

## 7. Ghi chú

- Cài đặt và bộ đếm được lưu trong Chrome. Khởi động lại Chrome thì tool dừng, nhưng cài đặt vẫn còn.
- Bộ đếm tính theo **lượt thử**: mỗi lượt được trừ trước khi bấm, kể cả khi thao tác đó thất bại.
- Tool không di chuyển chuột thật của máy. Bạn vẫn dùng máy bình thường, chỉ cần giữ nguyên tab đang chạy.
- Tính năng **comment** mới được thêm và còn đang thử nghiệm. Nếu gặp lỗi, hãy chụp màn hình dòng trạng thái gửi cho người chia sẻ tool.
