// @ts-expect-error - swagger-ui-dist bundle lacks TS types
import SwaggerUIBundle from 'swagger-ui-dist/swagger-ui-bundle.js';
import 'swagger-ui-dist/swagger-ui.css';
import { getProvider, getSessionId } from '../shared/session';

type CreateSessionResponse = { sessionId: string; expiresAt: string };

function modeForPage(): 'embedded' | 'launch' {
  return window.location.pathname.startsWith('/workbench/launch/') ? 'launch' : 'embedded';
}

async function createSession(input: { provider: string }): Promise<string | null> {
  try {
    const res = await fetch('/workbench/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: input.provider, kind: 'openapi', mode: modeForPage() }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as CreateSessionResponse;
    if (!json?.sessionId) return null;

    const u = new URL(window.location.href);
    u.searchParams.set('sessionId', json.sessionId);
    u.searchParams.set('provider', input.provider);
    window.history.replaceState({}, '', u.toString());
    return json.sessionId;
  } catch {
    return null;
  }
}

async function ensureSession(input: { provider: string; sessionId: string }): Promise<string | null> {
  if (input.sessionId && input.sessionId.length >= 16) return input.sessionId;
  return await createSession({ provider: input.provider });
}

async function fetchSpec(input: { provider: string; sessionId: string }): Promise<unknown | null> {
  const sid = await ensureSession(input);
  const sessionId = sid ?? input.sessionId;
  let res = await fetch(`/workbench/openapi/${encodeURIComponent(input.provider)}?sessionId=${encodeURIComponent(sessionId)}`);
  if (res.status === 401 || res.status === 404) {
    const next = await createSession({ provider: input.provider });
    if (next) {
      res = await fetch(`/workbench/openapi/${encodeURIComponent(input.provider)}?sessionId=${encodeURIComponent(next)}`);
    }
  }
  if (!res.ok) return null;
  return await res.json();
}

const provider = getProvider();
const initialSessionId = getSessionId();

// Mount Swagger UI into a DOM node NOT managed by React (otherwise React will wipe the injected DOM).
document.documentElement.style.height = '100%';
document.body.style.height = '100%';
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

const swaggerEl = document.createElement('div');
swaggerEl.id = 'swagger-ui';
swaggerEl.style.height = '100%';
swaggerEl.style.overflow = 'auto';
document.body.appendChild(swaggerEl);

(async () => {
  const spec = await fetchSpec({ provider, sessionId: initialSessionId });
  if (!spec) {
    swaggerEl.innerHTML = '<div style="padding:16px;font-family:ui-monospace,monospace">Failed to load OpenAPI spec.</div>';
    return;
  }

  SwaggerUIBundle({
    spec,
    domNode: swaggerEl,
    deepLinking: true,
  });
})();

