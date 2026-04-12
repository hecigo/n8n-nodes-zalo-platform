# n8n-nodes-zalo-platform

Community node for [Zalo Bot Platform](https://bot.zaloplatforms.com) on n8n. Automate Zalo Bot interactions: receive messages via webhook, send replies, photos, stickers, and chat actions.

Built by [hecigo](https://hecigo.com) — Middleware Lab for Global Expansion.

**Guides:** [Setup Guide (EN)](https://thenexova.com/n8n-zalo-bot-node-complete-setup-and-operations-guide/) | [Hướng dẫn chi tiết (VI)](https://hecigo.com/blog/toi-uu-tu-dong-hoa-zalo-bot-voi-n8n-huong-dan-chi-tiet-tu-hecigo)

## Nodes

### Zalo Bot Trigger

Receives incoming messages via webhook. Webhook URL and secret token are managed automatically.

When a workflow is activated, the node:

1. Registers a webhook URL with Zalo (`POST /setWebhook`)
2. Derives a secret token: `SHA256(botToken).hex().substring(0, 32)`
3. Validates incoming requests via `X-Bot-Api-Secret-Token` header
4. Cleans up on deactivation (`POST /deleteWebhook`)

**Event filtering:**

| Option | Value | Passes Through |
|--------|-------|----------------|
| Any Message | `anyMessage` | All message types |
| Text Message | `message.text.received` | Text only |
| Image Message | `message.image.received` | Images only |
| Sticker Message | `message.sticker.received` | Stickers only |

**Sample output:**

```json
{
  "event_name": "message.text.received",
  "message": {
    "date": 1775362520302,
    "chat": { "chat_type": "PRIVATE", "id": "818e7bf147beaee0f7af" },
    "message_id": "261de7b845d153890ac6",
    "from": { "id": "818e7bf147beaee0f7af", "is_bot": false, "display_name": "Nguyen Van A" },
    "text": "Xin chao"
  }
}
```

**Useful expressions:**

| Expression | Returns |
|------------|---------|
| `{{ $json.message.chat.id }}` | Chat ID (use to reply) |
| `{{ $json.message.text }}` | Message content |
| `{{ $json.message.from.display_name }}` | Sender name |
| `{{ $json.event_name }}` | Event type |

### Zalo Bot (Action)

9 operations, all using `POST` requests to `https://bot-api.zaloplatforms.com/bot{TOKEN}/{method}`.

#### Send Message

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chatId` | String | Yes | User ID or Group ID |
| `text` | String | Yes | Message content, max 2000 characters |

Request body: `{ "chat_id": "...", "text": "..." }`

#### Send Photo

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chatId` | String | Yes | User ID or Group ID |
| `photo` | String | Yes | HTTPS image URL |
| `caption` | String | No | Caption, max 2000 characters |

#### Send Chat Action

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chatId` | String | Yes | User ID or Group ID |
| `action` | Options | Yes | `typing` (bot is typing) or `upload_photo` (bot is uploading a photo) |

Request body: `{ "chat_id": "...", "action": "typing" }`

> Useful before sending a message or photo to show the bot is "thinking".

#### Send Sticker

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chatId` | String | Yes | User ID or Group ID |
| `stickerId` | String | Yes | Sticker ID (e.g., `bfe458bf64fa8da4d4eb`) |

> **Note:** UI shows `stickerId` but the API body uses key `"sticker"`. The node handles this mapping.

#### Get Updates (Long Polling)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `timeout` | Number | `30` | Polling timeout in seconds. `0` for immediate. |

> **Important:** `getUpdates` and webhooks are mutually exclusive. Call `Delete Webhook` before using `Get Updates`. The timeout is sent as a string in the request body.

#### Get Bot Info / Set Webhook / Delete Webhook / Get Webhook Info

| Operation | Endpoint | Parameters |
|-----------|----------|------------|
| Get Bot Info | `POST /getMe` | None |
| Set Webhook | `POST /setWebhook` | `webhookUrl` (HTTPS), `secretToken` (8-256 chars) |
| Delete Webhook | `POST /deleteWebhook` | None |
| Get Webhook Info | `POST /getWebhookInfo` | None |

> If you use the Trigger node, you do not need Set/Delete Webhook manually.

## Installation

### n8n Community Nodes

1. Go to **Settings** > **Community Nodes**
2. Select **Install**
3. Enter `n8n-nodes-zalo-platform`
4. Agree to the risks and click **Install**

### Manual (Self-Hosted)

```bash
cd ~/.n8n
npm install n8n-nodes-zalo-platform
```

Restart n8n after installation.

> **Queue/Worker mode:** Install the node on **both** the main instance and all workers. Custom nodes must exist in `~/.n8n/` on every container.

## Creating Your Zalo Bot

1. Open **Zalo** on your phone
2. Search for OA **"Zalo Bot Manager"**
3. Tap **"Tao bot"** (Create bot)
4. Enter a bot name (must start with "Bot", e.g., `Bot MyShop`)
5. Zalo sends your **Bot Token** via message: `{bot_id}:{secret_key}`

## Credentials

| Field | Description |
|-------|-------------|
| Bot Token | Format: `{bot_id}:{secret_key}`. Tested via `POST /getMe`. |

## Cloudflare Configuration

Zalo sends webhooks with `User-Agent: Java/1.8.0_192`. Cloudflare blocks this by default. Create 2 rules:

**Rule 1 - WAF Custom Rule:** Skip all managed rules for URI path contains `/webhook`

**Rule 2 - Configuration Rule:** Disable Browser Integrity Check for URI path contains `/webhook`

> Use `/webhook` (no trailing slash) to cover both `/webhook/...` and `/webhook-test/...` URLs.

## Workflow Examples

**Auto-reply:**

```
Zalo Bot Trigger (Any Message)
  -> IF (event_name == "message.text.received")
    -> Zalo Bot: Send Message (chatId, reply text)
```

**Lead capture:**

```
Zalo Bot Trigger (Text Message)
  -> Google Sheets: Append Row (name, message, timestamp)
  -> Slack: Send notification
```

**Polling (no HTTPS):**

```
Schedule Trigger (every 30s)
  -> Zalo Bot: Delete Webhook (run once)
  -> Zalo Bot: Get Updates (timeout: 25)
  -> IF (has data) -> Process...
```

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Trigger receives nothing | Cloudflare blocks Java UA | Create both Cloudflare rules |
| 401 on credential test | Token expired/wrong | Create new bot |
| Test mode spins forever | Workflow still active | Deactivate before testing |
| getUpdates empty | Webhook still registered | Call Delete Webhook first |
| Worker missing node | Only on main instance | Install on all containers |

## Compatibility

- n8n: >= 1.0.0
- Zalo Bot Platform API

## About

[hecigo](https://hecigo.com) is a middleware lab researching and deploying integration solutions that connect Vietnamese businesses to global systems. Need custom n8n nodes or middleware consulting? [Get in touch](https://hecigo.com/#contact).

Consulting partner: [THE NEXOVA](https://thenexova.com) — Bridge Strategy to Execution.

## License

[MIT](LICENSE)
