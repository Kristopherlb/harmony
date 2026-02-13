/**
 * packages/apps/console/client/src/features/workbench/share-draft.ts
 * Encode/decode a BlueprintDraft into a URL-safe string for sharing.
 */
import type { BlueprintDraft } from "./types";
import { isBlueprintDraft } from "./types";

const SHARE_VERSION_PREFIX = "v1:";

function base64UrlEncode(bytes: Uint8Array): string {
  const base64 = typeof Buffer !== "undefined"
    ? Buffer.from(bytes).toString("base64")
    : btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeToBytes(input: string): Uint8Array | null {
  if (!input) return null;

  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

  try {
    if (typeof Buffer !== "undefined") {
      return new Uint8Array(Buffer.from(padded, "base64"));
    }
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * Produces a compact, URL-safe payload.
 *
 * Note: This is intentionally deterministic and versioned so future migrations can be handled.
 */
export function encodeShareDraftPayload(draft: BlueprintDraft): string {
  const json = JSON.stringify(draft);
  const bytes = new TextEncoder().encode(json);
  return `${SHARE_VERSION_PREFIX}${base64UrlEncode(bytes)}`;
}

/**
 * Decodes a payload produced by encodeShareDraftPayload.
 *
 * Returns null if payload is invalid or does not decode into a BlueprintDraft.
 */
export function decodeShareDraftPayload(payload: string): BlueprintDraft | null {
  if (!payload?.startsWith(SHARE_VERSION_PREFIX)) return null;
  const encoded = payload.slice(SHARE_VERSION_PREFIX.length);
  const bytes = base64UrlDecodeToBytes(encoded);
  if (!bytes) return null;

  try {
    const json = new TextDecoder().decode(bytes);
    const parsed: unknown = JSON.parse(json);
    return isBlueprintDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function buildShareDraftUrl(input: { origin: string; payload: string }): string {
  const origin = input.origin.replace(/\/+$/g, "");
  return `${origin}/workbench/shared?d=${encodeURIComponent(input.payload)}`;
}

