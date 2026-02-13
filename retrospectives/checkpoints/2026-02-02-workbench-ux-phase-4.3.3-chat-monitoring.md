# Checkpoint: Workbench UX Phase 4.3.3 – Chat-Driven Execution Monitoring

**Date:** 2026-02-02  
**Scope:** Phase 4.3.3 Chat-Driven Execution Monitoring + retro checkpoint

## Summary

- **execution-monitor.ts** (server): `getExecutionStatus(workflowId)`, `formatExecutionStatusForChat(describe)`, `cancelExecution(workflowId)`, `isStatusQuery(text)`, `isCancelQuery(text)`.
- **POST /api/workflows/:id/cancel**: Terminates workflow via Temporal handle.terminate().
- **Chat**: Request body accepts `activeWorkflowId`. When the last user message is a status query (e.g. "what's the status?") or cancel query (e.g. "cancel the workflow"), the server injects execution context (status text or cancel result) into the message so the agent can answer.
- **AgentChatPanel** and **workbench-page**: Pass `activeWorkflowId` into chat body so status/cancel queries use the current run.

## Files changed

- `packages/apps/console/server/agent/execution-monitor.ts` (new)
- `packages/apps/console/server/http/workflows-router.ts` (POST /:id/cancel)
- `packages/apps/console/server/routers/chat-router.ts` (activeWorkflowId in body)
- `packages/apps/console/server/services/openai-agent-service.ts` (inject status/cancel context)
- `packages/apps/console/client/src/features/workbench/agent-chat-panel.tsx` (activeWorkflowId prop and body)
- `packages/apps/console/client/src/pages/workbench-page.tsx` (pass activeWorkflowId to AgentChatPanel)

## Deferred

- Pause (suspend) workflow via chat; only cancel (terminate) implemented.
- Streaming execution updates in chat (e.g. periodic status lines); current behavior is one-shot context injection.
