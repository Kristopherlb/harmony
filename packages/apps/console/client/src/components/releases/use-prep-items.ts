import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Event } from "@shared/schema";
import type { PrepItem } from "./types";
import { calculateAtRisk } from "./utils";

const DEFAULT_PREP_ITEMS: Omit<PrepItem, "resolver">[] = [
  { 
    id: "release-notes", 
    label: "Release Notes", 
    description: "Documentation of changes and new features", 
    completed: false, 
    atRisk: false,
    manualAtRisk: false,
    resolverType: "automated",
    automatedCheck: {
      type: "jira_ticket",
      config: {
        jql: 'project = "RELEASE" AND summary ~ "Release Notes" AND status = Done',
      },
    },
    deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  },
  { 
    id: "release-plan", 
    label: "Release Plan", 
    description: "Detailed deployment plan and timeline", 
    completed: false, 
    atRisk: false,
    manualAtRisk: false,
    resolverType: "manual",
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  },
  { 
    id: "status-page", 
    label: "Status Page Update", 
    description: "Prepare status page announcement", 
    completed: false, 
    atRisk: false,
    manualAtRisk: false,
    resolverType: "automated",
    automatedCheck: {
      type: "api_check",
      config: {
        apiUrl: "/api/status-page/check",
        expectedStatus: "updated",
      },
    },
    deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
  },
  { 
    id: "predeploys", 
    label: "Pre-Deployments", 
    description: "Complete pre-deployments to staging", 
    completed: false, 
    atRisk: false,
    manualAtRisk: false,
    resolverType: "automated",
    automatedCheck: {
      type: "api_check",
      config: {
        apiUrl: "/api/deployments/staging",
        expectedStatus: "deployed",
      },
    },
    deadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
  },
  { 
    id: "staging-infra", 
    label: "Staging Infrastructure", 
    description: "Verify staging infrastructure readiness", 
    completed: false, 
    atRisk: false,
    manualAtRisk: false,
    resolverType: "manual",
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  },
  { 
    id: "change-control", 
    label: "Change Control Signatures", 
    description: "Obtain required approvals and sign-offs", 
    completed: false, 
    atRisk: false,
    manualAtRisk: false,
    resolverType: "manual",
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  },
  { 
    id: "rollback-plan", 
    label: "Rollback Plan", 
    description: "Document rollback procedures", 
    completed: false, 
    atRisk: false,
    manualAtRisk: false,
    resolverType: "manual",
    deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  },
  { 
    id: "monitoring", 
    label: "Monitoring Setup", 
    description: "Configure alerts and dashboards", 
    completed: false, 
    atRisk: false,
    manualAtRisk: false,
    resolverType: "automated",
    automatedCheck: {
      type: "api_check",
      config: {
        apiUrl: "/api/monitoring/configured",
        expectedStatus: "ready",
      },
    },
    deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  },
];

/**
 * Check Jira ticket status for automated items
 */
