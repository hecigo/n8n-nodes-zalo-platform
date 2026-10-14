# Bài học từ đợt 2.1.0 - 2.2.0

Ghi lại các lỗi đã gặp, nguyên nhân và cách chặn từ sớm, để dùng lại cho các n8n node khác
của hecigo (ví dụ `n8n-nodes-firecrawl-v2`). Mỗi mục ghi theo thứ tự: chuyện gì xảy ra, vì
sao, và lần sau làm gì.

## 1. Review của n8n

### 1.1 Lint trên máy sạch, nhưng review vẫn báo lỗi

- **Chuyện gì xảy ra:** bản 2.1.0 bị trả về vì lỗi `resource-operation-pattern` (node có
  9 operation mà không chia theo resource). Trên máy, `npm run lint` chỉ báo lỗi này là
  *warning*.
- **Vì sao:** repo dùng `@n8n/eslint-plugin-community-nodes` 0.29.0. Ở bản đó rule này là
  warning. Bộ quét của n8n dùng bản mới nhất (0.36.0 tại thời điểm review), và ở bản mới
  rule đã thành *error*.
- **Lần sau:**
  - Trước mỗi lần tag, chạy `npm view @n8n/eslint-plugin-community-nodes version`, rồi
    nâng devDependency lên đúng bản đó.
  - Coi mọi warning của plugin này như error. Warning hôm nay có thể là error của bộ quét
    ngày mai.
  - Chạy thêm `npx @n8n/node-cli@latest lint`. Lệnh này dùng `eslint.config.mjs` của repo
    nhưng quét cả thư mục.

### 1.2 Bộ quét chỉ chạy được trên gói đã publish

- `npx @n8n/scan-community-package <tên gói>` tải tarball từ npm về. Nếu gói có provenance,
  nó tải thêm source theo commit ghi trong provenance. Vì vậy không quét được bản trên máy
  trước khi publish.
- **Thay thế trước khi publish:** dùng đúng phiên bản plugin lint như mục 1.1, cộng với
  `node-cli lint`.
- **Thứ tự kiểm của scanner** (đọc từ output của bản 2.2.0, ngày 14/10/2026):
  1. Kiểm provenance.
  2. Tải source tại commit ghi trong provenance.
  3. Tải tarball từ npm.
  4. Chạy lint.

  Bản 2.2.0 qua cả bốn bước. Các bước sửa ở mục 1.1, 1.3, 1.4 và 1.5 là đủ.
- **Hệ quả:** nếu viết lại lịch sử git sau khi publish, commit mà provenance trỏ tới sẽ
  biến mất khỏi branch. Khi GitHub dọn commit cũ, link provenance của các bản đã publish sẽ
  ra 404. Muốn viết lại lịch sử thì nên làm trước khi tag.

### 1.3 `node-cli lint` báo lỗi trong thư mục test

- **Lỗi:** `Require of 'node:test' is not allowed` và `Use of restricted global 'globalThis'`
  trong `test/*.js`.
- **Vì sao:** rule giới hạn môi trường n8n Cloud được áp cho mọi file mà ESLint nhìn thấy,
  kể cả file không được đóng gói.
- **Cách sửa:** thêm `test/**` vào `ignores` trong `eslint.config.mjs`. Trước khi bỏ một thư
  mục khỏi lint, kiểm bằng `npm pack --dry-run` rằng thư mục đó thật sự không nằm trong gói.

### 1.4 README phải chỉ có tiếng Anh

- n8n trả về vì README có cụm tiếng Việt: tên link, câu trích tài liệu Zalo, nhãn giao diện
  Zalo.
- **Quy tắc:** README (thứ hiện trên npm) chỉ dùng tiếng Anh, kể cả nhãn giao diện của nền
  tảng khác. Hãy dịch nhãn đó, và để bản gốc tiếng Việt trong `docs/`.
- **Kiểm nhanh:**

  ```bash
  python3 -c "import re;[print(i,l.strip()) for i,l in enumerate(open('README.md'),1) if re.search('[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]',l,re.I)]"
  ```

### 1.5 Đổi bố cục tham số mà không làm hỏng workflow đã lưu

