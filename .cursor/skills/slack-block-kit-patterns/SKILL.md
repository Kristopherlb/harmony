---
name: slack-block-kit-patterns
description: Common Slack Block Kit patterns for approvals, status updates, forms, and error messages (Harmony conventions).
---

# Slack Block Kit Patterns (SBK-001)

Use this skill when generating Slack **interactive messages** (buttons, modals) or **structured notifications** that must be consistent and easy for handlers/workflows to interpret.

## When to Use

- HITL approval requests and decision confirmations (buttons)
- Status updates (replace/update the original message)
- Notifications and error responses (ephemeral vs in-channel)
- Modals for collecting structured input (reason, change request, etc.)

## Instructions

1. **Use a consistent block structure**
   - Prefer: `header` → `section` (reason/details) → `section.fields` (metadata) → `actions` → `context`.
   - Keep text short; put details in fields/context.

2. **Encode workflow context deterministically**
   - Use button `value` for the primary identifier (e.g., `workflowId`).
   - Use `block_id` as a stable grouping key (e.g., `approval_<workflowId>`).
   - Keep `action_id` stable and versionless (contracts used by handlers).
   - Example reference: `packages/core/src/wcs/approval-signal.ts` (`APPROVAL_ACTION_IDS`, `createApprovalBlocks`).

3. **Choose the right response mechanism**
   - For interactive callbacks, respond within 3 seconds.
   - Prefer: acknowledge callback (`{ ok: true }`) and let the workflow update the message asynchronously.
   - If you must respond immediately, use an ephemeral response describing next steps.

4. **Use predictable status updates**
   - Update the original message with a terminal result (approved/rejected/error).
   - Include a timestamp + source in a `context` block for auditability.

5. **Keep templates JSON-serializable**
   - Blocks are plain objects only; avoid runtime-only types/classes.
   - Use `mrkdwn` for formatted fields, `plain_text` for headers/buttons.

## References

- `references/slack-block-kit-patterns.md`
- `packages/core/src/wcs/approval-signal.ts`
- `packages/apps/console/server/integrations/http/slack-interactive-handler.ts`

