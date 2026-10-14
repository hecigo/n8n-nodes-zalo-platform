# Chat với Zalo Bot trên n8n: tin nhắn riêng và trong nhóm

Một người dùng nhắn cho bot trong nhóm và nhận câu trả lời ở inbox riêng. Khi mở execution
trên n8n, họ thấy ID của tin nhắn riêng và ID của tin nhắn nhóm giống hệt nhau. Thật ra thứ
họ đang so là `from.id` (người gửi), không phải `chat.id` (cuộc trò chuyện). Khi đã tách được
hai ID này, mọi thứ còn lại trong hướng dẫn chỉ là cấu hình.

Hướng dẫn này dùng `n8n-nodes-zalo-platform` 2.2.0. Phần lớn chạy được trên 2.0.x. Riêng bộ
lọc **Chat Type** thì cần từ 2.1.0. Từ 2.2.0, node **Zalo Bot** mới thêm vào canvas có thêm ô
**Resource** (Bot, Message, Webhook). Node đã lưu trước đó vẫn giữ danh sách Operation cũ và
chạy như trước.

## Hai ID trong mỗi tin nhắn

Zalo gửi về webhook dạng `{ "ok": true, "result": { ... }, "error_code": 0 }`. Node
**Zalo Bot Trigger** bóc lớp `result`, nên đầu ra của Trigger bắt đầu từ `event_name`.

Cùng một người, một lần nhắn riêng và một lần nhắn trong nhóm (dữ liệu bịa, cấu trúc giữ
đúng như payload thật):

```json
{
  "event_name": "message.text.received",
  "message": {
    "chat": { "id": "5c1e9a7d3b2f48a6e0d4", "chat_type": "PRIVATE" },
    "from": { "id": "5c1e9a7d3b2f48a6e0d4", "is_bot": false, "display_name": "Nguyen Van A" },
    "text": "Xin chao"
  }
}
```

```json
{
  "event_name": "message.text.received",
  "message": {
    "chat": { "id": "zgr-7e3d9b1a5c2f80e4d6a1", "chat_type": "GROUP" },
    "from": { "id": "5c1e9a7d3b2f48a6e0d4", "is_bot": false, "display_name": "Nguyen Van A" },
    "text": "@Bot MyShop xin chao"
  }
}
```

| Trường | Là gì | Tin riêng | Tin nhóm |
|---|---|---|---|
| `message.chat.id` | Cuộc trò chuyện, **nơi gửi câu trả lời** | ID người dùng | ID nhóm, bắt đầu bằng `zgr-` |
| `message.from.id` | Người vừa nhắn | ID người dùng | ID người dùng |
| `message.chat.chat_type` | Loại cuộc trò chuyện | `PRIVATE` | `GROUP` |

Với tin nhắn riêng, `chat.id` và `from.id` trùng nhau, nên map nhầm trường nào thì bot vẫn trả
lời đúng chỗ. Lỗi chỉ lộ ra khi vào nhóm: lúc này `from.id` vẫn là ID của người gửi, nên câu
trả lời bay về inbox riêng của họ.

Mọi ô **Chat ID** dùng để trả lời đều nên là:

```
{{ $json.message.chat.id }}
```

Trong các lần chúng tôi thử, ID nhóm đều có tiền tố `zgr-`, còn ID người dùng là chuỗi hex
20 ký tự. Tài liệu của Zalo không ghi định dạng này. Vậy nên nó hợp để kiểm nhanh bằng mắt,
nhưng không nên dùng làm điều kiện rẽ nhánh trong workflow. Muốn rẽ nhánh thì dùng
`chat_type`.

## Chat riêng: workflow nhỏ nhất chạy được

1. **Tạo bot.** Trong Zalo, tìm OA **Zalo Bot Manager**, chọn **Tạo Bot**. Tên bot phải bắt
   đầu bằng `Bot`. Zalo gửi Bot Token qua tin nhắn, dạng `{bot_id}:{secret_key}`.
2. **Tạo credential.** Trên n8n, tạo credential **Zalo Bot API** và dán Bot Token vào. Nút test
   gọi `getMe`. Nếu bị 401 thì token sai hoặc đã bị đổi.
3. **Trigger.** Thêm **Zalo Bot Trigger**, chọn Event là `Text Message`. Bạn không cần tự đặt
   webhook: khi workflow được bật, node tự đăng ký webhook với Zalo và tự kiểm secret token.