- **Bài toán:** muốn thêm `resource` cho đúng rule. Nhưng nếu chỉ thêm `resource` thì một
  node đã lưu với `operation: setWebhook` sẽ nhận `resource` mặc định là `message`. Khi đó
  ô operation đang lưu bị ẩn, và n8n bỏ giá trị đó đi.
- **Cách làm:** dùng versioned node, `version: [1, 2]` với `defaultVersion: 2`.
  - Property cũ gắn `displayOptions.show['@version'] = [1]`.
  - Property mới gắn `[2]`.
  - Giữ nguyên giá trị operation và tên tham số, để `execute()` không cần biết đang chạy
    version nào.
- **Cách kiểm:** đưa node qua `NodeHelpers.getNodeParameters` rồi
  `NodeHelpers.getNodeParametersIssues` của `n8n-workflow`. Đây là logic mà editor và
  executor dùng thật. Xem test `v1 / v2 parameter layout` trong `test/action.test.js`.

### 1.6 Thêm tham số mới cho node đã có

- Workflow lưu trước khi có tham số sẽ không có giá trị cho tham số đó. Trong `webhook()`
  hoặc `execute()`, hãy đọc bằng `getNodeParameter('chatType', 'all')`, tức là luôn có giá
  trị dự phòng.
- Viết test cho trường hợp "tham số không tồn tại", không chỉ trường hợp "tham số bằng
  default".

### 1.7 Chuỗi giao diện bị lint chặn

- Rule `node-param-description-miscased-id` và `-json` chặn chữ `id` và `json` viết thường
  trong `description`, `displayName` và `notice`. Nếu dùng autofix, biểu thức
  `{{ $json.message.chat.id }}` sẽ bị đổi thành `$JSON...ID` và hỏng.
- **Cách viết:** chỉ ra đường dẫn trường dữ liệu bằng chữ, ví dụ `message → chat → ID`. Để
  biểu thức đầy đủ trong README hoặc docs.

## 2. Zalo Bot Platform: những gì đã kiểm chứng

| Điều | Nguồn |
|---|---|
| Webhook gửi `{ ok, result: { event_name, message }, error_code }`. Trigger bóc lớp `result`. | Payload thật, 13/10/2026 |
| `chat.id` là cuộc trò chuyện, `from.id` là người gửi. Ở tin riêng hai ID trùng nhau, ở tin nhóm thì khác. | Payload thật |
| ID nhóm có tiền tố `zgr-`. ID người dùng là chuỗi hex 20 ký tự. | Payload thật (Zalo không ghi trong tài liệu) |
| `chat_type` có hai giá trị `PRIVATE` và `GROUP`. Nhóm đang là Beta, hay "thử nghiệm nội bộ". | Tài liệu Zalo |
| Bot vào nhóm qua link mời trong Zalo Bot Creator, và admin nhóm xác nhận. Thành viên thường không thêm được. | Người dùng thử thật. Tài liệu Zalo ghi là trưởng nhóm. |
| Trong nhóm, bot chỉ nhận tin khi được @mention hoặc khi có người trả lời tin của bot. | Mention: đã thử. Reply: chỉ theo tài liệu Zalo. |
| Mỗi bot có một webhook. Workflow bật sau sẽ ghi đè workflow bật trước. | API `getWebhookInfo` trả về một URL |

Tài liệu nhóm của Zalo nằm ở trang riêng `/docs/build-bot-interaction-with-group/`. Trang
tổng quan không link thẳng tới trang đó, nên lúc đầu chúng tôi bỏ sót nó và trích nguồn bên
thứ ba (OpenClaw), kết quả là thiếu trường hợp "reply". **Bài học:** trước khi trích nguồn
bên thứ ba, hãy lấy danh sách mọi đường dẫn `/docs/...` trong HTML của trang tài liệu chính
thức:

```bash
curl -sL https://bot.zapps.me/docs/ | grep -oE '/docs/[a-zA-Z0-9_/-]+' | sort -u
```

