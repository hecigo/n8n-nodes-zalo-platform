# n8n-nodes-zalo-platform

[![npm version](https://img.shields.io/npm/v/n8n-nodes-zalo-platform)](https://www.npmjs.com/package/n8n-nodes-zalo-platform) [![npm downloads](https://img.shields.io/npm/dm/n8n-nodes-zalo-platform)](https://www.npmjs.com/package/n8n-nodes-zalo-platform) [![license](https://img.shields.io/npm/l/n8n-nodes-zalo-platform)](LICENSE)

Community node for [Zalo Bot Platform](https://bot.zaloplatforms.com) on n8n. Automate Zalo Bot interactions: receive messages via webhook, send replies, photos, stickers, and chat actions.

**Verified by n8n**, so it installs from the nodes panel on **n8n Cloud** as well as self-hosted. [Unverified community nodes cannot run on n8n Cloud](https://docs.n8n.io/integrations/community-nodes/installation-and-management/).

Built by [hecigo](https://hecigo.com/go/hm-np-readme?i=zalo) — Middleware & Integration Lab.

**Guides:** [Running a Zalo bot on n8n: what breaks in production](https://hecigo.com/blog/n8n-zalo-bot-node-what-breaks-in-production/?utm_source=npm&utm_medium=referral&utm_content=readme-zalo) (English) · [Detailed Guide](https://hecigo.com/blog/toi-uu-tu-dong-hoa-zalo-bot-voi-n8n-huong-dan-chi-tiet-tu-hecigo?utm_source=npm&utm_medium=referral&utm_content=readme-zalo) (Vietnamese) · [Group Chat Guide](https://github.com/hecigo/n8n-nodes-zalo-platform/blob/main/docs/huong-dan-chat.md) (Vietnamese)

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

**Chat type filtering:**

| Option | Value | Passes Through |
|--------|-------|----------------|
| All | `all` | Private and group messages (default) |
| Private | `PRIVATE` | One-to-one messages only |
| Group | `GROUP` | Group messages only |

Zalo posts `{ "ok": true, "result": { ... }, "error_code": 0 }`. The trigger unwraps
`result`, so its output starts at `event_name` and every expression below begins with
`$json.message`, not `$json.result.message`.

**Sample output:**

```json
{
  "event_name": "message.text.received",
  "message": {
    "date": 1791900030000,
    "chat": { "chat_type": "PRIVATE", "id": "5c1e9a7d3b2f48a6e0d4" },
    "message_id": "d92b04f6e1a7c3580b4e",
    "from": { "id": "5c1e9a7d3b2f48a6e0d4", "is_bot": false, "display_name": "Nguyen Van A" },
    "text": "Xin chao"
  }
}
```

**Useful expressions:**

| Expression | Returns |
|------------|---------|
| `{{ $json.message.chat.id }}` | Chat ID (use to reply) |
| `{{ $json.message.chat.chat_type }}` | `PRIVATE` or `GROUP` |
| `{{ $json.message.from.id }}` | Sender's user ID (not for replying in a group) |
| `{{ $json.message.text }}` | Message content |
| `{{ $json.message.from.display_name }}` | Sender name |
| `{{ $json.event_name }}` | Event type |

#### Using the bot in a group

Full walkthrough, including AI Agent memory per chat and per sender (Vietnamese):
[Group Chat Guide](https://github.com/hecigo/n8n-nodes-zalo-platform/blob/main/docs/huong-dan-chat.md).

Zalo lists group chats as **in internal testing**,
so the invite option may not be available for every bot or account yet. Official guide:
[Zalo Bot interaction with group chats](https://bot.zapps.me/docs/build-bot-interaction-with-group/).

1. **Add the bot through its invite link, not through "Add member".** Open the
   **Zalo Bot Creator** mini app, pick the bot, and in the **Invite bot to group** section share or
   copy the link into the group. A **group admin** (Zalo's guide says the group owner)
   taps the link and confirms **Add Bot to Group**. A regular member
   cannot add the bot. The bot then posts a joined message in the group.
2. **@mention the bot, or reply to one of its messages.** Zalo sends a group message to
   the webhook only in those two cases, so ordinary chatter in the group never reaches n8n.
3. Check the execution: a group message has `"chat_type": "GROUP"` and a `chat.id`
   that belongs to the group.
3. Set **Chat ID** in the Zalo Bot node to `{{ $json.message.chat.id }}`.

`chat.id` is the conversation and `from.id` is the person who sent the message. In a
private chat the two are equal, which is why they look the same in your first tests.
In a group they differ: replying to `from.id` sends the answer to that person's private
inbox instead of the group.

Group sample (real payload, same sender as the private sample above):

```json
{
  "event_name": "message.text.received",
  "message": {
    "date": 1791900000000,
    "chat": { "chat_type": "GROUP", "id": "zgr-7e3d9b1a5c2f80e4d6a1" },
    "message_id": "a41c7e9d03b6f25e8d17",
    "from": { "id": "5c1e9a7d3b2f48a6e0d4", "is_bot": false, "display_name": "Nguyen Van A" },
    "text": "@Bot MyShop xin chao"
  }
}
```

Group IDs seen so far start with `zgr-`, while user IDs are plain hex. If the Chat ID you
send to does not start with `zgr-`, the reply is going to a private inbox.

### Zalo Bot (Action)

9 operations, all using `POST` requests to `https://bot-api.zaloplatforms.com/bot{TOKEN}/{method}`.

Since 2.2.0 the node has two versions. New nodes use **v2**, which groups the operations
under a **Resource**. Nodes saved earlier stay on **v1** with the flat operation list and
keep working unchanged. Operation values and parameters are the same in both versions.

| Resource (v2) | Operations |
|---------------|------------|
| Bot | Get Info (`getMe`), Get Updates (`getUpdates`) |
| Message | Send Chat Action, Send Message, Send Photo, Send Sticker |
| Webhook | Delete (`deleteWebhook`), Get Info (`getWebhookInfo`), Set (`setWebhook`) |

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

### n8n Cloud

Search for **Zalo Bot** in the nodes panel on the canvas. Verified nodes are
installed on first use, with no Settings step and no risk prompt.

### Self-hosted n8n

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
3. Tap **"Create Bot"**
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
| Bot replies in private inbox, not the group | Chat ID mapped to `message.from.id` | Use `{{ $json.message.chat.id }}` |
| Cannot add the bot to a group | Group feature still in Zalo's internal testing, or not added by a group admin via the invite link | Use the link from Zalo Bot Creator (Invite bot to group section), tapped by a group admin. If the option is missing, the feature is not open to that bot yet |
| Group messages never trigger | Bot not @mentioned or replied to | Tag the bot, or reply to one of its messages |
| 401 on credential test | Token expired/wrong | Create new bot |
| Test mode spins forever | Workflow still active | Deactivate before testing |
| getUpdates empty | Webhook still registered | Call Delete Webhook first |
| Worker missing node | Only on main instance | Install on all containers |

## Development

```bash
npm install
npm test        # builds, then runs the tests in test/ against dist/
npm run lint    # same rule set as n8n's verification scanner
```

Tests use Node's built-in runner (`node:test`), no extra dependencies. They run against
the compiled nodes in `dist/`, the code that ships. Webhook payload fixtures live in
`test/fixtures/`; `group-text.json` is synthetic until a real group payload replaces it.

## Compatibility

- n8n: **>= 1.83**. The nodes import `NodeConnectionTypes` from `n8n-workflow`, which
  first shipped in `n8n-workflow@1.83.0`. On older n8n the node package fails to load.
  Stay on `1.0.13` if you cannot upgrade n8n.
- Zalo Bot Platform API

## About

[hecigo](https://hecigo.com/go/hm-np-readme?i=zalo) is a middleware and integration lab. We build and run the layer that makes disconnected business systems talk to each other — with the right data, and nothing lost. Need custom n8n nodes or middleware consulting? [Get in touch](https://hecigo.com/go/ct-np-readme?i=zalo).

**Other n8n nodes by hecigo:** [n8n-nodes-firecrawl-v2](https://github.com/hecigo/n8n-nodes-firecrawl-v2) — scrape, crawl, map, search and AI extraction against Firecrawl v2. Self-hosted n8n only.

Consulting partner: [THE NEXOVA](https://thenexova.com) — Bridge Strategy to Execution.

## License

[MIT](LICENSE)