async function checkJiraTicket(jql: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/activity/stream`);
    const data = await res.json();
    const jiraEvents = (data.events || []).filter((e: Event) => e.source === "jira");
    return jiraEvents.some((e: Event) => {
      const payload = e.payload as Record<string, unknown>;
      const fields = payload.fields as Record<string, unknown> | undefined;
      const status = fields?.status as Record<string, unknown> | undefined;
      const statusName = (status?.name as string || "").toLowerCase();
      return statusName === "done" || statusName === "closed";
    });
  } catch {
    return false;
  }
}

/**
 * Check API status for automated items
 */
async function checkApiStatus(apiUrl: string, expectedStatus: string): Promise<boolean> {
  try {
    return false; // Mock - in production would call actual API
  } catch {
    return false;
  }
}

export interface UsePrepItemsReturn {
  prepItems: PrepItem[];
  toggleAtRisk: (itemId: string) => void;
  handleManualConfirm: (itemId: string) => void;
  manualConfirmOpen: string | null;
  setManualConfirmOpen: (itemId: string | null) => void;
}

/**
 * Custom hook for managing prep items with interactive resolvers
 */
export function usePrepItems(isOpen: boolean): UsePrepItemsReturn {
  const [manualConfirmOpen, setManualConfirmOpen] = useState<string | null>(null);
  const { toast } = useToast();

  // Load prep items - resolvers will be added after state is initialized
  const [prepItems, setPrepItems] = useState<PrepItem[]>(() => {
    const stored = localStorage.getItem("release-prep-checklist");
    let loadedItems: Omit<PrepItem, "resolver">[] = DEFAULT_PREP_ITEMS;
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedItems = DEFAULT_PREP_ITEMS.map(item => {
            const storedItem = parsed.find((p: { id?: string }) => p.id === item.id);
            if (storedItem) {
              return {
                ...item,
                completed: storedItem.completed ?? item.completed,
                manualAtRisk: storedItem.manualAtRisk ?? item.manualAtRisk,
                deadline: storedItem.deadline ? new Date(storedItem.deadline) : item.deadline,
              };
            }
            return item;
          });
        }
      } catch {
        // Use defaults if parsing fails
      }
    }
    
    // Return items with placeholder resolvers - they'll be replaced in useEffect
    return loadedItems.map(item => {
      const atRisk = calculateAtRisk(item);
      return {
        ...item,
        atRisk,
        resolver: (() => {
          // Silent no-op placeholder - will be replaced in useEffect
        }) as () => void | Promise<void>, // Placeholder
      };
    });
  });

  // Automated resolver factory
  const createAutomatedResolver = useCallback((item: Omit<PrepItem, "resolver">) => {
    return async () => {
      const currentItems = JSON.parse(localStorage.getItem("release-prep-checklist") || "[]");
      const currentItem = currentItems.find((p: { id?: string }) => p.id === item.id) || item;
      const isCompleted = currentItem.completed;

      if (isCompleted) {
        setPrepItems(prev => {
          const updated = prev.map(prevItem => 
            prevItem.id === item.id 
              ? { ...prevItem, completed: false, atRisk: prevItem.manualAtRisk || calculateAtRisk(prevItem) }
              : prevItem
          );
          localStorage.setItem("release-prep-checklist", JSON.stringify(
            updated.map(({ resolver, ...rest }) => rest)
          ));
          return updated;
        });
        return;
      }

      let isComplete = false;
      if (item.automatedCheck?.type === "jira_ticket" && item.automatedCheck.config?.jql) {
        isComplete = await checkJiraTicket(item.automatedCheck.config.jql);
      } else if (item.automatedCheck?.type === "api_check" && item.automatedCheck.config?.apiUrl) {
        isComplete = await checkApiStatus(
          item.automatedCheck.config.apiUrl,
          item.automatedCheck.config.expectedStatus || "ready"
        );
      }

      if (isComplete) {
        setPrepItems(prev => {
          const updated = prev.map(prevItem => 
            prevItem.id === item.id 
              ? { ...prevItem, completed: true, atRisk: false, manualAtRisk: false }
              : prevItem
          );
          localStorage.setItem("release-prep-checklist", JSON.stringify(
            updated.map(({ resolver, ...rest }) => rest)
          ));
          return updated;
        });
        toast({
          title: "Item Completed",
          description: `${item.label} has been automatically marked as complete.`,
        });
      } else {
        setManualConfirmOpen(item.id);
      }
    };
  }, [toast]);

  // Manual resolver factory
  const createManualResolver = useCallback((item: Omit<PrepItem, "resolver">) => {
    return () => {
      const currentItems = JSON.parse(localStorage.getItem("release-prep-checklist") || "[]");
      const currentItem = currentItems.find((p: { id?: string }) => p.id === item.id) || item;
      const isCompleted = currentItem.completed;

      if (isCompleted) {
        setPrepItems(prev => {
          const updated = prev.map(prevItem => 
            prevItem.id === item.id 
              ? { ...prevItem, completed: false, atRisk: prevItem.manualAtRisk || calculateAtRisk(prevItem) }
              : prevItem
          );
          localStorage.setItem("release-prep-checklist", JSON.stringify(
            updated.map(({ resolver, ...rest }) => rest)
          ));
          return updated;
        });
      } else {
        setManualConfirmOpen(item.id);
      }
    };
  }, []);

  // Update resolver functions only once on mount
  const resolversInitialized = useRef(false);
  useEffect(() => {
    if (resolversInitialized.current) return;
    
    setPrepItems(prev => {
      resolversInitialized.current = true;
      return prev.map(item => {
        const baseItem: Omit<PrepItem, "resolver"> = {
          id: item.id,
          label: item.label,
          description: item.description,
          completed: item.completed,
          atRisk: item.atRisk,
          manualAtRisk: item.manualAtRisk,
          resolverType: item.resolverType,
          automatedCheck: item.automatedCheck,
          deadline: item.deadline,
        };
        return {
          ...item,
          resolver: item.resolverType === "automated" 
            ? createAutomatedResolver(baseItem)
            : createManualResolver(baseItem),
        };
      });
    });
  }, [createAutomatedResolver, createManualResolver]);

  // Update at-risk status periodically
  useEffect(() => {
    if (!isOpen) return;
    
    const interval = setInterval(() => {
      setPrepItems(prev => {
        const updated = prev.map(item => {
          const programmaticAtRisk = calculateAtRisk(item);
          return {
            ...item,
            atRisk: item.manualAtRisk || programmaticAtRisk,
          };
        });
        localStorage.setItem("release-prep-checklist", JSON.stringify(
          updated.map(({ resolver, ...rest }) => rest)
        ));
        return updated;
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Handle manual confirmation
  const handleManualConfirm = useCallback((itemId: string) => {
    setPrepItems(prev => {
      const updated = prev.map(item => 
        item.id === itemId 
          ? { ...item, completed: true, atRisk: false, manualAtRisk: false }
          : item
      );
      localStorage.setItem("release-prep-checklist", JSON.stringify(
        updated.map(({ resolver, ...rest }) => rest)
      ));
      return updated;
    });
    setManualConfirmOpen(null);
    toast({
      title: "Item Marked Complete",
      description: "This item has been manually marked as complete.",
    });
  }, [toast]);

  // Toggle manual at-risk status
  const toggleAtRisk = useCallback((itemId: string) => {
    setPrepItems(prev => {
      const updated = prev.map(item => {
        if (item.id === itemId) {
          const newManualAtRisk = !item.manualAtRisk;
          return { 
            ...item, 
            manualAtRisk: newManualAtRisk,
            atRisk: newManualAtRisk || calculateAtRisk(item),
          };
        }
        return item;
      });
      localStorage.setItem("release-prep-checklist", JSON.stringify(
        updated.map(({ resolver, ...rest }) => rest)
      ));
      return updated;
    });
  }, []);

  return {
    prepItems,
    toggleAtRisk,
    handleManualConfirm,
    manualConfirmOpen,
    setManualConfirmOpen,
  };
}
