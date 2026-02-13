/**
 * packages/apps/console/client/src/pages/account-page.tsx
 * Account surface: profile + preferences ("my stuff") + connection status.
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserProfileSheet } from "@/components/user-profile-sheet";
import type { UserProfile } from "@shared/schema";
import { useAccountPreferences } from "@/features/account/use-account-preferences";

type IntegrationStatusResponse = {
  integrations: Record<string, { configured: boolean; webhookVerified: boolean }>;
};

type WorkbenchCostResponse = {
  budgetKey: string;
  totals: { usd: number; inputTokens: number; outputTokens: number };
  policy: { hardLimitUsd: number; window: string } | null;
};

const DEFAULT_ACCOUNT_IDENTIFIER_STORAGE_KEY = "harmony.account.identifier.v1";

function safeLocalStorageGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  const ls: any = (window as any).localStorage;
  if (!ls || typeof ls.getItem !== "function") return null;
  try {
    return ls.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  const ls: any = (window as any).localStorage;
  if (!ls || typeof ls.setItem !== "function") return;
  try {
    ls.setItem(key, value);
  } catch {
    // ignore
  }
}

export default function AccountPage(): JSX.Element {
  const [identifier, setIdentifier] = React.useState<string>(() => {
    if (typeof window === "undefined") return "U001";
    return safeLocalStorageGet(DEFAULT_ACCOUNT_IDENTIFIER_STORAGE_KEY) ?? "U001";
  });

  const [profileSheetOpen, setProfileSheetOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"my-stuff" | "connections" | "budgets">("my-stuff");
  const [loadSeq, setLoadSeq] = React.useState(0);

  const prefs = useAccountPreferences();
  const [policyHardLimitUsd, setPolicyHardLimitUsd] = React.useState<string>("");
  const [policyWindow, setPolicyWindow] = React.useState<"run" | "day">("run");
  const [policyStatus, setPolicyStatus] = React.useState<"idle" | "saving" | "error">("idle");
  const [policyError, setPolicyError] = React.useState<string | null>(null);

  const profileQuery = useQuery<UserProfile>({
    queryKey: ["/api/users", identifier, "profile"],
    enabled: Boolean(identifier) && (profileSheetOpen || loadSeq > 0),
  });

  const integrationsQuery = useQuery<IntegrationStatusResponse>({
    queryKey: ["/api/integrations/status"],
    enabled: activeTab === "connections",
  });

  const costQuery = useQuery<WorkbenchCostResponse>({
    queryKey: prefs.defaultBudgetKey
      ? [`/api/workbench/cost?budgetKey=${encodeURIComponent(prefs.defaultBudgetKey)}`]
      : ["__workbench_cost_disabled__"],
    enabled: activeTab === "budgets" && !!prefs.defaultBudgetKey,
    refetchInterval: 10000,
  });

  return (
    <div data-testid="account-page" className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Account</h1>
          <div className="text-sm text-muted-foreground">
            Profile, connections, and “my stuff” (saved workflows, dashboards, budgets).
          </div>
        </div>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="account-identifier">User identifier</Label>
            <Input
              id="account-identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="U001 or username"
            />
            <div className="text-xs text-muted-foreground">
              Used for `GET /api/users/:identifier/profile` (userId or username).
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                safeLocalStorageSet(DEFAULT_ACCOUNT_IDENTIFIER_STORAGE_KEY, identifier);
                setLoadSeq((n) => n + 1);
              }}
            >
              Load
            </Button>
            <Button
              onClick={() => {
                safeLocalStorageSet(DEFAULT_ACCOUNT_IDENTIFIER_STORAGE_KEY, identifier);
                setLoadSeq((n) => n + 1);
                setProfileSheetOpen(true);
              }}
              disabled={!identifier}
            >
              View profile
            </Button>
          </div>
        </div>

        {profileQuery.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading profile…</div>
        ) : profileQuery.data ? (
          <div className="text-sm">
            <div className="font-mono text-xs text-muted-foreground">userId</div>
            <div className="font-mono">{profileQuery.data.userId}</div>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="rounded-md border p-2">
                <div className="text-muted-foreground">Events</div>
                <div className="font-mono text-sm">{profileQuery.data.stats.totalEvents}</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-muted-foreground">Logs (week)</div>
                <div className="font-mono text-sm">{profileQuery.data.stats.logsThisWeek}</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-muted-foreground">Blockers resolved</div>
                <div className="font-mono text-sm">{profileQuery.data.stats.blockersResolved}</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-muted-foreground">Decisions</div>
                <div className="font-mono text-sm">{profileQuery.data.stats.decisionsLogged}</div>
              </div>
            </div>
          </div>
        ) : profileQuery.isError ? (
          <div className="text-sm text-destructive">Failed to load profile.</div>
        ) : (
          <div className="text-sm text-muted-foreground">No profile found.</div>
        )}
      </Card>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="my-stuff">My stuff</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
        </TabsList>

        <TabsContent value="my-stuff" className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="text-sm font-medium">Saved workflows</div>
            {prefs.savedWorkflows.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nothing saved yet.</div>
            ) : (
              <ul className="text-sm space-y-2">
                {prefs.savedWorkflows.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono truncate">{w.name}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate">{w.id}</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => prefs.removeSavedWorkflow(w.id)}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="text-xs text-muted-foreground">
              TODO: Persist server-side (Account API) instead of localStorage.
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-sm font-medium">Saved dashboards</div>
            {prefs.savedDashboards.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nothing saved yet.</div>
            ) : (
              <ul className="text-sm space-y-2">
                {prefs.savedDashboards.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono truncate">{d.name}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate">{d.id}</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => prefs.removeSavedDashboard(d.id)}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="text-xs text-muted-foreground">
              TODO: Persist server-side (Account API) instead of localStorage.
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="connections" className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="text-sm font-medium">Integration status</div>
            {integrationsQuery.isLoading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : integrationsQuery.data?.integrations ? (
              <ul className="text-sm space-y-2">
                {Object.entries(integrationsQuery.data.integrations).map(([source, s]) => (
                  <li key={source} className="flex items-center justify-between gap-3">
                    <div className="font-mono">{source}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      configured:{String(s.configured)} webhookVerified:{String(s.webhookVerified)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted-foreground">No integration data.</div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="budgets" className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="text-sm font-medium">Default chat budget</div>
            <div className="text-xs text-muted-foreground">
              This is a UI-only preference today; server already tracks LLM usage keyed by `budgetKey`.
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="account-budget-key">Budget key</Label>
                <Input
                  id="account-budget-key"
                  value={prefs.defaultBudgetKey ?? ""}
                  onChange={(e) => prefs.setDefaultBudgetKey(e.target.value)}
                  placeholder="user:U001 or session:…"
                />
              </div>
              <Button variant="outline" onClick={() => prefs.clearDefaultBudgetKey()}>
                Clear
              </Button>
            </div>
            {prefs.defaultBudgetKey ? (
              <div className="rounded-md border p-3 space-y-3">
                <div className="text-xs text-muted-foreground font-mono">
                  /api/workbench/cost • key:{prefs.defaultBudgetKey}
                </div>
                {costQuery.isLoading ? (
                  <div className="text-sm text-muted-foreground">Loading spend…</div>
                ) : costQuery.data ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-md border p-2">
                        <div className="text-muted-foreground">USD</div>
                        <div className="font-mono text-sm">{Number(costQuery.data.totals.usd ?? 0).toFixed(4)}</div>
                      </div>
                      <div className="rounded-md border p-2">
                        <div className="text-muted-foreground">Input tokens</div>
                        <div className="font-mono text-sm">{costQuery.data.totals.inputTokens ?? 0}</div>
                      </div>
                      <div className="rounded-md border p-2">
                        <div className="text-muted-foreground">Output tokens</div>
                        <div className="font-mono text-sm">{costQuery.data.totals.outputTokens ?? 0}</div>
                      </div>
                    </div>

                    <div className="rounded-md border p-3 space-y-3">
                      <div className="text-sm font-medium">Hard limit policy</div>
                      <div className="text-xs text-muted-foreground">
                        Configure a hard stop budget enforced server-side for this budget key.
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                        <div className="space-y-2">
                          <Label htmlFor="account-budget-hard-limit">Hard limit (USD)</Label>
                          <Input
                            id="account-budget-hard-limit"
                            value={policyHardLimitUsd}
                            onChange={(e) => setPolicyHardLimitUsd(e.target.value)}
                            placeholder="0.50"
                            inputMode="decimal"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={policyWindow === "run" ? "secondary" : "outline"}
                            onClick={() => setPolicyWindow("run")}
                          >
                            Per run
                          </Button>
                          <Button
                            type="button"
                            variant={policyWindow === "day" ? "secondary" : "outline"}
                            onClick={() => setPolicyWindow("day")}
                          >
                            Per day
                          </Button>
                        </div>
                      </div>
                      {costQuery.data.policy ? (
                        <div className="text-xs text-muted-foreground font-mono">
                          current: ${Number(costQuery.data.policy.hardLimitUsd ?? 0).toFixed(4)} / {costQuery.data.policy.window}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">No policy set.</div>
                      )}
                      {policyStatus === "error" && policyError ? (
                        <div className="text-sm text-destructive">{policyError}</div>
                      ) : null}
                      <Button
                        type="button"
                        disabled={policyStatus === "saving"}
                        onClick={async () => {
                          const hardLimit = Number(policyHardLimitUsd);
                          if (!Number.isFinite(hardLimit) || hardLimit < 0) {
                            setPolicyStatus("error");
                            setPolicyError("Hard limit must be a non-negative number.");
                            return;
                          }
                          setPolicyStatus("saving");
                          setPolicyError(null);
                          try {
                            const res = await fetch("/api/workbench/cost/policy", {
                              method: "POST",
                              headers: { "content-type": "application/json" },
                              credentials: "include",
                              body: JSON.stringify({
                                budgetKey: prefs.defaultBudgetKey,
                                policy: { hardLimitUsd: hardLimit, window: policyWindow },
                              }),
                            });
                            if (!res.ok) {
                              const text = (await res.text()) || res.statusText;
                              throw new Error(`${res.status}: ${text}`);
                            }
                            await costQuery.refetch();
                            setPolicyStatus("idle");
                          } catch (e: any) {
                            setPolicyStatus("error");
                            setPolicyError(String(e?.message ?? e));
                          }
                        }}
                      >
                        Apply policy
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">No spend recorded yet.</div>
                )}
              </div>
            ) : null}
            <div className="text-xs text-muted-foreground">
              TODO: Add server endpoint to persist + report actual spend totals.
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <UserProfileSheet
        username={identifier}
        open={profileSheetOpen}
        onOpenChange={setProfileSheetOpen}
      />
    </div>
  );
}

