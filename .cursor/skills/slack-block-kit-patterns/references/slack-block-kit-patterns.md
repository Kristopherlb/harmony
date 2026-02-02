<!-- path: .cursor/skills/slack-block-kit-patterns/references/slack-block-kit-patterns.md -->

# Slack Block Kit Patterns Standard (SBK-001)

| Metadata | Value |
| --- | --- |
| ID | SBK-001 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authors | Platform Engineering |
| Context | Slack interactive UX for Harmony HITL + notifications |

## 1. Scope

This standard defines reusable Slack Block Kit message patterns used by Harmony:

- approval request messages (buttons)
- decision/status update messages (replace original)
- error responses (ephemeral)
- modal skeletons for structured inputs

Out of scope: Slack app installation, OAuth, channel policy, and full Slack API client implementation.

## 2. Terms

- **Interactive payload**: Slack callback payload for `block_actions`, `view_submission`, etc.
- **Action contract**: stable `action_id` + `value` encoding interpreted by handlers.
- **Response URL**: Slack-provided URL to respond to an interaction (often for ephemeral responses).
- **chat.update**: Slack API call that edits an existing message.

## 3. Normative requirements

### 3.1 Contract stability

- **REQ-SBK-001**: `action_id` values MUST be stable once released (treat as API).
- **REQ-SBK-002**: `value` MUST contain the primary identifier needed by the handler (e.g., `workflowId`).
- **REQ-SBK-003**: `block_id` SHOULD include the primary identifier for grouping/debugging (e.g., `approval_<workflowId>`).

### 3.2 UX consistency

- **REQ-SBK-010**: Approval requests MUST include:
  - a clear header
  - the reason/context
  - at least two actions (approve/reject)
  - a context footer with policy hints (roles, timeout)

- **REQ-SBK-011**: Terminal updates MUST include:
  - decision + approver identity
  - response duration
  - timestamp + source for audit

### 3.3 Safety

- **REQ-SBK-020**: Interactive handlers MUST verify request signatures (Slack signing secret) in non-local environments.
- **REQ-SBK-021**: Interactive handlers MUST acknowledge within Slack’s timeout window (≤ 3 seconds).

## 4. Templates (copy/paste)

All templates below are valid JSON fragments suitable for `blocks`.

### 4.1 Approval request (buttons)

```json
[
  {
    "type": "header",
    "text": { "type": "plain_text", "text": "🔐 Approval Required", "emoji": true }
  },
  {
    "type": "section",
    "text": { "type": "mrkdwn", "text": "*Reason:* Deploy v2.0.0 to production" }
  },
  {
    "type": "section",
    "fields": [
      { "type": "mrkdwn", "text": "*Requested by:*\nalice@example.com" },
      { "type": "mrkdwn", "text": "*Timeout:*\n30m" }
    ]
  },
  {
    "type": "context",
    "elements": [
      { "type": "mrkdwn", "text": "Required roles: sre, ops-lead" }
    ]
  },
  {
    "type": "actions",
    "block_id": "approval_wf-123",
    "elements": [
      {
        "type": "button",
        "text": { "type": "plain_text", "text": "✅ Approve", "emoji": true },
        "style": "primary",
        "action_id": "approval_approve",
        "value": "wf-123"
      },
      {
        "type": "button",
        "text": { "type": "plain_text", "text": "❌ Reject", "emoji": true },
        "style": "danger",
        "action_id": "approval_reject",
        "value": "wf-123"
      }
    ]
  }
]
```

Implementation reference: `packages/core/src/wcs/approval-signal.ts` (`createApprovalBlocks`).

### 4.2 Terminal result update (replace original)

```json
[
  {
    "type": "header",
    "text": { "type": "plain_text", "text": "✅ Approved", "emoji": true }
  },
  {
    "type": "section",
    "text": { "type": "mrkdwn", "text": "*Original request:* Deploy v2.0.0 to production" }
  },
  {
    "type": "section",
    "fields": [
      { "type": "mrkdwn", "text": "*Approved by:*\nAlice Smith" },
      { "type": "mrkdwn", "text": "*Response time:*\n5m" }
    ]
  },
  {
    "type": "context",
    "elements": [
      { "type": "mrkdwn", "text": "Source: slack | 2026-02-01T10:05:00Z" }
    ]
  }
]
```

Implementation reference: `packages/core/src/wcs/approval-signal.ts` (`createApprovalResultBlocks`).

### 4.3 Error response (ephemeral)

Use for interactive callbacks when you must notify the user immediately.

```json
{
  "response_type": "ephemeral",
  "replace_original": false,
  "text": "❌ Failed to process approval: Workflow not found"
}
```

Implementation reference: `packages/apps/console/server/integrations/http/slack-interactive-handler.ts`.

### 4.4 Modal skeleton (collect a reason)

```json
{
  "type": "modal",
  "callback_id": "approval_reject_reason_v1",
  "title": { "type": "plain_text", "text": "Reject Approval", "emoji": true },
  "submit": { "type": "plain_text", "text": "Submit", "emoji": true },
  "close": { "type": "plain_text", "text": "Cancel", "emoji": true },
  "private_metadata": "wf-123",
  "blocks": [
    {
      "type": "input",
      "block_id": "reason",
      "label": { "type": "plain_text", "text": "Reason", "emoji": true },
      "element": {
        "type": "plain_text_input",
        "action_id": "reason",
        "multiline": true,
        "placeholder": { "type": "plain_text", "text": "Why are you rejecting this request?" }
      }
    }
  ]
}
```

Notes:
- `private_metadata` is the preferred place to carry workflow context for modals.
- Treat `callback_id` and `action_id` as stable contracts (version carefully).

## 5. Handler conventions (non-normative)

- Encode a single stable primary identifier (usually `workflowId`) in:
  - `value` for buttons
  - `private_metadata` for modals
- Keep action ids stable and centralized (e.g., `APPROVAL_ACTION_IDS`).
- Verify Slack signatures using the signing secret in production-like environments.

## 6. Changelog

### 1.0.0

- Initial patterns for approvals, status updates, errors, and modals.