**Chẩn đoán lỗi người dùng báo:** "bot chỉ trả lời inbox riêng" gần như luôn do ô Chat ID
map vào `from.id`. Nếu dữ liệu người dùng gửi có `ok`, `result`, `error_code` ở cấp ngoài
cùng thì họ không đọc từ Zalo Bot Trigger, mà từ Get Updates, node Webhook mặc định, hoặc
body thô. Khi đó đường dẫn khác hẳn (`$json.result.message...`).

## 3. Unit test

### 3.1 Cách dựng (dùng lại được cho node khác)

- **Bộ chạy:** `node:test` và `node:assert/strict`. Không thêm dependency, nên không ảnh
  hưởng việc verify.
- **Chạy trên `dist/`:** `"pretest": "npm run build"`. Test kiểm đúng code sẽ được publish.
- **Lệnh:** `node --test "test/*.test.js"`. Node 22 không nhận tên thư mục làm đối số cho
  `--test` (nó coi đó là một file và báo `MODULE_NOT_FOUND`), nên phải dùng glob trong
  ngoặc kép.
- **Context giả lập:** `test/helpers.js` dựng các object `IWebhookFunctions`,
  `IHookFunctions` và `IExecuteFunctions` tối thiểu:
  - `getNodeParameter` trả giá trị dự phòng khi tham số không có, giống n8n.
  - `httpRequest` ghi lại mọi request gửi đi, và một hàm `respond` đóng vai API.
  - `fetch` toàn cục được thay trong từng test bằng `mockFetch(t, handler)`, rồi trả lại
    ở `t.after`.
- **Fixture:** giữ đúng cấu trúc payload thật, nhưng mọi giá trị đều bịa (xem mục 5).
- **CI:** chạy test sau bước Build. Workflow publish cũng chạy test trước khi `npm publish`.

### 3.2 Danh sách kịch bản

Cho trigger nhận webhook:

- Secret sai, không có header secret, và token có khoảng trắng thừa (phải trim).
- Body không có `event_name`.
- Payload phẳng, và payload bọc `{ ok, result, error_code }`.
- Bộ lọc Event: lọc riêng, và kết hợp với bộ lọc khác.
- Bộ lọc mới: với mọi giá trị; với trường hợp tham số không tồn tại (workflow cũ); với
  payload thiếu trường cần lọc.
- Vòng đời webhook:
  - `checkExists` trả `true`/`false`, và báo lỗi khi API không gọi được.
  - `create` gửi đúng body; khi `ok:false` thì báo lỗi kèm `description`.
  - `delete` không chặn việc tắt workflow, nhưng có ghi log cảnh báo.

Cho action node:

- Mỗi operation: method, URL và body gửi đi. Gồm cả tham số tuỳ chọn để trống (không gửi),
  và tên trường khác nhau giữa giao diện và API (`stickerId` → `sticker`).
- Nhiều item đầu vào: tham số theo từng item, và `pairedItem`.
- Lỗi:
  - `ok:false` phải ra `NodeApiError` có message của API.
  - Lỗi mạng phải được bọc thành `NodeApiError`.
  - Operation lạ phải ra `NodeOperationError`.
  - Với `continueOnFail`, item lỗi thành item `error`, và các item sau vẫn chạy.
- Tương thích version: mọi operation của v1 giữ đủ giá trị và không có issue. v2 hiện đúng
  các trường đó.
- Kịch bản theo lỗi người dùng báo: dữ liệu ra từ trigger được đưa thẳng vào action, rồi
  kiểm `chat_id` gửi đi.

### 3.3 Bẫy khi viết test

- **Giá trị mặc định khi destructure:** truyền `secret: undefined` thì vẫn ra giá trị mặc
  định. Muốn mô tả "không có" thì dùng `null`.
- **Spread nông với fixture bọc:** `{ ...fixture, event_name: 'x' }` chỉ ghi ở cấp ngoài.
  Khi fixture có lớp `result`, hãy sửa `body.result.event_name`.
  `fixture()` trả về `structuredClone` để test này không làm bẩn test khác.
- **Kiểm rằng test bắt được lỗi:** cố tình làm hỏng code trong `dist/` (ví dụ đổi điều kiện
  lọc thành `if (false)`), chạy test, thấy fail, rồi khôi phục. Đợt này 3 test fail như
  mong đợi.
