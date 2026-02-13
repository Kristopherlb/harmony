/**
 * packages/apps/console/client/src/features/workbench/library/local-templates.ts
 * Local (browser) template persistence for Workbench library (Phase 4.4.1).
 */
import type { TemplateDraftLike } from "@/features/workbench/template-insertion";

const STORAGE_KEY = "harmony.workbench.localTemplates.v1";
const memoryStorage = new Map<string, string>();
const UPDATED_EVENT = "harmony.workbench.localTemplates.updated";

function getStorage(): {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
} | null {
  if (typeof window === "undefined") return null;
  const ls: any = window.localStorage as any;
  if (ls && typeof ls.getItem === "function" && typeof ls.setItem === "function") {
    return {
      getItem: (k) => ls.getItem(k),
      setItem: (k, v) => ls.setItem(k, v),
      removeItem: (k) => (typeof ls.removeItem === "function" ? ls.removeItem(k) : ls.setItem(k, "")),
    };
  }
  // Test environments sometimes provide an incomplete localStorage shim.
  return {
    getItem: (k) => memoryStorage.get(k) ?? null,
    setItem: (k, v) => void memoryStorage.set(k, v),
    removeItem: (k) => void memoryStorage.delete(k),
  };
}

function safeParseJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function isTemplateDraftLike(input: unknown): input is TemplateDraftLike {
  const obj = input as Partial<TemplateDraftLike> | null;
  return Boolean(
    obj &&
      typeof obj === "object" &&
      typeof obj.id === "string" &&
      typeof obj.name === "string" &&
      typeof obj.description === "string" &&
      typeof obj.title === "string" &&
      typeof obj.summary === "string" &&
      Array.isArray(obj.nodes) &&
      Array.isArray(obj.edges)
  );
}

export function loadLocalTemplates(): TemplateDraftLike[] {
  if (typeof window === "undefined") return [];
  const storage = getStorage();
  if (!storage) return [];
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = safeParseJson(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isTemplateDraftLike);
}

export function saveLocalTemplate(template: TemplateDraftLike): void {
  if (typeof window === "undefined") return;
  const storage = getStorage();
  if (!storage) return;
  const existing = loadLocalTemplates();
  const next = [
    template,
    ...existing.filter((t) => t.id !== template.id),
  ];
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  try {
    window.dispatchEvent(new Event(UPDATED_EVENT));
  } catch {
    // noop
  }
}

export function clearLocalTemplates(): void {
  if (typeof window === "undefined") return;
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(STORAGE_KEY);
  try {
    window.dispatchEvent(new Event(UPDATED_EVENT));
  } catch {
    // noop
  }
}

export function getLocalTemplatesUpdatedEventName(): string {
  return UPDATED_EVENT;
}