4. **Trả lời.** Thêm node **Zalo Bot**, chọn Resource là `Message` và Operation là `Send Message`:
   - Chat ID: `{{ $json.message.chat.id }}`
   - Text: `Đã nhận: {{ $json.message.text }}`
5. Bật workflow rồi nhắn cho bot.

Workflow này có sẵn để import: [examples/group-reply.workflow.json](../examples/group-reply.workflow.json).
Nó chạy cho cả tin riêng lẫn tin nhóm, vì Chat ID lấy từ `chat.id`.

Nếu n8n chạy sau Cloudflare, hai rule trong README (mục *Cloudflare Configuration*) là điều kiện
để webhook tới được n8n. Zalo gọi webhook với User-Agent `Java/1.8.0_192`, và Cloudflare chặn
User-Agent này theo mặc định.

## Đưa bot vào nhóm

Zalo ghi rằng tính năng nhóm đang "trong giai đoạn thử nghiệm nội bộ"
([hướng dẫn của Zalo](https://bot.zapps.me/docs/build-bot-interaction-with-group/)). Nếu bot của
bạn chưa có mục mời vào nhóm, nghĩa là Zalo chưa mở tính năng này cho bot đó, và phía n8n
không bật được thay.

Bot không vào nhóm qua nút "Thêm thành viên". Cách thêm là gửi link mời:

1. Mở mini app **Zalo Bot Creator** và chọn bot.
2. Ở mục **Mời Bot vào nhóm**, bấm chia sẻ hoặc sao chép link, rồi gửi link vào nhóm.
3. **Admin nhóm** bấm link và xác nhận **Thêm Bot vào Nhóm**. Khi chúng tôi thử, thành viên
   thường không thêm được. Tài liệu của Zalo nói người xác nhận là trưởng nhóm.
4. Bot gửi một tin chào trong nhóm. Thấy tin này là đã thêm xong.

## Bot nghe được gì trong nhóm

Bot không nhận mọi tin nhắn trong nhóm. Zalo chỉ gửi tin về webhook trong hai trường hợp:

- **Có người @mention bot.** Gõ `@` rồi chọn tên bot trong danh sách gợi ý, như tài liệu của
  Zalo mô tả.
- **Có người trả lời (quote) một tin nhắn của bot.** Trường hợp này lấy theo tài liệu của Zalo.
  Chúng tôi mới thử trường hợp mention.

Hệ quả cho thiết kế workflow: với một workflow nhận tin từ nhóm, mỗi lần chạy là một câu hỏi
gửi cho bot. Bạn không cần lọc bỏ những tin nhắn chuyện trò thường ngày trong nhóm, vì chúng
không bao giờ tới n8n.

Trường `text` của tin nhóm có kèm phần mention, ví dụ `@Bot MyShop xin chao`. Nếu workflow
cần đúng câu người dùng gõ, hãy cắt phần đầu này đi trước khi đưa vào AI hoặc so khớp từ khoá:

```
{{ $json.message.text.replace(/^@Bot MyShop\s*/, '') }}
```

Thay `Bot MyShop` bằng tên bot của bạn.

## Tách hành vi tin riêng và tin nhóm

Mỗi bot chỉ có một webhook (`getWebhookInfo` trả về đúng một URL). Vì vậy, với một Bot
Token, chỉ một workflow nhận tin tại một thời điểm: workflow bật sau sẽ ghi đè webhook của
workflow bật trước. Chọn cách nào tuỳ vào việc bot cần phục vụ một loại hội thoại hay cả hai.

**Bot chỉ phục vụ một loại.** Đặt **Chat Type** của Trigger là `Group` hoặc `Private`. Tin
thuộc loại còn lại sẽ bị bỏ qua ngay tại Trigger, không tạo execution. Ví dụ: một bot chỉ
dùng để tra đơn hàng trong nhóm nội bộ thì không cần trả lời khi ai đó nhắn riêng cho nó.

**Bot phục vụ cả hai.** Để Chat Type là `All`, rồi thêm node **Switch** theo
`{{ $json.message.chat.chat_type }}` với hai nhánh `PRIVATE` và `GROUP`. Phần logic dùng chung
đặt sau chỗ hai nhánh gặp lại nhau. Nếu hai luồng khác nhau hẳn và cần tách thành hai
workflow, mỗi workflow cần một bot riêng.

## Gắn AI Agent

Luồng cơ bản: **Zalo Bot Trigger → AI Agent → Zalo Bot (Send Message)**.

Phần quyết định bot "nhớ" theo ai là **Session ID** của node memory (ví dụ Simple Memory, chọn
*Define below*):

| Session ID | Bot nhớ theo | Hợp với |
|---|---|---|
| `{{ $json.message.chat.id }}` | Từng cuộc trò chuyện. Cả nhóm dùng chung một mạch hội thoại, còn mỗi tin riêng có mạch riêng. | Nhóm làm việc chung một chủ đề |
| `{{ $json.message.chat.id }}:{{ $json.message.from.id }}` | Từng người trong từng cuộc trò chuyện | Nhóm đông người, mỗi người hỏi một việc riêng |

Ở node gửi tin, Chat ID vẫn là `{{ $('Zalo Bot Trigger').item.json.message.chat.id }}`. Phải
tham chiếu thẳng về Trigger, vì sau khi qua AI Agent thì `$json` là đầu ra của Agent, không
còn chứa `message`.

Một tin nhắn tối đa 2000 ký tự. Câu trả lời của AI thường dài hơn mức đó, nên bạn có thể
giới hạn độ dài ngay trong system prompt, hoặc tách câu trả lời thành nhiều tin và gửi lần
lượt.

Muốn hiện trạng thái "đang soạn tin" trong lúc AI xử lý, thêm node **Zalo Bot** với Resource
`Message`, Operation `Send Chat Action` (`typing`) ngay sau Trigger, Chat ID vẫn là `chat.id`. Chúng tôi chưa kiểm
hiệu ứng này trong nhóm.

## Giới hạn đã biết

- Tính năng nhóm của Zalo đang trong giai đoạn thử nghiệm nội bộ. Hành vi trong nhóm có thể
  thay đổi mà phía node không biết trước.
- Trong nhóm, bot chỉ nhận tin khi được mention hoặc được trả lời. Những tin khác trong nhóm
  không được Zalo gửi về webhook, nên workflow không có ngữ cảnh của phần hội thoại đó.
- Node chưa có thao tác gửi tin thoại (`sendVoice`), dù API của Zalo có. Tin thoại gửi **đến**
  bot vẫn qua được Trigger khi Event là `Any Message` (`message.voice.received`).
- Mỗi bot chỉ có một webhook, nên chỉ một workflow nhận tin tại một thời điểm.
- Nếu người gửi thuộc nhóm đối tượng đặc biệt (theo phân loại của Zalo), bot nhận
  `message.unsupported.received` mà không có nội dung tin nhắn.

## Khi bot không trả lời đúng chỗ

| Hiện tượng | Kiểm chỗ nào |
|---|---|
| Nhắn trong nhóm, bot trả lời ở inbox riêng | Chat ID đang là `message.from.id`. Đổi sang `message.chat.id`. |
| ID tin riêng và ID tin nhóm "giống nhau" | Bạn đang so `from.id`. Hãy so `chat.id`: ID nhóm bắt đầu bằng `zgr-`. |
| Nhắn trong nhóm, workflow không chạy | Tin nhắn chưa mention bot (phải chọn tên bot từ danh sách sau dấu `@`). Hoặc Chat Type đang để `Private`. |
| Không thêm được bot vào nhóm | Người bấm link mời không phải admin, hoặc bot chưa có mục *Mời Bot vào nhóm* (Zalo chưa mở tính năng này cho bot). |
| `$json.message` rỗng, dữ liệu nằm dưới `result` | Bạn không đọc từ Zalo Bot Trigger mà từ Get Updates, node Webhook mặc định, hoặc body thô của request. Đường dẫn khi đó là `$json.result.message.chat.id`, hoặc `$json.body.result.message.chat.id` với node Webhook. |
| Bật workflow thứ hai thì workflow đầu ngừng nhận tin | Hai workflow dùng chung một bot, và webhook bị ghi đè. |
| Trigger không nhận được gì | Cloudflare chặn User-Agent của Zalo. Xem mục *Cloudflare Configuration* trong README. |

## Báo lỗi

Hãy mở issue tại [github.com/hecigo/n8n-nodes-zalo-platform/issues](https://github.com/hecigo/n8n-nodes-zalo-platform/issues),
kèm phiên bản n8n, phiên bản node, và JSON đầu ra của Trigger. Nhớ che ID và tên trước khi gửi.
Nếu cần trao đổi riêng, gửi về hi@hecigo.com.