- **Lint của plugin cũ:** để kiểm một rule có bắt lỗi không, chép bản code cũ từ
  `git show HEAD:...` ra một file tạm trong `nodes/`, lint file đó, rồi xoá.

## 4. Phát hành

- Workflow publish chỉ chạy khi push tag `v*`. Việc bump version trên `main` không tự phát
  hành.
- Thứ tự: sửa → `npm test` → `npm run lint` → `npx @n8n/node-cli@latest lint` →
  `npm pack --dry-run` (kiểm số file) → commit → push `main` → tag `vX.Y.Z` → push tag →
  chờ npm → `npx @n8n/scan-community-package <gói>` → kiểm trang Releases có bản mới.
- Sau khi publish, npm cần vài chục giây đến vài phút mới hiện bản mới
  (`npm view <gói> version --prefer-online`). Trang npmjs.com cache còn lâu hơn.
- **Đẩy lại tag cũ** (ví dụ sau khi viết lại lịch sử) sẽ kích hoạt lại workflow publish cho
  từng tag. Hãy tắt workflow trước bằng `gh workflow disable publish.yml`, đẩy tag, rồi bật
  lại bằng `gh workflow enable publish.yml`.
- Trước khi viết lại lịch sử, sao lưu toàn bộ bằng `git bundle create <file> --all`. Sau khi
  viết lại, kiểm hai điều: `git diff <HEAD cũ> main` phải rỗng, và số commit không đổi.
- **GitHub Releases:** trước đợt này repo có 12 tag nhưng chỉ 1 release (v1.0.10), nên
  trang Releases ghi v1.0.10 là "Latest" dù npm đã ở 2.x. Từ 2.2.0, workflow publish tự tạo
  release sau khi `npm publish`, dùng mục CHANGELOG của đúng version đó.
  - Bước này fail nếu CHANGELOG thiếu mục `## X.Y.Z`. Lúc đó gói đã lên npm rồi, nên chỉ cần
    bổ sung CHANGELOG và tạo release bằng tay.
  - Link tương đối `](docs/...)` được đổi sang link tuyệt đối theo tag, vì trang Releases
    không hiểu link tương đối.
  - Script của bước này có thể chạy thử trên máy: lấy khối `run` ra, thay
    `gh release create` bằng `echo`.
- Commit, tag và PR không ghi công cho công cụ hay AI. Không thêm dòng
  `Co-Authored-By` cho công cụ.

## 5. Nội dung công khai (README, docs, fixture)

- **Không đăng dữ liệu thật,** kể cả khi đã che một phần. Giữ cấu trúc, tiền tố và độ dài,
  rồi bịa mọi giá trị: ID, message_id, ngày giờ, tên, nội dung. Một ID người dùng thật đã
  nằm trong README từ các bản cũ trên npm, và không gỡ được nữa.
- **Mỗi câu khẳng định phải ghi rõ mức kiểm chứng:**
  - "đã thử" là chúng tôi đã chạy thật.
  - "theo tài liệu Zalo" là chỉ đọc tài liệu.
  - "chưa kiểm" là chưa có căn cứ.

  Bản nháp hướng dẫn đầu tiên có ba câu nói mạnh hơn mức đã kiểm, và phải sửa trước khi
  commit.
- Đọc lại bản nháp chỉ để tìm câu khẳng định không có căn cứ. Lượt đọc này khác với lượt
  sửa câu chữ.

## 6. Checklist trước khi tag

- [ ] `npm view @n8n/eslint-plugin-community-nodes version` khớp với devDependency
- [ ] `npm test` qua
- [ ] `npm run lint`: không có error, và không có warning của `@n8n/community-nodes`
- [ ] `npx @n8n/node-cli@latest lint` exit 0
- [ ] README không còn ký tự tiếng Việt
- [ ] `npm pack --dry-run`: chỉ có `dist/`, số file như mong đợi
- [ ] Fixture và ví dụ không chứa dữ liệu thật
- [ ] Tham số mới có giá trị dự phòng cho workflow cũ; đổi bố cục thì dùng versioned node
- [ ] CHANGELOG có mục `## X.Y.Z` khớp `package.json` (bước tạo release cần mục này)
- [ ] Message commit và tag không ghi công cho công cụ hay AI
