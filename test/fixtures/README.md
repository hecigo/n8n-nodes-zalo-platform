# Fixtures

Webhook bodies with the exact structure of two real Zalo payloads captured on 2026-10-13,
including the `{ ok, result, error_code }` envelope. The trigger unwraps `result`, so
workflows see `{ event_name, message }`.

| File | Captured from |
|------|---------------|
| `private-text.json` | A one-to-one message to the bot. |
| `group-text.json` | A group message that @mentions the bot, sent by the same user. |

Every value is fabricated: IDs, message IDs, dates, names and text. What is kept from the
real capture is the structure, the field order, the `zgr-` prefix and length of the group
ID, and the relation the tests rely on: the private `chat.id` equals `from.id`, the group
`chat.id` does not.

To capture a new one: activate a workflow with **Zalo Bot Trigger**, send the message,
open the execution and copy the trigger output.
