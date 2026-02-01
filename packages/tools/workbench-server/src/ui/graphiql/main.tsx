import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GraphiQL } from 'graphiql';
// GraphiQL v5 relies on CSS variables + base styles (tokens, fonts, editor chrome).
import 'graphiql/style.css';
import 'graphiql/graphiql.css';
import './harmony.css';
import { buildClientSchema, type GraphQLSchema } from 'graphql';
import { getProvider, getSessionId } from '../shared/session';

type CreateSessionResponse = { sessionId: string; expiresAt: string };

function modeForPage(): 'embedded' | 'launch' {
  return window.location.pathname.startsWith('/workbench/launch/') ? 'launch' : 'embedded';
}

function App() {
  const provider = getProvider();
  const [sessionId, setSessionId] = useState<string>(() => getSessionId());
  const [schema, setSchema] = useState<GraphQLSchema | undefined>(undefined);

  async function renewSession(): Promise<string | null> {
    try {
      const res = await fetch('/workbench/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider, kind: 'graphql', mode: modeForPage() }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as CreateSessionResponse;
      if (!json?.sessionId) return null;

      setSessionId(json.sessionId);
      const u = new URL(window.location.href);
      u.searchParams.set('sessionId', json.sessionId);
      u.searchParams.set('provider', provider);
      window.history.replaceState({}, '', u.toString());
      return json.sessionId;
    } catch {
      return null;
    }
  }

  async function ensureSession(): Promise<string | null> {
    if (sessionId && sessionId.length >= 16) return sessionId;
    return await renewSession();
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sid = (await ensureSession()) ?? sessionId;
        let res = await fetch(
          `/workbench/schema/${encodeURIComponent(provider)}?sessionId=${encodeURIComponent(sid)}`
        );
        if (res.status === 401 || res.status === 404) {
          const next = await renewSession();
          if (next) {
            res = await fetch(
              `/workbench/schema/${encodeURIComponent(provider)}?sessionId=${encodeURIComponent(next)}`
            );
          }
        }
        if (!res.ok) return;

        const json = (await res.json()) as { data?: unknown };
        if (!json?.data) return;
        const s = buildClientSchema(json.data as any);
        if (!cancelled) setSchema(s);
      } catch {
        // Ignore; UI still usable without schema.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, sessionId]);

  const fetcher = useMemo(() => {
    return async (graphQLParams: { query?: string; variables?: unknown; operationName?: string }) => {
      const call = async (sid: string) =>
        fetch('/workbench/proxy/graphql', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sessionId: sid,
            query: graphQLParams.query,
            variables: graphQLParams.variables,
            operationName: graphQLParams.operationName,
          }),
        });

      const initial = (await ensureSession()) ?? sessionId;
      let res = await call(initial);
      if (res.status === 401 || res.status === 404) {
        const next = await renewSession();
        if (next) res = await call(next);
      }
      return await res.json();
    };
  }, [provider, sessionId]);

  return (
    <div style={{ height: '100vh' }}>
      <GraphiQL
        fetcher={fetcher as any}
        schema={schema}
        defaultQuery={`query Viewer {\n  viewer {\n    login\n  }\n}\n`}
      />
    </div>
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root');
createRoot(rootEl).render(<App />);

