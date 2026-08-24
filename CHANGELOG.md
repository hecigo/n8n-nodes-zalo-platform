# Changelog

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
