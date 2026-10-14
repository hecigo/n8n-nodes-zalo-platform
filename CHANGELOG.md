# Changelog

## 2.2.0

Fixes from n8n's review of the 2.1.0 submission. Existing workflows behave exactly as before.

- **Zalo Bot** now has two versions. New nodes use v2, which groups the nine operations
  under a **Resource**: Bot (Get Info, Get Updates), Message (Send Chat Action, Send
  Message, Send Photo, Send Sticker) and Webhook (Delete, Get Info, Set). Nodes saved on v1
  keep the flat operation list. Operation values and all other parameters are identical in
  both versions, and tests resolve every v1 operation through n8n's own parameter logic to
  confirm no saved value is dropped.
- README is English only. The Vietnamese UI labels from Zalo are given in English, and the
  group chat guide is linked as "Group Chat Guide (Vietnamese)".
- `@n8n/eslint-plugin-community-nodes` raised to the version n8n's scanner runs, so
  `npm run lint` reports the same errors as the review.

## 2.1.0

Group chats. Existing workflows behave exactly as before.

- **Zalo Bot Trigger** has a new **Chat Type** filter: All (default), Private or Group.
  It reads `message.chat.chat_type`. Workflows saved before this version have no value
  for it and keep receiving every message.
- The trigger shows a notice, and the **Chat ID** field on Zalo Bot now explains it too:
  to reply in the same conversation use `message.chat.id`. `message.from.id` is the
  sender, so replying to it from a group sends the answer to their private inbox. This
  was the cause of a "bot only answers me privately" report.
- README: a section on using the bot in a group (added by the group owner through the
  invite link from Zalo Bot Creator; triggered by an @mention or a reply to the bot;
  still in Zalo's internal testing), a group payload sample, and Troubleshooting rows.
- New guide, in Vietnamese: [docs/huong-dan-chat.md](docs/huong-dan-chat.md). It covers
  private and group chats, `chat.id` versus `from.id`, adding the bot through the invite
  link, choosing between the Chat Type filter and a Switch, AI Agent memory keys, known
  limits and troubleshooting.
- Test suite (`npm test`, Node's built-in runner, no new dependencies) covering webhook
  verification, the event and chat type filters (against real private and group payloads), the webhook lifecycle, request mapping
  for every operation, and error handling. CI runs it on every push.

## 2.0.1

Documentation only. The node code is unchanged from 2.0.0.

Links in this README that point at hecigo.com now carry attribution parameters, so we can see
which of our own links people actually follow. This collects nothing about you personally: what
gets recorded is the link code, the page it led to, and the country Cloudflare works out at its
own edge. No IP address, no user agent, no referring page, and the record is deleted after three
months. Full detail at https://hecigo.com/privacy/

## 2.0.0

**Requires n8n >= 1.83.** The nodes now use `NodeConnectionTypes.Main` instead of the
string literal `"main"`, as n8n's verification guidelines require. That symbol first
shipped in `n8n-workflow@1.83.0`, so on older n8n this package no longer loads. If you
cannot upgrade n8n, stay on `1.0.13`.

**Nothing else in your workflows has to change.** Operation names, parameter names and
output shapes are unchanged. The operation dropdown is now sorted alphabetically, but the
stored values are the same, only the display order moved.

Changes:

- Errors that are not already n8n errors (network failures, timeouts, malformed
  responses) are wrapped in `NodeApiError`, so the HTTP context reaches the UI instead
  of surfacing as a raw throw. API-level failures (`ok: false`) now also raise
  `NodeApiError`, carrying `error_code` and `description` from Zalo.
- The trigger no longer swallows webhook lifecycle errors. `checkExists` raises when the
  Zalo API is unreachable, rather than reporting "not registered" and hiding the outage.
  `delete` still never blocks deactivation, but logs a warning so a webhook left
  registered with Zalo is visible.
- `Zalo Bot` is marked `usableAsTool`, so it can be attached to an AI Agent.
- Light and dark icon variants for both nodes and for the credential.
- The credential now carries an icon.
- `ZaloBot.node.json` (the codex metadata: category and documentation links) is copied
  into `dist` by the build. It had never been shipped, so n8n never saw it. Its `node`
  field also carries the correct package prefix now.

## 1.0.13 and earlier

See the [release history](https://github.com/hecigo/n8n-nodes-zalo-platform/releases).
