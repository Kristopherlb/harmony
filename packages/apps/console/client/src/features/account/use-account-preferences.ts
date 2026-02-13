import React from "react";

type SavedItem = { id: string; name: string };

type AccountPreferencesV1 = {
  savedWorkflows: SavedItem[];
  savedDashboards: SavedItem[];
  defaultBudgetKey: string | null;
};

const STORAGE_KEY = "harmony.account.preferences.v1";

function readPrefs(): AccountPreferencesV1 {
  if (typeof window === "undefined") {
    return { savedWorkflows: [], savedDashboards: [], defaultBudgetKey: null };
  }
  try {
    const ls: any = (window as any).localStorage;
    if (!ls || typeof ls.getItem !== "function") {
      return { savedWorkflows: [], savedDashboards: [], defaultBudgetKey: null };
    }
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return { savedWorkflows: [], savedDashboards: [], defaultBudgetKey: null };
    const parsed = JSON.parse(raw) as Partial<AccountPreferencesV1>;
    return {
      savedWorkflows: Array.isArray(parsed.savedWorkflows) ? parsed.savedWorkflows : [],
      savedDashboards: Array.isArray(parsed.savedDashboards) ? parsed.savedDashboards : [],
      defaultBudgetKey: typeof parsed.defaultBudgetKey === "string" ? parsed.defaultBudgetKey : null,
    };
  } catch {
    return { savedWorkflows: [], savedDashboards: [], defaultBudgetKey: null };
  }
}

function writePrefs(prefs: AccountPreferencesV1) {
  if (typeof window === "undefined") return;
  const ls: any = (window as any).localStorage;
  if (!ls || typeof ls.setItem !== "function") return;
  ls.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function useAccountPreferences() {
  const [prefs, setPrefs] = React.useState<AccountPreferencesV1>(() => readPrefs());

  const update = React.useCallback((fn: (p: AccountPreferencesV1) => AccountPreferencesV1) => {
    setPrefs((prev) => {
      const next = fn(prev);
      writePrefs(next);
      return next;
    });
  }, []);

  return {
    savedWorkflows: prefs.savedWorkflows,
    savedDashboards: prefs.savedDashboards,
    defaultBudgetKey: prefs.defaultBudgetKey,

    addSavedWorkflow: (item: SavedItem) =>
      update((p) => ({
        ...p,
        savedWorkflows: [...p.savedWorkflows.filter((w) => w.id !== item.id), item],
      })),
    removeSavedWorkflow: (id: string) =>
      update((p) => ({
        ...p,
        savedWorkflows: p.savedWorkflows.filter((w) => w.id !== id),
      })),

    addSavedDashboard: (item: SavedItem) =>
      update((p) => ({
        ...p,
        savedDashboards: [...p.savedDashboards.filter((d) => d.id !== item.id), item],
      })),
    removeSavedDashboard: (id: string) =>
      update((p) => ({
        ...p,
        savedDashboards: p.savedDashboards.filter((d) => d.id !== id),
      })),

    setDefaultBudgetKey: (key: string) =>
      update((p) => ({
        ...p,
        defaultBudgetKey: key.trim().length ? key : null,
      })),
    clearDefaultBudgetKey: () => update((p) => ({ ...p, defaultBudgetKey: null })),
  };
}

