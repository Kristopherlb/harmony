/**
 * packages/apps/console/server/lib/cjs-interop.ts
 *
 * Purpose: Normalize CJS/ESM interop for internal workspace packages.
 *
 * In Vitest/TS ESM contexts, `import * as ns from '@golden/pkg'` may expose the
 * actual exports either as named properties OR as `ns.default` (when the
 * package is treated as CJS default export).
 *
 * We prefer named exports when present; otherwise we fall back to `.default`.
 */
export function unwrapCjsNamespace<T>(ns: unknown): T {
  if (ns && typeof ns === 'object') {
    const obj = ns as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => k !== 'default' && k !== '__esModule');
    if ('default' in obj && obj.default && typeof obj.default === 'object') {
      const defaultObj = obj.default as Record<string, unknown>;
      const defaultKeys = Object.keys(defaultObj).filter((k) => k !== 'default' && k !== '__esModule');
      if (defaultKeys.length > keys.length) return obj.default as T;
    }
    if (keys.length > 0) return ns as T;
    if ('default' in obj) return obj.default as T;
  }
  return ns as T;
}

